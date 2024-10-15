export default async function giveShopUserAdminStatus(chatId, db) {
    db.run('UPDATE shop_users SET status = ? WHERE chatId = ?', ['admin', chatId], (err) => {
        if (err) {
            console.error('Error fetching user:', err);
        }
    });
}