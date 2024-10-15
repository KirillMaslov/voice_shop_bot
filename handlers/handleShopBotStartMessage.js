import {
    channelChatId,
    channelLink,
    channelName,
    creatorNick
} from "../config.js";
import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import getShopBotUserRefferalsCount from "../middlewares/getShopBotUserRefferalsCount.js";
import insertNewShopBotUserInDb from "../services/insertNewShopBotUserInDb.js";
import {
    shopBotMainMenuKeyboard
} from "../utils/keyboards.js";
import shopBot from "../utils/shopBot.js";

export default async function handleShopBotStartMessage(db) {
    shopBot.onText(/\/start (.+)|\/start/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const referral_code = match[1];
        const foundUserOrNull = await getShopBotUserOrNullByChatId(chatId.toString(), db);
        console.log(chatId);

        const chatMembership = await shopBot.getChatMember(channelChatId, chatId);

        console.log(chatMembership);

        if (!foundUserOrNull) {
            if (referral_code) {
                const refferalChatId = referral_code.toString();

                try {
                    const foundRefferal = await getShopBotUserOrNullByChatId(refferalChatId, db);

                    if (foundRefferal) {
                        const refferalsCount = await getShopBotUserRefferalsCount(chatId.toString(), db);
                        const newRefferalsNum = Number(refferalsCount) + 1;

                        if (newRefferalsNum % 5 === 0) {
                            await db.run('UPDATE shop_users SET voicesAvaliable = ? WHERE chatId = ?', [Number(foundUserOrNull.voicesAvaliable) + 3, refferalChatId], function (err) {
                                if (err) {
                                    return console.error(err.message);
                                }

                                console.log('voicesAvaliable is updated');
                            });
                        }
                    }
                } catch (e) {
                    throw new Error(e);
                }
            }

            insertNewShopBotUserInDb(chatId.toString(), referral_code ? referral_code.toString() : '', db);
        }

        if (foundUserOrNull && foundUserOrNull.isBlocked) {
            return await shopBot.sendMessage(chatId, `Вы заблокированы в боте. Для разблокировки можете написать @${creatorNick} (https://t.me/${creatorNick})`, {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: 'Написать для разблокировки',
                            url: `https://t.me/${creatorNick}`
                        }]
                    ]
                }
            })
        }
        if (chatMembership.status === 'left') {
            return await shopBot.sendMessage(chatId, '🍓 <b>Ты ещё не подписан на каналы</b>!' + '\n \n' +
                '❗️ <b>Для использования бота подпишись на каналы</b> 👇🏻', {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: channelName,
                            url: channelLink
                        }],
                        [{
                            text: "🔎 Проверить подписку",
                            callback_data: 'check_subscription'
                        }]
                    ]
                }
            })
        }

        const avaliableNumber = foundUserOrNull ? foundUserOrNull.voicesAvaliable : 3;

        await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIpnDmZuToviJWSuPB_N-oVGbci7IQACNFkAAjiScEjRPtOS1bNCfTYE");

        return await shopBot.sendAnimation(chatId, './images/intro.MP4', {
            parse_mode: "HTML",
            caption:  '👋<b>Привет! Я бот, который может преобразовывать текст в голосовое сообщение.</b>' + '\n \n' +
            `Создатель: @${creatorNick}` + '\n \n' +
            `Вам доступно <b>${avaliableNumber}</b> бесплатных голосовых.`,
            reply_markup: {
                keyboard: shopBotMainMenuKeyboard,
                resize_keyboard: true
            }
        });

        // return await shopBot.sendMessage(chatId, '👋<b>Привет! Я бот, который может преобразовывать текст в голосовое сообщение.</b>' + '\n \n' +
        //     `Создатель: @${creatorNick}` + '\n \n' +
        //     `Вам доступно <b>${avaliableNumber}</b> бесплатных голосовых.`, {
        //         parse_mode: "HTML",
        //         reply_markup: {
        //             keyboard: shopBotMainMenuKeyboard,
        //             resize_keyboard: true
        //         }
        //     });
    });
}