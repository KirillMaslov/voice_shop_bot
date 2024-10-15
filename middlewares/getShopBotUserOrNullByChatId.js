export default function getShopBotUserOrNullByChatId(chatId, db) {
    return new Promise(async (resolve, reject) => {
        const sql = `SELECT * FROM shop_users WHERE chatId = ?`;

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
    });
}