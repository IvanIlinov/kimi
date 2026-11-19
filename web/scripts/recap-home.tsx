import { useRef } from 'preact/hooks';
import { StudentHomePage } from '../src/pages/StudentHomePage';
import './recap-home.css';

export function RecapHome({ placement }: { placement: 'button' | 'swipe' }) {
    const picker = useRef<HTMLDialogElement>(null);
    const periods = (
        <div class="recap-entries">
            <button type="button" data-recap data-period="week">
                <strong>{placement === 'swipe' ? 'Неделя' : 'Итоги недели'}</strong><span>23–29 ноября 2026</span>
            </button>
            <button type="button" data-recap data-period="season">
                <strong>{placement === 'swipe' ? 'Сезон' : 'Итоги сезона'}</strong><span>Сентябрь — ноябрь 2026</span>
            </button>
            <button type="button" data-recap data-period="year">
                <strong>{placement === 'swipe' ? 'Год' : 'Итоги года'}</strong><span>2026/27 учебный год</span>
            </button>
        </div>
    );

    if (placement === 'swipe') {
        return <StudentHomePage leadingPage={<section class="swipe-card-recaps" aria-label="Итоги">{periods}</section>} />;
    }

    return (
        <>
            <StudentHomePage monthAction={
                <button class="recap-trigger" type="button" aria-haspopup="dialog"
                    onClick={() => picker.current?.showModal()}>Итоги</button>
            } />
            <dialog class="recap-picker" ref={picker} aria-labelledby="recap-picker-title"
                onClick={(event) => {
                    if (event.target === event.currentTarget) event.currentTarget.close();
                }}>
                <div class="recap-picker-body">
                    <div class="between">
                        <h2 id="recap-picker-title">Итоги</h2>
                        <form method="dialog">
                            <button class="recap-picker-close" aria-label="Закрыть">×</button>
                        </form>
                    </div>
                    {periods}
                </div>
            </dialog>
        </>
    );
}
