# PROJECT QUICKSTART

## Проект

«Арена» — Telegram-бот и Mini App для самостоятельной подготовки к ЕГЭ по информатике.

Репозиторий: `IvanIlinov/kimi`.

## Технологии

- Backend: Node.js, TypeScript.

- Frontend: Preact, TypeScript, Vite.

- База данных: SQLite (`node:sqlite`).

- Интеграция: Telegram Bot API и Telegram Web Apps API.

- Инфраструктура: VPS, Caddy, systemd; frontend размещается на Vercel.

## Структура

- `src/` — Backend, API, бизнес-логика и работа с БД.

- `web/` — Frontend Mini App.

- `data/` — данные приложения.

- `deploy/` — файлы развёртывания.

- `docs/` — документация проекта для AI-агента.

Основные точки входа:

- `src/index.ts` — запуск Backend.

- `src/db.ts` — база данных.

- `src/logic.ts` — бизнес-логика.

- `src/api/` — HTTP API.

- `web/src/App.tsx` — корневой компонент Mini App.

## Локальный запуск и проверки

Нужен Node.js 22.18 или новее. Из корня репозитория установи зависимости backend и Mini App:

```bash
npm ci
npm ci --prefix web
```

Проверки из корня репозитория:

```bash
node --disable-warning=ExperimentalWarning --test src/*.test.ts src/api/*.test.ts
npx --no-install tsc --noEmit
npm run build --prefix web
```

Тесты и сборка запускаются без Telegram-токена. Для запуска backend с ботом
создай локальный файл `.env` с настройками тестового окружения и выполни `npm start`.

| Переменная | Назначение | Пример без секретов |
| --- | --- | --- |
| `BOT_TOKEN` | Обязательный токен тестового бота | `<токен тестового бота>` |
| `ADMIN_IDS` | Обязательные числовые Telegram ID администраторов через запятую | `111111,222222` |
| `MINIAPP_URL` | HTTPS-адрес Mini App, который открывает бот | `https://miniapp.example.test` |
| `STAGING_PREVIEW_ENABLED` | Включает предпросмотр гостя и ученика в Mini App. Задавать только в тестовом окружении | `1` |
| `API_PORT` | Порт API. При 0 API отключён | `3000` |
| `API_HOST` | Адрес, на котором слушает API | `127.0.0.1` |
| `ALLOWED_ORIGINS` | Разрешённые адреса фронтенда через запятую | `https://miniapp.example.test` |
| `DB_PATH` | Путь к отдельной локальной базе | `data/local.db` |
| `GROUP_CHAT_ID` | Telegram ID тестовой группы для групповых функций | `0` |
| `VITE_API_URL` | Адрес API для сборки фронтенда, задаётся в окружении Vite или Vercel | `https://api.example.test` |

## Предпросмотр Mini App

- **В обычном браузере.** Из корня проекта выполни `npm run demo --prefix web` для демо ученика или `npm run demo --prefix web -- --admin` для демо администратора. Открой `web/demos/student-home.html` или `web/demos/admin-home.html` в браузере. Повторная сборка обновляет соответствующий файл. Демо используют вымышленные данные. Изменения в демо сбрасываются после обновления страницы. Для сохранения реальных данных нужен тестовый бот.
- **В Telegram.** Открой Mini App через тестового бота после выкладки backend и frontend на Staging. Так проверяются вход через Telegram, сохранение результатов и поведение интерфейса на телефоне.

## Git и окружения

Рабочая ветка разработки: `development`.

- `development` — Staging.

- `main` — Production.

Локальная работа с проектом ведётся в `development`.

## Выкладка в Staging

Порядок обновления ветки на VPS, команды для `arena-staging.service`
и проверка Mini App описаны в разделе
[«Выкладка в Staging»](PROJECT%20CONTEXT.md#выкладка-в-staging).

## Важные правила

1. Не изменять Production и не выполнять операции на Production без явного разрешения.

2. Не выполнять `commit`, `push`, `merge` и другие Git-операции, изменяющие удалённый репозиторий, без разрешения.

3. Не раскрывать содержимое `.env`, `.env.staging`, токены, секреты и приватные идентификаторы.

4. Не перезаписывать и не удалять пользовательские изменения.

5. Перед изменениями изучать соответствующий код и связанные тесты.

6. После изменений выполнять подходящие проверки.

7. Не считать документацию точнее актуального кода и тестов.

## Источники истины

Приоритет информации:

1. Актуальный код и схема БД.

2. Тесты и фактическое поведение приложения.

3. [`PROJECT CONTEXT.md`](PROJECT%20CONTEXT.md).

4. [`PROJECT_ROADMAP.md`](PROJECT_ROADMAP.md).

5. Этот файл.

Если документация противоречит реализации, сообщить об этом и не менять поведение самостоятельно.
