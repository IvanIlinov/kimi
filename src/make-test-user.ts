import { db } from './db.ts';

const TEST_TG_ID = 1079824799;
const TEST_NAME = 'тест';

const exists = db.prepare('SELECT id FROM users WHERE tg_id = ?').get(TEST_TG_ID);

if (exists) {
    console.log('Тестовый пользователь уже есть, ничего не делаю');
} else {
    const { lastInsertRowid } = db
        .prepare('INSERT INTO users (tg_id, name) VALUES (?, ?)')
        .run(TEST_TG_ID, TEST_NAME);
    const userId = Number(lastInsertRowid);

    // Как в seed: все 27 заданий есть в таблице, по умолчанию 'todo'
    const insertStatus = db.prepare(
        'INSERT INTO topic_status (user_id, topic_no, status) VALUES (?, ?, ?)',
    );
    for (let topic = 1; topic <= 27; topic++) {
        insertStatus.run(userId, topic, 'todo');
    }

    console.log(`Создан тестовый пользователь, id в базе: ${userId}`);
}