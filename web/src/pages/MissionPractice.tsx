import { useState } from 'preact/hooks';

const PRACTICE: Record<number, { title: string; question: string; answer: number; hint: string; explanation: string }> = {
    4: {
        title: 'Двоичное кодирование',
        question: 'Символы А, Б и В имеют коды 0, 100 и 101. Какова минимальная длина кода для символа Г, чтобы ни один код не был началом другого?',
        answer: 2,
        hint: 'Ветка с первым битом 0 уже занята целиком. Нарисуй двоичное дерево.',
        explanation: 'Оба одноразрядных варианта заняты или служат началом кода. Слово 11 свободно и подходит.',
    },
    7: {
        title: 'Объём изображения',
        question: 'Сколько КиБ займёт растровое изображение 128 × 64 пикселя с палитрой из 16 цветов? Сжатия и служебных данных нет.',
        answer: 4,
        hint: 'Для кодирования 16 цветов нужно 4 бита на пиксель. В одном КиБ 1024 байта.',
        explanation: '128 × 64 × 4 = 32 768 бит. Делим на 8 и на 1024, получаем 4 КиБ.',
    },
    11: {
        title: 'Кодирование идентификаторов',
        question: 'Идентификатор состоит из 12 символов алфавита из 20 знаков. На каждый символ отводят одинаковое минимальное число бит. Сколько целых байтов нужно на один идентификатор?',
        answer: 8,
        hint: 'Подбери минимальную степень двойки, покрывающую 20 знаков.',
        explanation: 'Для одного знака нужно 5 бит, для 12 знаков — 60 бит. После округления вверх требуется 8 байтов.',
    },
    1: {
        title: 'Маршрут по графу',
        question: 'Между узлами есть двусторонние переходы А–Б (6), А–В (3), В–Б (2), Б–Г (4) и В–Г (9). Чему равна длина кратчайшего маршрута из А в Г?',
        answer: 9,
        hint: 'Сравни маршрут через один промежуточный узел и маршрут через два.',
        explanation: 'Маршрут А → В → Б → Г имеет длину 3 + 2 + 4 = 9. Другие простые маршруты длиннее.',
    },
};

export function MissionPractice({ mission }: { mission: number }) {
    const [answer, setAnswer] = useState('');
    const [checked, setChecked] = useState(false);
    const exercise = PRACTICE[mission];
    if (!exercise) return null;

    const valid = /^\d+$/.test(answer.trim());
    const correct = Number(answer) === exercise.answer;

    return (
        <details class="mission-practice">
            <summary>Тренировка · {exercise.title}</summary>
            <p>{exercise.question}</p>
            <form onSubmit={(event) => {
                event.preventDefault();
                if (valid) setChecked(true);
            }}>
                <div class="exam">
                    <input aria-label="Числовой ответ" inputMode="numeric" value={answer}
                        onInput={(event) => { setAnswer(event.currentTarget.value); setChecked(false); }} />
                    <button class="chip primary" disabled={!valid}>Проверить</button>
                </div>
            </form>
            <details class="mission-hint">
                <summary>Подсказка</summary>
                <p>{exercise.hint}</p>
            </details>
            <div aria-live="polite">
                {checked && <p class={correct ? 'mission-correct' : 'warn'}>
                    {correct ? `Верно! ${exercise.explanation}` : 'Ответ пока не сходится. Попробуй ещё раз.'}
                </p>}
            </div>
        </details>
    );
}
