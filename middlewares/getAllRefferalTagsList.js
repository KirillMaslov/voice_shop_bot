export default async function getAllRefferalTagsList(db) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM refferalTags ORDER BY count DESC`;

        db.all(sql, (err, row) => {
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