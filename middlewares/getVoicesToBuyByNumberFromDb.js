export default function getVoicesToBuyByNumberFromDb(countOfVoices, db) {
    return new Promise(async (resolve, reject) => {
        const sql = `SELECT * FROM voicesCost WHERE number = ?`;

        await db.get(sql, [Number(countOfVoices)], (err, row) => {
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