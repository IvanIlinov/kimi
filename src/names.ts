export function normalizeName(name: string): string {
    return name.trim().replace(/\p{L}/u, (letter) => letter.toUpperCase());
}
