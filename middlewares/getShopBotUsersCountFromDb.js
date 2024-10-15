export default function getShopBotUsersCountFromDb(db) {
    return new Promise(async (resolve, reject) => {
        const sql = `SELECT COUNT(*) AS usersNum FROM shop_users`;

        await db.all(sql, (err, row) => {
            if (err) {
                console.error('Error fetching user:', err);
                reject(err);
            } else {
                // Check if any rows were returned
                if (row) {
                    // If there are rows, return the user
                    resolve(row[0]);
                } else {
                    // If no rows were found, return null
                    resolve(null);
                }
            }
        });
    });
}