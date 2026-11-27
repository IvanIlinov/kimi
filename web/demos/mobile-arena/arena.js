const arena = document.querySelector(".arena");
const layouts = document.querySelectorAll(".variants a");

function showLayout() {
    const layout = location.hash === "#rail" ? "rail" : "deck";
    arena.dataset.layout = layout;

    for (const link of layouts) {
        if (link.hash === `#${layout}`) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
    }
}

window.addEventListener("hashchange", showLayout);
showLayout();

const screenButtons = document.querySelectorAll("[data-screen]");
for (const button of screenButtons) {
    button.addEventListener("click", () => {
        for (const item of screenButtons) {
            document.getElementById(item.dataset.screen).hidden = item !== button;
            if (item === button) item.setAttribute("aria-current", "page");
            else item.removeAttribute("aria-current");
        }
    });
}

const goals = {
    week: { value: 18, max: 25, period: "недели", label: "Решено задач за неделю" },
    month: { value: 67, max: 100, period: "месяца", label: "Решено задач за месяц" },
};
const periodButtons = document.querySelectorAll("[data-period]");
const meter = document.getElementById("goal-meter");

for (const button of periodButtons) {
    button.addEventListener("click", () => {
        const { value, max, period, label } = goals[button.dataset.period];
        for (const item of periodButtons) item.setAttribute("aria-pressed", String(item === button));

        meter.max = max;
        meter.value = value;
        meter.setAttribute("aria-label", label);
        document.getElementById("goal-count").textContent = `${value} / ${max}`;
        document.getElementById("goal-remaining").textContent = `Ещё ${max - value} задач до цели ${period}`;
    });
}

const grid = document.getElementById("topic-grid");
const statuses = ["Не изучено", "В изучении", "Изучено", "Закреплено"];
for (let number = 1; number <= 27; number++) {
    const tile = document.createElement("button");
    let status = number <= 14 ? 3 : number <= 17 ? 2 : number <= 21 ? 1 : 0;

    function showStatus() {
        tile.dataset.status = status;
        tile.setAttribute("aria-label", `Задание ${number}. ${statuses[status]}`);
    }

    tile.textContent = number;
    tile.addEventListener("click", () => {
        status = (status + 1) % statuses.length;
        showStatus();
    });
    showStatus();
    grid.append(tile);
}
