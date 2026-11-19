import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { arenaDto, membersDto, profileDto, selfDto, weekDto } from '../../src/api/dto.ts';
import { rank } from '../../src/logic.ts';

const ranked = rank([
    { name: 'Лера', tasksTotal: 314, tasksWeek: 17, exam: null, topics: 14 },
    { name: 'Саша', tasksTotal: 341, tasksWeek: 22, exam: 70, topics: 16 },
    { name: 'Миша', tasksTotal: 276, tasksWeek: 27, exam: 59, topics: 13 },
].map(({ topics, ...person }, i) => ({
    ...person,
    id: i + 1,
    tgId: i + 1,
    reinforced: Array.from({ length: topics }, (_, n) => n + 1),
    done: [17],
    learning: [18],
    comment: '',
})));
const adminDemo = process.argv.includes('--admin');
const firstStudent = ranked.find(({ person }) => person.id === 1);
const now = new Date();
const week = new Map(ranked.map(({ person }) => [
    person.id, { userId: person.id, tasks: person.tasksWeek, topics: 2, active: true },
]));

function demoRoutes(role, student) {
    const viewer = student?.person;
    const tgId = viewer?.tgId ?? 0;
    const routes = {
        '/api/me': { role, name: viewer?.name ?? (role === 'admin' ? 'Администратор' : 'Гость'), personId: viewer?.id ?? null },
        '/api/arena?mode=global': arenaDto(ranked, tgId, 'global', now),
        '/api/arena?mode=month': arenaDto(ranked, tgId, 'month', now),
        '/api/week': weekDto(ranked, tgId, week),
        '/api/members': membersDto(ranked, tgId),
    };
    for (const entry of ranked) {
        const { id } = entry.person;
        routes['/api/profile/' + id] = profileDto(entry, week.get(id), now, id === viewer?.id);
    }
    if (student) {
        routes['/api/profile/me'] = routes['/api/profile/' + viewer.id];
        routes['/api/self'] = selfDto(student);
    }
    return routes;
}

const routes = { default: adminDemo ? demoRoutes('admin') : demoRoutes('student', firstStudent) };
if (adminDemo) {
    routes.default['/api/admin/members'] = ranked.map((entry) => {
        const { id, tgId, name, exam, tasksTotal } = entry.person;
        return { id, tgId, name, exam, tasksTotal, removed: false, topics: selfDto(entry).topics };
    });
    routes.default['/api/admin/journal?limit=50&offset=0'] = [];
    const moscow = new Date(now.getTime() + 3 * 3_600_000);
    const monday = moscow.getUTCDate() - (moscow.getUTCDay() + 6) % 7;
    routes.default['/api/admin/home'] = {
        weekStart: Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), monday) - 3 * 3_600_000,
        attendance: { visits: 12, visitors: 7, participants: 8 },
        lessons: [
            { id: 1, weekday: 0, time: '16:30', name: 'Лера', status: 'planned' },
            { id: 2, weekday: 0, time: '18:00', name: 'Саша', status: 'held' },
            { id: 3, weekday: 2, time: '17:30', name: 'Миша', status: 'paid' },
            { id: 4, weekday: 4, time: '16:00', name: 'Лера', status: 'planned' },
        ],
    };
    routes.guest = demoRoutes('guest');
    for (const entry of ranked) routes[entry.person.id] = demoRoutes('student', entry);
}

const bundle = await build({
    envFile: false,
    define: { 'import.meta.env.VITE_API_URL': '""' },
    build: { write: false, modulePreload: { polyfill: false } },
    plugins: [{
        name: 'arena-browser-demo',
        enforce: 'pre',
        transform(code, id) {
            if (id.endsWith('/src/lib/telegram.ts')) {
                return code.replace("export const insideTelegram = initData !== '';", 'export const insideTelegram = true;');
            }
        },
    }],
});
const files = new Map(bundle.output.map((file) => [file.fileName, file.type === 'asset' ? file.source : file.code]));
const demo = `<script>
const routes = ${JSON.stringify(routes).replaceAll('<', '\\u003c')};
let nextLessonId = 5;
window.fetch = async (path, options) => {
    const read = !options?.method || options.method === 'GET';
    const preview = options?.headers?.['X-Arena-Preview'];
    const current = preview ? routes[preview] : routes.default;
    const endpoint = preview && path === '/api/me?preview=' + preview ? '/api/me' : path;
    const home = !preview && routes.default['/api/admin/home'];
    if (home && options?.method === 'POST') {
        if (path === '/api/admin/lessons') {
            const { weekStart, id, ...lesson } = JSON.parse(options.body);
            if (id === undefined) home.lessons.push({ ...lesson, id: nextLessonId++ });
            else home.lessons = home.lessons.map((row) => row.id === id ? { ...lesson, id } : row);
            home.lessons.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
            return Response.json({ ok: true });
        }
        const remove = path.match(/^\\/api\\/admin\\/lessons\\/(\\d+)\\/remove$/);
        if (remove) {
            home.lessons = home.lessons.filter((row) => row.id !== Number(remove[1]));
            return Response.json({ ok: true });
        }
    }
    const found = read && current && Object.hasOwn(current, endpoint);
    return new Response(JSON.stringify(found ? current[endpoint] : {
        error: read ? 'Данные не найдены' : 'Сохранение доступно через тестового бота',
    }), { status: found ? 200 : read ? 404 : 405 });
};
</script>`;
const html = files.get('index.html')
    .replace(/<script src="https:\/\/telegram\.org\/js\/telegram-web-app\.js"><\/script>/, () => demo)
    .replace(/<script type="module" crossorigin src="\/([^"]+)"><\/script>/, (_, file) =>
        '<script type="module">' + files.get(file).replaceAll('</script', '<\\/script') + '</script>')
    .replace(/<link rel="stylesheet" crossorigin href="\/([^"]+)">/, (_, file) =>
        '<style>' + files.get(file) + '</style>');
if (!html.includes('window.fetch =') || !html.includes('<script type="module">') || !html.includes('<style>')) {
    throw new Error('Не удалось собрать автономный HTML предпросмотра');
}

const dir = fileURLToPath(new URL('../demos/', import.meta.url));
await mkdir(dir, { recursive: true });
const preview = join(dir, adminDemo ? 'admin-home.html' : 'student-home.html');
await writeFile(preview, html);
console.log(preview);
