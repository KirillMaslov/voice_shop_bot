import openRoundBotDbConnection from "../utils/openRoundBotDbConnection.js";

export default function getRoundBotUserOrNullByChatId(chatId) {
    return new Promise(async (resolve, reject) => {
        const sql = `SELECT * FROM users WHERE chatId = ?`;
        const db = await openRoundBotDbConnection();

        await db.get(sql, [chatId], (err, row) => {
            if (err) {
                console.error('Error fetching user:', err);
                reject(err);
            } else {
                // Check if any rows were returned
                if (row) {
                    // If there are rows, return the user
                    resolve(row);
                } else {
                    // If no rows were found, return null
                    resolve(null);
                }
            }
        });

        await db.close();
    });
}