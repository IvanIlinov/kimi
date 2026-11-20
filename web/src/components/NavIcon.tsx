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
    layers: <path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5" />,
    crystal: <path d="m12 2 7 6v8l-7 6-7-6V8Zm0 0 3 9-3 11-3-11Zm-7 6 4 3h6l4-3" />,
    spark: <path d="M12 3c0 5-4 9-9 9 5 0 9 4 9 9 0-5 4-9 9-9-5 0-9-4-9-9Z" />,
    award: <><circle cx="12" cy="9" r="5" /><path d="m8 13-2 8 6-3 6 3-2-8M12 7v4m-2-2h4" /></>,
    crown: <path d="m3 7 5 4 4-7 4 7 5-4-2 10H5L3 7Zm3 13h12" />,
    map: <path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3Zm6-3v15m6-12v15" />,
    bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z" />,
    check: <path d="m5 12 4 4L19 6" />,
    'arrow-right': <path d="M4 12h16m-6-6 6 6-6 6" />,
    hourglass: <path d="M6 3h12M6 21h12M7 3v3a4 4 0 0 0 1.5 3.1L12 12l3.5-2.9A4 4 0 0 0 17 6V3M7 21v-3a4 4 0 0 1 1.5-3.1L12 12l3.5 2.9A4 4 0 0 1 17 18v3" />,
    wallet: <>
        <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v10H6a2 2 0 0 1-2-2V6" />
        <path d="M21 12h-5a2 2 0 0 0 0 4h5m-5-2h.01" />
    </>,
    'arrow-left': <path d="M20 12H4m6-6-6 6 6 6" />,
    'arrow-down-up': <path d="M7 4v15m-4-4 4 4 4-4m6 5V5m-4 4 4-4 4 4" />,
    plus: <path d="M12 5v14M5 12h14" />,
    pencil: <path d="m4 16 11-11a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4ZM13 7l4 4" />,
    trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" />,
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
