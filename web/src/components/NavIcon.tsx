import type { ComponentChildren } from 'preact';

const ICONS: Record<string, ComponentChildren> = {
    'user-round': <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.7-3.1 3.1-5 7-5s6.3 1.9 7 5" />
    </>,
    'calendar-days': <>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M7.5 3v4M16.5 3v4M3.5 10h17M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" />
    </>,
    target: <>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4.5" />
        <circle cx="12" cy="12" r="1" />
    </>,
    swords: <>
        <path d="m14.5 5.5 4-2 .0 4-9.8 9.8-2.8-2.8 8.6-8.6ZM5.5 14.5l-2 4 4-.0 2.2-2.2M14 14l5 5M17 12l-5 5M4 4l5 5" />
    </>,
    'users-round': <>
        <path d="M16 20v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V20M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM16 4.5a3.5 3.5 0 0 1 0 6.8M17 14.5a4 4 0 0 1 3 4V20" />
    </>,
    'calendar-range': <>
        <rect x="3.5" y="5" width="17" height="16" rx="2.5" />
        <path d="M7.5 3v4M16.5 3v4M3.5 10h17M7 14h4M7 17h7" />
    </>,
    trophy: <>
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 7H4v2a4 4 0 0 0 4 4M17 7h3v2a4 4 0 0 1-4 4" />
    </>,
    'clipboard-list': <>
        <rect x="5" y="4" width="14" height="17" rx="2" />
        <path d="M9 4.5h6a1.5 1.5 0 0 0-1.5-1.5h-3A1.5 1.5 0 0 0 9 4.5ZM9 10h6M9 14h6M9 18h3" />
    </>,
    eye: <>
        <path d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z" />
        <circle cx="12" cy="12" r="2.7" />
    </>,
};

export function NavIcon({ name }: { name: string }) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            {ICONS[name] ?? ICONS.target}
        </svg>
    );
}
