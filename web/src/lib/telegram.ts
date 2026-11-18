import { useEffect } from 'preact/hooks';

interface TgWebApp {
    initData: string;
    ready(): void;
    expand(): void;
    setHeaderColor?(color: string): void;
    setBackgroundColor?(color: string): void;
    HapticFeedback?: {
        impactOccurred(style: 'light' | 'medium'): void;
        notificationOccurred(type: 'success' | 'error'): void;
    };
    BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
}

const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;

// Подпись, которую сервер проверяет на каждый запрос. Вне Telegram она пустая.
export const initData = tg?.initData ?? '';
export const insideTelegram = initData !== '';

export function initTelegram(): void {
    tg?.ready();
    tg?.expand();
    tg?.setHeaderColor?.('#0a0b0d');
    tg?.setBackgroundColor?.('#0a0b0d');
}

export const haptic = {
    tap: () => tg?.HapticFeedback?.impactOccurred('light'),
    ok: () => tg?.HapticFeedback?.notificationOccurred('success'),
    error: () => tg?.HapticFeedback?.notificationOccurred('error'),
};

// Системная кнопка «назад» Telegram: показывается, пока передан обработчик
export function useBackButton(onBack: (() => void) | null): void {
    useEffect(() => {
        const btn = tg?.BackButton;
        if (!btn || !onBack) {
            btn?.hide();
            return;
        }
        btn.show();
        btn.onClick(onBack);
        return () => {
            btn.offClick(onBack);
            btn.hide();
        };
    }, [onBack]);
}
