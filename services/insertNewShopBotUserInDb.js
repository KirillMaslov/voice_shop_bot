export default async function insertNewShopBotUserInDb(chatId, refferalChatId, db) {
    try {
        const sql = `
            INSERT INTO shop_users (
                chatId,
                refferal_id
            )
            VALUES(?, ?)
        `;

        await db.run(sql, [
            chatId.toString(),
            refferalChatId
        ], function (err) {
            if (err) {
                return console.error(err.message);
            }

            console.log(`User with ID ${this.lastID} has been added to the database.`);
        });
    } catch (e) {
        throw new Error(e);
    }
}