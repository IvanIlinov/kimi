import { createExams } from "./exams.js";

const catalog = {
    5: {
        title: "Алгоритмы и числа",
        cheat: ["Приписать 0 справа — умножить число на 2.", "Приписать 1 справа — умножить на 2 и прибавить 1.", "Для нескольких разрядов повторяй операцию слева направо."],
        lesson: ["Возьмём число 6 и припишем справа 01.", "Сначала приписываем 0: 6 × 2 = 12.", "Теперь приписываем 1: 12 × 2 + 1 = 25."],
        tasks: [
            { type: "Двоичная запись", title: "Допиши разряд", text: "К двоичной записи числа 13 справа приписали 0. Какое число получилось в десятичной системе?", answer: "26" },
            { type: "Двоичная запись", title: "Два новых разряда", text: "К двоичной записи числа 6 справа приписали 01. Какое число получилось в десятичной системе?", answer: "25" },
            { type: "Поиск числа", title: "Найди минимальное N", text: "К двоичной записи натурального числа N справа приписывают 1. Найди минимальное N, при котором результат больше 30.", answer: "15" },
        ],
    },
    8: {
        title: "Комбинаторика",
        cheat: ["Для независимых позиций перемножай число вариантов.", "Без повторений на каждой следующей позиции вариантов на один меньше.", "Если порядок важен, одинаковый набор символов может дать несколько кодов."],
        lesson: ["Составим трёхбуквенный код из А, Б и В с ровно одной буквой А.", "У А три возможные позиции. Для каждой из двух оставшихся позиций выбираем Б или В.", "Перемножаем: 3 × 2 × 2 = 12 кодов."],
        tasks: [
            { type: "Слова", title: "Код из трёх букв", text: "Сколько трёхбуквенных кодов можно составить из букв А, Б, В, если буквы могут повторяться?", answer: "27" },
            { type: "Слова", title: "Ровно одна буква А", text: "Сколько трёхбуквенных кодов из букв А, Б, В содержат ровно одну букву А? Другие буквы могут повторяться.", answer: "12" },
            { type: "Числа", title: "Число без повторений", text: "Сколько трёхзначных чисел можно составить из цифр 0, 1, 2, 3 без повторения цифр?", answer: "18" },
        ],
    },
    11: {
        title: "Кодирование информации",
        cheat: ["Число бит на символ — наименьшее b, для которого 2ᵇ ≥ размер алфавита.", "Умножь биты на число символов, затем раздели на 8.", "Если на запись выделяют целое число байт, округляй вверх для каждой записи отдельно."],
        lesson: ["Рассмотрим пароль из 12 символов алфавита на 32 знака. На один символ нужно 5 бит, так как 2⁵ = 32.", "На пароль нужно 12 × 5 = 60 бит. Делим на 8 и округляем вверх: 8 байт.", "Для 64 паролей умножаем 8 × 64 = 512 байт."],
        tasks: [
            { type: "Пароли", title: "Память для пароля", text: "Пароль состоит из 8 символов алфавита из 16 знаков. Каждый символ кодируется одинаковым минимальным числом бит. Сколько байт занимает пароль?", answer: "4 байта" },
            { type: "Пароли", title: "Память для 64 паролей", text: "Каждый пароль состоит из 12 символов алфавита из 32 знаков. На один пароль выделяют минимальное целое число байт, каждому символу отводят одинаковое минимальное число бит. Сколько байт занимают 64 пароля?", answer: "512 байт" },
            { type: "Идентификаторы", title: "Минимальный размер записи", text: "Идентификатор состоит из 9 символов. В алфавите 20 знаков. Каждый символ кодируется минимальным одинаковым числом бит. Какое минимальное целое число байт нужно на один идентификатор?", answer: "6 байт" },
        ],
    },
};

const statuses = ["Не изучено", "В изучении", "Изучено", "Закреплено"];
const initialStatuses = [3, 3, 2, 1, 3, 2, 0, 1, 3, 0, 2, 1, 3, 3, 0, 2, 1, 3, 0, 1, 0, 0, 2, 0, 0, 0, 0];
const initialProfile = { name: "Мира Волкова", start: "2026-09-01", solved: 183, week: 18, exam: 72 };
const settingsKey = "study-home-settings-v1";
let saved;
try {
    saved = JSON.parse(localStorage.getItem(settingsKey));
} catch {
    saved = null;
}
const profile = { ...initialProfile };
if (typeof saved?.profile?.name === "string" && saved.profile.name.trim()) profile.name = saved.profile.name;
if (/^\d{4}-\d{2}-\d{2}$/.test(saved?.profile?.start) && Number.isFinite(Date.parse(saved.profile.start))) {
    profile.start = saved.profile.start;
}
for (const [key, max] of Object.entries({ solved: 999999, week: 999999, exam: 100 })) {
    const value = saved?.profile?.[key];
    if (Number.isInteger(value) && value >= 0 && value <= max) profile[key] = value;
}
const topicStatuses = initialStatuses.map((status, index) => {
    const stored = saved?.statuses?.[index];
    return Number.isInteger(stored) && stored >= 0 && stored < statuses.length ? stored : status;
});

function saveSettings() {
    try {
        localStorage.setItem(settingsKey, JSON.stringify({ profile, statuses: topicStatuses }));
        return true;
    } catch {
        return false;
    }
}

const byId = id => document.getElementById(id);
const grid = byId("topics");
const dialog = byId("problem");
const exams = createExams(catalog);
let activeNumber = null;
let activeType = "Все";
const materialButtons = document.querySelectorAll("[data-material]");

function showMaterial(kind) {
    const panel = byId("material");
    panel.hidden = kind === "practice";
    byId("practice").hidden = !panel.hidden;
    for (const button of materialButtons) {
        button.setAttribute("aria-pressed", String(button.dataset.material === kind));
    }
    if (panel.hidden) return;

    const entry = catalog[activeNumber];
    byId("material-title").textContent = kind === "cheat" ? "Шпаргалка" : "Обучение";
    const list = document.createElement(kind === "cheat" ? "ul" : "ol");
    for (const step of entry[kind]) {
        const item = document.createElement("li");
        item.textContent = step;
        list.append(item);
    }
    byId("material-content").replaceChildren(list);
}

for (const button of materialButtons) {
    button.addEventListener("click", () => {
        showMaterial(button.dataset.material);
    });
}

function statusMeter(count) {
    const marks = document.createElement("span");
    marks.className = "status-meter";
    marks.setAttribute("aria-hidden", "true");
    for (let index = 0; index < 3; index++) {
        const segment = document.createElement("i");
        if (index < count) segment.className = "filled";
        marks.append(segment);
    }
    return marks;
}

for (const item of document.querySelectorAll(".legend li")) {
    const status = Number(item.dataset.status);
    if (status === 3) {
        const swatch = document.createElement("span");
        swatch.className = "completed-swatch";
        swatch.setAttribute("aria-hidden", "true");
        item.prepend(swatch);
    } else {
        item.prepend(statusMeter(status));
    }
}

function updateTile(tile, number, status) {
    tile.dataset.status = status;
    tile.setAttribute("aria-label", `Задание ${number}. ${statuses[status]}`);
    const meter = tile.querySelector(".status-meter");
    if (status === 3) meter?.remove();
    else if (meter) meter.replaceWith(statusMeter(status));
    else tile.append(statusMeter(status));
}

for (const [index, status] of topicStatuses.entries()) {
    const number = index + 1;
    const tile = document.createElement("a");
    tile.className = "topic-tile";
    tile.href = `#task-${number}`;
    const label = document.createElement("span");
    label.className = "topic-number-label";
    label.textContent = number;
    tile.append(label);
    updateTile(tile, number, status);
    grid.append(tile);
}

const profileForm = byId("profile-settings");
const progressForm = byId("progress-settings");
const settingsGrid = byId("settings-topic");
const dateFormat = new Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "UTC" });

const rankingExamples = [
    { name: "Алина Соколова", progress: 82, week: 24, exam: 86, studied: 22, solved: 254, start: "2026-08-24" },
    { name: "Лев Орлов", progress: 71, week: 22, exam: 74, studied: 18, solved: 215, start: "2026-09-01" },
    { name: "Соня Лебедева", progress: 76, week: 20, exam: 79, studied: 20, solved: 230, start: "2026-09-05" },
];
const rankingTabs = document.querySelectorAll("[data-ranking]");
let rankingPeriod = "global";

function rankingElement(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
}

function renderRanking() {
    const own = { ...profile, progress: 64, studied: topicStatuses.filter(status => status >= 2).length, current: true };
    const metric = rankingPeriod === "week" ? "week" : "progress";
    const people = [...rankingExamples, own].sort((a, b) => b[metric] - a[metric]);
    const list = byId("ranking-list");
    list.replaceChildren();

    for (const [index, player] of people.entries()) {
        const row = document.createElement("li");
        const card = rankingElement("details", "", player.current ? "ranking-player ranking-player-own" : "ranking-player");
        card.name = "ranking-profiles";
        const summary = rankingElement("summary", "", "ranking-summary");
        const place = rankingElement("span", String(index + 1).padStart(2, "0"), "ranking-place");
        const name = rankingElement("strong", player.name, "ranking-name");
        const value = rankingElement("span", metric === "week" ? `${player.week}/25` : `${player.progress}%`, "ranking-value");
        value.setAttribute("aria-label", metric === "week"
            ? `Решено за неделю: ${player.week} из 25`
            : `Общий прогресс: ${player.progress}%`);
        const caret = rankingElement("span", "", "ranking-caret");
        caret.setAttribute("aria-hidden", "true");
        summary.append(place, name, value, caret);

        const body = rankingElement("div", "", "ranking-profile");
        const metrics = rankingElement("dl", "", "ranking-metrics");
        for (const [label, amount] of [["Пробник", player.exam], ["Изучено", `${player.studied}/27`], ["Решено", player.solved]]) {
            const item = document.createElement("div");
            item.append(rankingElement("dt", label), rankingElement("dd", String(amount)));
            metrics.append(item);
        }
        const start = rankingElement("div", "", "ranking-start");
        const date = rankingElement("time", dateFormat.format(new Date(player.start)));
        date.dateTime = player.start;
        start.append(rankingElement("span", "Начало подготовки"), date);
        body.append(metrics, start);
        card.append(summary, body);
        row.append(card);
        list.append(row);
    }
}

for (const button of rankingTabs) {
    button.addEventListener("click", () => {
        rankingPeriod = button.dataset.ranking;
        for (const item of rankingTabs) item.setAttribute("aria-pressed", String(item === button));
        renderRanking();
    });
}

function updateProfile() {
    byId("profile-name").textContent = profile.name;
    byId("profile-solved").textContent = profile.solved;
    byId("profile-exam").textContent = profile.exam;
    const studied = topicStatuses.filter(status => status >= 2).length;
    byId("profile-studied").textContent = studied;
    byId("profile-since").textContent = `Подготовка с ${dateFormat.format(new Date(profile.start))}`;
    renderRanking();

    for (const [key, value] of Object.entries({ studied, week: profile.week, exam: profile.exam })) {
        const row = byId(`profile-goal-${key}`);
        const meter = row.querySelector("progress");
        meter.value = value;
        row.querySelector("b").textContent = `${value}/${meter.max}`;
    }
}

const scoreInput = byId("settings-exam");

function updateScore() {
    byId("settings-exam-value").textContent = scoreInput.value;
}

function clearProgressFeedback() {
    byId("progress-feedback").textContent = "";
}

profileForm.addEventListener("input", () => { byId("profile-feedback").textContent = ""; });
progressForm.addEventListener("input", clearProgressFeedback);
scoreInput.addEventListener("input", updateScore);

for (const button of progressForm.querySelectorAll("[data-task-delta]")) {
    button.addEventListener("click", () => {
        const delta = Number(button.dataset.taskDelta);
        for (const name of ["solved", "week"]) {
            const input = progressForm.elements.namedItem(name);
            input.value = Math.min(Number(input.max), Math.max(0, Number(input.value) + delta));
        }
        clearProgressFeedback();
    });
}

profileForm.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(profileForm);
    const name = form.get("name").trim();
    if (!name) {
        byId("profile-feedback").textContent = "Введи имя.";
        return;
    }
    Object.assign(profile, { name, start: form.get("start") });
    applySettings("profile-feedback");
});

progressForm.addEventListener("submit", event => {
    event.preventDefault();
    const form = new FormData(progressForm);
    Object.assign(profile, {
        solved: Number(form.get("solved")),
        week: Number(form.get("week")),
        exam: Number(form.get("exam")),
    });
    applySettings("progress-feedback");
});

function applySettings(feedback) {
    updateProfile();
    byId(feedback).textContent = saveSettings() ? "Сохранено." : "Применено до перезагрузки.";
}

function updateSettingsTile(button, number, status) {
    updateTile(button, number, status);
    button.setAttribute("aria-label", `Сменить статус задания №${number}. Сейчас: ${statuses[status]}`);
}

for (const [index, initial] of topicStatuses.entries()) {
    const number = index + 1;
    const button = document.createElement("button");
    const label = document.createElement("span");
    button.type = "button";
    button.className = "topic-tile";
    label.className = "topic-number-label";
    label.textContent = number;
    button.append(label);
    updateSettingsTile(button, number, initial);
    settingsGrid.append(button);

    button.addEventListener("click", () => {
        const status = (topicStatuses[index] + 1) % statuses.length;
        topicStatuses[index] = status;
        updateTile(grid.children[index], number, status);
        updateSettingsTile(button, number, status);
        updateProfile();
        byId("status-feedback").textContent = saveSettings()
            ? `Задание №${number}: ${statuses[status].toLowerCase()}.`
            : "Применено до перезагрузки.";
    });
}
updateProfile();

const settingsTabs = [...document.querySelectorAll("[data-settings-tab]")];

function showSettingsTab(tab) {
    byId("settings-profile-tab").hidden = tab !== "profile";
    byId("settings-progress-tab").hidden = tab !== "progress";
    for (const button of settingsTabs) {
        button.setAttribute("aria-pressed", String(button.dataset.settingsTab === tab));
    }
}

for (const button of settingsTabs) {
    button.addEventListener("click", () => showSettingsTab(button.dataset.settingsTab));
}

function showSettings(number) {
    for (const form of [profileForm, progressForm]) {
        for (const input of form.querySelectorAll("input[name]")) input.value = profile[input.name];
    }
    updateScore();
    byId("profile-feedback").textContent = "";
    byId("progress-feedback").textContent = "";
    byId("status-feedback").textContent = "Нажми на плитку, чтобы сменить статус.";
    showSettingsTab("progress");
    if (number >= 1 && number <= topicStatuses.length) settingsGrid.children[number - 1].focus();
    else byId("settings-page").querySelector("h1").focus();
}

function openProblem(task) {
    byId("problem-title").textContent = task.title;
    byId("problem-text").textContent = task.text;
    byId("problem-answer").textContent = task.answer;
    dialog.querySelector("details").open = false;
    dialog.showModal();
}

function renderTasks(tasks) {
    const options = ["Все", ...new Set(tasks.map(task => task.type))];
    const types = byId("types");
    types.replaceChildren();

    for (const type of options) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = type;
        button.setAttribute("aria-pressed", String(type === activeType));
        button.addEventListener("click", () => {
            activeType = type;
            for (const item of types.children) item.setAttribute("aria-pressed", String(item === button));
            showTasks(tasks);
        });
        types.append(button);
    }
    showTasks(tasks);
}

function showTasks(tasks) {
    const list = byId("task-list");
    list.replaceChildren();
    for (const task of tasks) {
        if (activeType !== "Все" && task.type !== activeType) continue;
        const button = document.createElement("button");
        const title = document.createElement("strong");
        const type = document.createElement("small");
        button.type = "button";
        title.textContent = task.title;
        type.textContent = task.type;
        button.append(title, type);
        button.addEventListener("click", () => openProblem(task));
        list.append(button);
    }
}

function showPage() {
    const match = /^#task-(\d+)$/.exec(location.hash);
    const number = match ? Number(match[1]) : 0;
    const showTopic = number >= 1 && number <= topicStatuses.length;
    const previous = activeNumber;
    activeNumber = showTopic ? number : null;
    if (dialog.open) dialog.close();
    showMaterial("practice");
    const exam = exams.fromHash(location.hash);
    const settings = /^#settings(?:-task-(\d+))?$/.exec(location.hash);
    const section = settings ? "settings" : exam || location.hash === "#exams" ? "exams" : location.hash === "#ranking" ? "ranking" : "tasks";
    byId("settings-page").hidden = !settings;
    byId("ranking-page").hidden = section !== "ranking";
    byId("exams-page").hidden = section !== "exams" || !!exam;
    byId("exam-page").hidden = !exam;
    byId("home").hidden = showTopic || section !== "tasks";
    exams.closeProblem();
    for (const link of document.querySelectorAll(".dock a")) {
        if (link.dataset.section === section) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
    }
    byId("topic").hidden = !showTopic;

    if (showTopic) {
        const entry = catalog[number];
        for (const button of materialButtons) button.disabled = !entry && button.dataset.material !== "practice";
        const status = topicStatuses[number - 1];
        byId("topic-status-link").href = `#settings-task-${number}`;
        byId("topic-status-preview").replaceChildren(statusMeter(status));
        byId("topic-status-label").textContent = statuses[status];
        byId("topic-number").textContent = number;
        byId("topic-title").textContent = entry?.title ?? `Задание ${number}`;
        activeType = "Все";
        if (entry) {
            renderTasks(entry.tasks);
        } else {
            byId("types").replaceChildren();
            byId("task-list").textContent = "Для просмотра примеров открой задания №5, №8 или №11.";
        }
        byId("topic-title").focus();
    } else if (settings) {
        showSettings(Number(settings[1]));
    } else if (exam) {
        exams.show(exam);
    } else if (section === "exams") {
        byId("exams-page").querySelector("h1").focus();
    } else if (section === "ranking") {
        byId("ranking-page").querySelector("h1").focus();
    } else if (previous) {
        grid.children[previous - 1].focus();
    }
}

window.addEventListener("hashchange", showPage);
showPage();
