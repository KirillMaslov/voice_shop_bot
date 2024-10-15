export default async function getShopBotAdminsFromDb(db) {
    return new Promise((resolve, reject) => {
        db.all(`SELECT * FROM shop_users WHERE status = ?`, ['admin'], (err, rows) => {
            if (err) {
                throw new Error(err);
            } else {
                // Check if any rows were returned
                if (rows && rows.length > 0) {
                    // If there are rows, return the user
                    console.log(rows);
                    resolve(rows);
                } else {
                    // If no rows were found, return null
                    resolve(null);
                }
            }
        });
    });
}