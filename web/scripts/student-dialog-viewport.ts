import { useEffect } from 'preact/hooks';

export function useStudentDialogViewport(enabled: boolean) {
    useEffect(() => {
        if (!enabled || !matchMedia('(pointer: coarse)').matches) return;
        const visualViewport = window.visualViewport;
        const screen = document.querySelector<HTMLElement>('.tablet-home');
        if (!visualViewport || !screen) return;
        const viewport = visualViewport;
        const home = screen;

        let baseline = 0;
        let frame = 0;

        function answerIsFocused() {
            const focused = document.activeElement;
            return focused instanceof HTMLInputElement && !focused.readOnly &&
                focused.closest('.tablet-home dialog[open]') !== null;
        }

        function reset() {
            baseline = 0;
            delete document.body.dataset.tabletTyping;
            delete document.body.dataset.tabletKeyboard;
            home.style.removeProperty('--tablet-stable-height');
            home.style.removeProperty('--tablet-keyboard-top');
            home.style.removeProperty('--tablet-keyboard-height');
        }

        function update() {
            frame = 0;
            if (!baseline) return;
            if (baseline - viewport.height > 70) {
                document.body.dataset.tabletKeyboard = '';
                home.style.setProperty('--tablet-keyboard-top', `${Math.round(viewport.offsetTop) + 8}px`);
                home.style.setProperty('--tablet-keyboard-height', `${Math.max(0, Math.floor(viewport.height) - 16)}px`);
            } else if (!answerIsFocused()) {
                reset();
            } else {
                delete document.body.dataset.tabletKeyboard;
            }
        }

        function scheduleUpdate() {
            if (!frame && baseline) frame = requestAnimationFrame(update);
        }

        function start() {
            if (!baseline && answerIsFocused()) {
                baseline = viewport.height;
                home.style.setProperty('--tablet-stable-height', `${home.offsetHeight}px`);
                document.body.dataset.tabletTyping = '';
            }
            scheduleUpdate();
        }

        home.addEventListener('focusin', start);
        home.addEventListener('focusout', scheduleUpdate);
        home.addEventListener('close', scheduleUpdate, true);
        viewport.addEventListener('resize', scheduleUpdate);
        viewport.addEventListener('scroll', scheduleUpdate);
        window.addEventListener('orientationchange', reset);
        return () => {
            if (frame) cancelAnimationFrame(frame);
            reset();
            home.removeEventListener('focusin', start);
            home.removeEventListener('focusout', scheduleUpdate);
            home.removeEventListener('close', scheduleUpdate, true);
            viewport.removeEventListener('resize', scheduleUpdate);
            viewport.removeEventListener('scroll', scheduleUpdate);
            window.removeEventListener('orientationchange', reset);
        };
    }, [enabled]);
}
