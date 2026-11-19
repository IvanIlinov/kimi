import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
const student = ranked.find(({ person }) => person.id === 1);
const viewer = student.person;
const now = new Date();
const week = new Map(ranked.map(({ person }) => [
    person.id, { userId: person.id, tasks: person.tasksWeek, topics: 2, active: true },
]));
const routes = {
    '/api/me': { role: 'student', name: viewer.name, personId: viewer.id },
    '/api/profile/me': profileDto(student, week.get(viewer.id), now, true),
    '/api/arena?mode=global': arenaDto(ranked, viewer.tgId, 'global', now),
    '/api/arena?mode=month': arenaDto(ranked, viewer.tgId, 'month', now),
    '/api/week': weekDto(ranked, viewer.tgId, week),
    '/api/members': membersDto(ranked, viewer.tgId),
    '/api/self': selfDto(student),
};
for (const entry of ranked) {
    const { id } = entry.person;
    routes['/api/profile/' + id] = profileDto(entry, week.get(id), now, id === viewer.id);
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
window.fetch = async (path, options) => {
    const read = !options?.method || options.method === 'GET';
    const found = read && Object.hasOwn(routes, path);
    return new Response(JSON.stringify(found ? routes[path] : {
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

const dir = await mkdtemp(join(tmpdir(), 'arena-demo-'));
const preview = join(dir, 'student-home.html');
await writeFile(preview, html);
console.log(preview);
