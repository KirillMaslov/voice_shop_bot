import sqlite3 from 'sqlite3';

const sqlite3Verbose = sqlite3.verbose();

export default async function openConnection() {
    return new sqlite3Verbose.Database('./database.db', sqlite3Verbose.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message);
        }
    });
}