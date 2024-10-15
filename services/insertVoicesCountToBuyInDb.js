export default async function insertVoicesCountToBuyInDb(voicesNumber, cost, db) {
    return await new Promise((resolve, reject) => {
        try {
            const sql = `
                INSERT INTO voicesCost (
                    number,
                    cost
                )
                VALUES(?, ?)
            `;

            db.run(sql, [voicesNumber, cost], function (err) {
                if (err) {
                    return console.log(err);
                }
            });
        } catch (e) {
            throw new Error(e);
        }
    });
}