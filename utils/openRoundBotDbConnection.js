import sqlite3 from 'sqlite3';

const sqlite3Verbose = sqlite3.verbose();

export default async function openRoundBotDbConnection() {
    return new sqlite3Verbose.Database('../round_bot/database.db', sqlite3Verbose.OPEN_READWRITE, (err) => {
        if (err) {
            return console.error(err.message);
        }
    });
}