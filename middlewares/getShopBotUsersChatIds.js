export default async function getShopBotUsersChatIds(db) {
    return await new Promise(async (resolve, reject) => {       
        await db.all('SELECT chatId FROM shop_users WHERE status = ?', ['user'], (err, rows) => {
            if (err) {
                console.error('Error fetching user:', err);
                reject(err);
            } else {
                // Check if any rows were returned
                if (rows && rows.length > 0) {
                    // If there are rows, return the user
                    const userIdsArr = rows.map((userId) => userId.chatId);
                    resolve(userIdsArr);
                } else {
                    // If no rows were found, return null
                    resolve(null);
                }
            }
        });
    });
}