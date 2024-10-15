export default async function createUsersTable(db) {
    try {
        await db.run(`
            CREATE TABLE IF NOT EXISTS shop_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chatId TEXT UNIQUE,
                status TEXT DEFAULT 'user',
                voicesAvaliable NUMBER DEFAULT 3,
                totalVoicesRecorded NUMBER DEFAULT 0,
                refferal_id TEXT DEFAULT '',
                isSubscribed NUMBER DEFAULT 0,
                isBlocked NUMBER DEFAULT 0
            )
        `);

        await db.run(`
            CREATE TABLE IF NOT EXISTS voicesCost (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                number INTEGER DEFAULT 0,
                cost INTEGER DEFAULT 0
            )
        `);
    } catch (e) {
        console.log('error with creating tables in DataBase', e);
    }
}