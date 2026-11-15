import { db } from './db.ts';

const table = process.argv[2] ?? 'users';
console.table(db.prepare(`SELECT * FROM ${table}`).all());