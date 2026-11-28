const levels = { easy: "Простой", medium: "Средний", hard: "Сложный" };
const formats = {
    official: "официальный формат",
    standard: "стандарт",
    extended: "расширенный",
};
const variants = [
    { id: "demo", title: "Демоверсия", level: "easy", format: "official", tasks: { 5: [0], 8: [0] } },
    { id: "main", title: "Основная волна", level: "medium", format: "official", tasks: { 5: [1], 8: [1] } },
    { id: "retake", title: "Пересдача", level: "hard", format: "official", tasks: { 5: [2], 8: [2] } },
    { id: "standard-easy", title: "Разминка", level: "easy", format: "standard", tasks: { 5: [0], 8: [0] } },
    { id: "standard-medium", title: "Тренировочный вариант", level: "medium", format: "standard", tasks: { 5: [2], 8: [1] } },
    { id: "standard-hard", title: "Контрольный вариант", level: "hard", format: "standard", tasks: { 5: [1], 8: [2] } },
    { id: "foundation", title: "Базовые типажи", level: "easy", format: "extended", tasks: { 5: [0, 2], 8: [0, 2] } },
    { id: "mixed", title: "Смешанные типажи", level: "medium", format: "extended", tasks: { 5: [1, 2], 8: [1, 2] } },
    { id: "advanced", title: "Сложные типажи", level: "hard", format: "extended", tasks: { 5: [1, 2], 8: [1, 2] } },
];

const byId = id => document.getElementById(id);
const totalTasks = variant => Object.values(variant.tasks).reduce((sum, indexes) => sum + indexes.length, 0);
const plural = (n, forms) => forms[n % 100 >= 11 && n % 100 <= 14 ? 2 : n % 10 === 1 ? 0 : n % 10 >= 2 && n % 10 <= 4 ? 1 : 2];

function element(tag, content, className) {
    const item = document.createElement(tag);
    if (content) item.textContent = content;
    if (className) item.className = className;
    return item;
}

export function createExams(catalog) {
    const formatButtons = [...document.querySelectorAll("[data-format]")];
    const filters = [...document.querySelectorAll("[data-level]")];
    const dialog = byId("exam-problem");
    const answer = byId("exam-answer");
    const feedback = byId("exam-feedback");
    const solved = new Map();
    let activeProblem = null;

    let format = "official";
    let level = "all";

    function renderLists() {
        const list = byId("exam-results");
        const matches = variants.filter(item => item.format === format && (level === "all" || item.level === level));
        list.replaceChildren();

        for (const variant of matches) {
            const tasks = totalTasks(variant);
            const progress = solved.get(variant.id)?.size ?? 0;
            const questions = Object.keys(variant.tasks).length;
            const questionLabel = plural(questions, ["задание", "задания", "заданий"]);
            const meta = variant.format !== "extended"
                ? `${questions} ${questionLabel}`
                : `${questions} ${questionLabel} · ${tasks} ${plural(tasks, ["задача", "задачи", "задач"])}`;
            const link = element("a", "", "exam-link");
            link.href = `#exam-${variant.id}`;
            const copy = element("div", "", "exam-copy");
            copy.append(element("strong", variant.title), element("small", progress ? `${meta} · решено ${progress}/${tasks}` : meta));
            link.append(copy, element("span", levels[variant.level], "exam-difficulty"));
            list.append(link);
        }

    }

    for (const button of formatButtons) {
        button.addEventListener("click", () => {
            format = button.dataset.format;
            for (const item of formatButtons) item.setAttribute("aria-pressed", String(item === button));
            renderLists();
        });
    }

    for (const button of filters) {
        button.addEventListener("click", () => {
            level = button.dataset.level;
            for (const filter of filters) filter.setAttribute("aria-pressed", String(filter === button));
            renderLists();
        });
    }

    renderLists();

    function show(variant, focus = true) {
        const title = byId("exam-title");
        title.textContent = variant.title;
        byId("exam-summary").textContent = `${levels[variant.level]} · ${formats[variant.format]} · демо`;
        const done = solved.get(variant.id) ?? new Set();
        byId("exam-progress-label").textContent = `Решено ${done.size} из ${totalTasks(variant)}`;
        const bar = byId("exam-progress-bar");
        bar.max = totalTasks(variant);
        bar.value = done.size;

        const list = byId("exam-problems");
        list.replaceChildren();
        for (const [number, indexes] of Object.entries(variant.tasks)) {
            const entry = catalog[number];
            const section = element("section", "", "panel exam-question");
            section.append(element("h2", `№${number} · ${entry.title}`));
            for (const index of indexes) {
                const task = entry.tasks[index];
                const key = `${number}-${index}`;
                const button = element("button", "", "exam-task");
                button.type = "button";
                button.dataset.problem = key;
                button.append(element("strong", task.title), element("small", done.has(key) ? "Решено" : task.type));
                button.addEventListener("click", () => {
                    activeProblem = { variant, key, task };
                    answer.value = "";
                    feedback.textContent = "";
                    byId("exam-problem-title").textContent = task.title;
                    byId("exam-problem-text").textContent = task.text;
                    dialog.showModal();
                });
                section.append(button);
            }
            list.append(section);
        }
        if (focus) title.focus();
    }

    dialog.addEventListener("close", () => {
        if (!activeProblem) return;
        const { variant, key } = activeProblem;
        activeProblem = null;
        if (location.hash === `#exam-${variant.id}`) document.querySelector(`[data-problem="${key}"]`)?.focus();
    });

    byId("exam-answer-form").addEventListener("submit", event => {
        event.preventDefault();
        if (!activeProblem) return;
        const { variant, key, task } = activeProblem;
        if (answer.value.trim() !== task.answer.split(" ")[0]) {
            feedback.textContent = "Пока неверно. Попробуй ещё раз.";
            return;
        }

        const done = solved.get(variant.id) ?? new Set();
        done.add(key);
        solved.set(variant.id, done);
        feedback.textContent = "Верно!";
        show(variant, false);
        renderLists();
    });

    return {
        show,
        fromHash: hash => variants.find(variant => `#exam-${variant.id}` === hash),
        closeProblem: () => { if (dialog.open) dialog.close(); },
    };
}
