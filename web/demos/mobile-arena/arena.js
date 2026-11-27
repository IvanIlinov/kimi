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
