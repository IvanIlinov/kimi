import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { arenaDto, membersDto, profileDto, selfDto, weekDto, weeklyRecapDto } from '../../src/api/dto.ts';
import { recapPeriods } from '../../src/recap-periods.ts';
import { monthGoal, monthPct, rank } from '../../src/logic.ts';

const now = new Date();
const goals = monthGoal(now);
const ranked = rank([
    { name: 'Лера', tasksTotal: Math.round(goals.tasks * 0.6), tasksWeek: 17, exam: Math.round(goals.exam * 0.3), topics: goals.topics },
    { name: 'Саша', tasksTotal: 341, tasksWeek: 22, exam: 70, topics: 16 },
    { name: 'Миша', tasksTotal: 276, tasksWeek: 27, exam: 59, topics: 13 },
].map(({ topics, ...person }, i) => ({
    ...person,
    id: i + 1,
    tgId: i + 1,
    reinforced: Array.from({ length: topics }, (_, n) => n + 1),
    done: topics < 27 ? [topics + 1] : [],
    learning: topics < 26 ? [topics + 2] : [],
    comment: '',
})));
const adminDemo = process.argv.includes('--admin');
const guestDemo = process.argv.includes('--guest');
const role = adminDemo ? 'admin' : guestDemo ? 'guest' : 'student';
const recapPlacement = process.argv.includes('--recap-button') ? 'button'
    : process.argv.includes('--recap-swipe') ? 'swipe' : null;
if (recapPlacement && role !== 'student') throw new Error('Демо итогов доступно на главной ученика');
const firstStudent = ranked.find(({ person }) => person.id === 1);
const week = new Map(ranked.map(({ person }) => [
    person.id, { userId: person.id, tasks: person.tasksWeek, topics: 2, active: true },
]));

const demoPeriods = recapPeriods(now.getTime());
const weekStart = demoPeriods.week.end;
const lastWeek = [
    { userId: 1, tasks: 32, topics: 2, active: true },
    { userId: 2, tasks: 35, topics: 1, active: true },
    { userId: 3, tasks: 20, topics: 0, active: true },
];

function sampleStudyRecap(entry, { start, end, goalAt = end - 1 }, factor) {
    const date = new Date(goalAt);
    const goals = monthGoal(date);
    const stats = Object.fromEntries(Object.entries(goals).map(([metric, value]) => [metric, Math.round(value * factor)]));
    const pct = monthPct({ ...entry, person: { ...entry.person, monthResults: stats } }, date);
    return { start, end, ...stats, goals, pct, examBefore: 42 };
}

function demoRoutes(role, student) {
    const viewer = student?.person;
    const tgId = viewer?.tgId ?? 0;
    const routes = {
        '/api/me': { role, name: viewer?.name ?? (role === 'admin' ? 'Администратор' : 'Гость'), personId: viewer?.id ?? null },
        '/api/arena?mode=global': arenaDto(ranked, tgId, 'global', now, role !== 'student'),
        '/api/arena?mode=month': arenaDto(ranked, tgId, 'month', now, role !== 'student'),
        '/api/week': weekDto(ranked, tgId, week, role !== 'student'),
        '/api/members': membersDto(ranked, tgId),
    };
    for (const entry of ranked) {
        const { id } = entry.person;
        const profile = profileDto(entry, week.get(id), now, id === viewer?.id);
        if (!recapPlacement || id !== viewer?.id) {
            profile.weeklyRecap = weeklyRecapDto(ranked, entry, lastWeek, demoPeriods.week.start, weekStart);
            profile.studyRecaps = {
                season: {
                    ...sampleStudyRecap(entry, demoPeriods.currentFall ?? demoPeriods.season, 0.92),
                    inProgress: Boolean(demoPeriods.currentFall),
                },
                year: sampleStudyRecap(entry, demoPeriods.year, 0.97),
            };
        }
        routes['/api/profile/' + id] = profile;
    }
    if (student) {
        routes['/api/profile/me'] = routes['/api/profile/' + viewer.id];
        routes['/api/self'] = selfDto(student);
    }
    return routes;
}

const routes = { default: demoRoutes(role, role === 'student' ? firstStudent : undefined) };
if (adminDemo) {
    routes.default['/api/admin/members'] = ranked.map((entry) => {
        const { id, tgId, name, exam, tasksTotal } = entry.person;
        return { id, tgId, name, exam, tasksTotal, removed: false, topics: selfDto(entry).topics };
    });
    const today = Math.floor((now.getTime() + 3 * 3_600_000) / 86_400_000);
    routes.default['/api/admin/history?limit=14&offset=0'] = {
        days: [
            { day: today, rows: [
                { id: 3, name: 'Миша', pct: 4, tasks: 27, topics: 2, examBefore: 35, examAfter: 37 },
                { id: 2, name: 'Саша', pct: 1, tasks: 6, topics: 1, examBefore: 70, examAfter: 70 },
            ] },
            { day: today - 1, rows: [
                { id: 3, name: 'Миша', pct: 1, tasks: 0, topics: 1, examBefore: 35, examAfter: 35 },
            ] },
            { day: today - 2, rows: [
                { id: 1, name: 'Лера', pct: 0, tasks: 5, topics: 0, examBefore: firstStudent.person.exam, examAfter: firstStudent.person.exam },
                { id: 2, name: 'Саша', pct: 0, tasks: 0, topics: 0, examBefore: 66, examAfter: 70 },
            ] },
        ],
        hasMore: false,
    };
    routes.default['/api/admin/home'] = {
        previewEnabled: true,
        weekStart,
        month: {
            start: Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth(), 1) - 3 * 3_600_000,
            next: Date.UTC(moscow.getUTCFullYear(), moscow.getUTCMonth() + 1, 1) - 3 * 3_600_000,
        },
        attendance: { visits: 12, visitors: 7, participants: 8 },
        lessons: [
            { id: 1, weekday: 0, time: '16:30', name: 'Лера', status: 'planned', priceKopecks: 180000 },
            { id: 2, weekday: 0, time: '18:00', name: 'Саша', status: 'held', priceKopecks: 160000 },
            { id: 3, weekday: 2, time: '17:30', name: 'Миша', status: 'paid', priceKopecks: 200000 },
            { id: 4, weekday: 4, time: '16:00', name: 'Лера', status: 'planned', priceKopecks: 180000 },
        ],
    };
    routes.guest = demoRoutes('guest');
    for (const entry of ranked) routes[entry.person.id] = demoRoutes('student', entry);
}

let recapMarkup = '';
if (recapPlacement) {
    const source = await readFile(new URL('../demos/period-recaps.html', import.meta.url), 'utf8');
    const dialog = source.match(/<dialog id="period-recap"[\s\S]*?<\/dialog>/)?.[0];
    const script = source.match(/<script>[\s\S]*?<\/script>/)?.[0];
    const style = source.match(/\/\* Recap dialog start \*\/([\s\S]*?)\/\* Recap dialog end \*\//)?.[1];
    if (!dialog || !script || !style) throw new Error('Не найдена разметка карточек итогов');
    const scopedStyle = style.replaceAll('#period-recap', '&');
    recapMarkup = `<style>
        #period-recap {
            --accent: var(--blue);
            &[data-period="season"] { --accent: var(--good); }
            &[data-period="year"] { --accent: var(--warn); }
            h2, p, dl, dd { margin: 0; }
            .period { color: var(--muted); font-size: .87rem; }
            ${scopedStyle}
        }
    </style>${dialog}${script}`;
}

const bundle = await build({
    envFile: false,
    define: { 'import.meta.env.VITE_API_URL': '""' },
    build: { write: false, modulePreload: { polyfill: false } },
    plugins: [{
        name: 'arena-browser-demo',
        enforce: 'pre',
        transform(code, id) {
            if (recapPlacement && id.endsWith('/src/main.tsx')) {
                return `import { RecapHome } from '../scripts/recap-home';\n` +
                    code.replace('<App />', `<App StudentHome={() => <RecapHome placement="${recapPlacement}" />} />`);
            }
            if (id.endsWith('/src/lib/telegram.ts')) {
                return code.replace("export const insideTelegram = initData !== '';", 'export const insideTelegram = true;');
            }
        },
    }],
});
const files = new Map(bundle.output.map((file) => [file.fileName, file.type === 'asset' ? file.source : file.code]));
const demo = `<script>
const routes = ${JSON.stringify(routes).replaceAll('<', '\\u003c')};
let recapOpened = false;
let nextLessonId = 5;
let nextMemberId = 4;
const normalizeName = (name) => name.trim().replace(/\\p{L}/u, (letter) => letter.toUpperCase());
const profileTemplate = routes.default['/api/profile/1'];
const selfTemplate = routes['1']?.['/api/self'];
const topicCycle = { todo: 'learning', learning: 'done', done: 'reinforced', reinforced: 'todo' };
const lessonCycle = { planned: 'held', held: 'paid', paid: 'planned' };
window.fetch = async (path, options) => {
    const read = !options?.method || options.method === 'GET';
    const preview = options?.headers?.['X-Arena-Preview'];
    const editing = preview?.startsWith('edit:');
    const target = editing ? preview.slice(5) : preview;
    const current = target ? routes[target] : routes.default;
    const endpoint = target && path === '/api/me?preview=' + target ? '/api/me' : path;
    if (!preview && options?.method === 'POST' && path === '/api/self/recaps/open') {
        const requested = new URLSearchParams(window.location.search).get('recap');
        const kind = requested === 'season' || requested === 'year' ? requested : 'week';
        const profile = routes.default['/api/profile/me'];
        const recap = kind === 'week' ? profile?.weeklyRecap : profile?.studyRecaps?.[kind];
        const open = !recapOpened && recap && recap.end === JSON.parse(options.body)[kind] ? kind : null;
        if (open) recapOpened = true;
        return Response.json({ open });
    }
    if (editing && current && options?.method === 'POST') {
        const result = current['/api/self'];
        const topic = path.match(/^\\/api\\/self\\/topics\\/(\\d+)\\/cycle$/);
        if (topic) result.topics[Number(topic[1]) - 1] = topicCycle[result.topics[Number(topic[1]) - 1]];
        else if (path === '/api/self/exam') result.exam = JSON.parse(options.body).value;
        else if (path === '/api/self/tasks') result.tasksTotal = Math.max(0, result.tasksTotal + JSON.parse(options.body).amount);
        else return Response.json({ error: 'Действие недоступно' }, { status: 403 });
        const totals = { tasks: result.tasksTotal, exam: result.exam, topics: result.topics.filter((s) => s === 'reinforced').length };
        for (const view of Object.values(routes)) {
            const profile = view['/api/profile/' + target];
            if (profile) {
                profile.totals = totals;
                if (view['/api/me'].personId === Number(target)) view['/api/profile/me'].totals = totals;
            }
        }
        return Response.json(result);
    }
    const home = !preview && routes.default['/api/admin/home'];
    if (home && options?.method === 'POST') {
        if (path === '/api/admin/members') {
            const { tgId, name } = JSON.parse(options.body);
            const members = routes.default['/api/admin/members'];
            if (members.some((row) => row.tgId === tgId || row.name === normalizeName(name))) {
                return Response.json({ error: 'Участник уже в рейтинге' }, { status: 400 });
            }
            const id = nextMemberId++;
            const topics = Array(27).fill('todo');
            const member = { id, name: normalizeName(name) };
            const profile = structuredClone(profileTemplate);
            Object.assign(profile, member, {
                place: members.length + 1, pct: 0, monthPct: 0,
                totals: { tasks: 0, topics: 0, exam: 0 },
            });
            Object.assign(profile.week, { tasks: 0, topics: 0, goalPct: 0 });
            profile.month.tasks.value = 0;
            profile.month.topics.value = 0;
            profile.month.exam.value = 0;
            members.push({ ...member, tgId, removed: false, topics, tasksTotal: 0, exam: 0 });
            home.attendance.participants++;
            const newView = structuredClone(routes.guest);
            newView['/api/me'] = { role: 'student', name: member.name, personId: id };
            newView['/api/profile/me'] = { ...profile, canEdit: true };
            newView['/api/self'] = { ...selfTemplate, topics, tasksTotal: 0, tasksWeek: 0, exam: 0 };
            routes[id] = newView;
            for (const view of Object.values(routes)) {
                view['/api/profile/' + id] = profile;
                view['/api/members'].push(member);
                const week = view['/api/week'];
                week.rows.push({ ...member, tasks: 0, topics: 0, goalPct: 0 });
                week.leader ??= { name: member.name, pct: 0, tasks: 0, topics: 0 };
                for (const mode of ['global', 'month']) {
                    const arena = view['/api/arena?mode=' + mode];
                    arena.rows.push({ ...member, pct: 0, tasks: 0, standing: 'behind' });
                    arena.leader ??= { name: member.name, pct: 0, monthPct: 0, tasks: 0, topics: 0, exam: 0 };
                }
            }
            return Response.json({ ok: true, id });
        }
        const removeMember = path.match(/^\\/api\\/admin\\/members\\/(\\d+)\\/remove$/);
        if (removeMember) {
            const id = Number(removeMember[1]);
            const members = routes.default['/api/admin/members'];
            const removed = members.find((row) => row.id === id);
            if (!removed) return Response.json({ error: 'Участник не найден' }, { status: 404 });
            routes.default['/api/admin/members'] = members.filter((row) => row.id !== id);
            delete routes[id];
            home.attendance.participants--;
            for (const view of Object.values(routes)) {
                view['/api/members'] = view['/api/members'].filter((row) => row.id !== id);
                delete view['/api/profile/' + id];
                const week = view['/api/week'];
                week.rows = week.rows.filter((row) => row.id !== id);
                const first = week.rows[0];
                week.leader = first ? {
                    name: first.name, tasks: first.tasks, topics: first.topics,
                    pct: Math.round(40 * (first.tasks / 900 + first.topics / 27)),
                } : null;
                for (const mode of ['global', 'month']) {
                    const arena = view['/api/arena?mode=' + mode];
                    arena.rows = arena.rows.filter((row) => row.id !== id);
                    const profile = view['/api/profile/' + arena.rows[0]?.id];
                    arena.leader = profile ? {
                        name: profile.name, pct: profile.pct, monthPct: profile.monthPct,
                        ...(mode === 'global' ? profile.totals : {
                            tasks: profile.month.tasks.value, topics: profile.month.topics.value, exam: profile.month.exam.value,
                        }),
                    } : null;
                }
            }
            return Response.json({ ok: true });
        }
        const cycle = path.match(/^\\/api\\/admin\\/lessons\\/(\\d+)\\/cycle$/);
        if (cycle) {
            const lesson = home.lessons.find((item) => item.id === Number(cycle[1]));
            if (!lesson) return Response.json({ error: 'Занятие не найдено' }, { status: 404 });
            lesson.status = lessonCycle[lesson.status];
            return Response.json({ status: lesson.status });
        }
        if (path === '/api/admin/lessons') {
            const { weekStart, id, ...lesson } = JSON.parse(options.body);
            lesson.name = normalizeName(lesson.name);
            if (id === undefined) home.lessons.push({ priceKopecks: 0, ...lesson, id: nextLessonId++ });
            else home.lessons = home.lessons.map((row) => row.id === id ? { ...row, ...lesson } : row);
            home.lessons.sort((a, b) => a.weekday - b.weekday || a.time.localeCompare(b.time));
            return Response.json({ ok: true });
        }
        const remove = path.match(/^\\/api\\/admin\\/lessons\\/(\\d+)\\/remove$/);
        if (remove) {
            home.lessons = home.lessons.filter((row) => row.id !== Number(remove[1]));
            return Response.json({ ok: true });
        }
    }
    if (read && home && path === '/api/admin/home') {
        const { start, next } = home.month;
        let earnedKopecks = 0;
        let plannedKopecks = 0;
        for (const lesson of home.lessons) {
            const date = home.weekStart + lesson.weekday * 86_400_000;
            if (date < start || date >= next) continue;
            plannedKopecks += lesson.priceKopecks;
            if (lesson.status === 'paid') earnedKopecks += lesson.priceKopecks;
        }
        return Response.json({ ...home, month: { start, earnedKopecks, plannedKopecks } });
    }
    const found = read && current && Object.hasOwn(current, endpoint);
    if (found && endpoint === '/api/profile/me' && new URLSearchParams(window.location.search).get('recap') === 'season') {
        const fall = current[endpoint].studyRecaps?.season;
        if (fall?.inProgress) {
            fall.end = Date.UTC(new Date(fall.start + 3 * 3_600_000).getUTCFullYear(), 11, 1) - 3 * 3_600_000;
            fall.inProgress = false;
        }
    }
    return new Response(JSON.stringify(found ? current[endpoint] : {
        error: read ? 'Данные не найдены' : 'Сохранение доступно через тестового бота',
    }), { status: found ? 200 : read ? 404 : 405 });
};
</script>`;
const html = files.get('index.html')
    .replace('</body>', () => recapMarkup + '</body>')
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
const preview = join(dir, recapPlacement ? `student-recap-${recapPlacement}.html` : `${role}-home.html`);
await writeFile(preview, html);
console.log(preview);
