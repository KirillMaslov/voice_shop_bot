import {
    channelChatId,
    channelLink,
    channelName,
    creatorNick,
    pegasBotLink
} from "../config.js";
import getBotRefferalsCountByTag from "../middlewares/getBotRefferalsCountByTag.js";
import getRoundBotUserOrNullByChatId from "../middlewares/getRoundBotUserOrNullByChatId.js";
import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import getShopBotUserRefferalsCount from "../middlewares/getShopBotUserRefferalsCount.js";
import insertNewShopBotUserInDb from "../services/insertNewShopBotUserInDb.js";
import {
    shopBotMainMenuKeyboardEn,
    shopBotMainMenuKeyboardRu
} from "../utils/keyboards.js";
import shopBot from "../utils/shopBot.js";

export default async function handleShopBotStartMessage(db) {
    shopBot.onText(/\/start (.+)|\/start/i, async (msg, match) => {
        const chatId = msg.chat.id;
        const referral_code = match[1];
        const foundUserOrNull = await getShopBotUserOrNullByChatId(chatId.toString(), db);

        let messageText = '';
        let resultKeyboard = shopBotMainMenuKeyboardRu;

        const chatMembership = await shopBot.getChatMember(channelChatId, chatId);
        const roundBotMembership = await getRoundBotUserOrNullByChatId(chatId.toString())

        if (!foundUserOrNull) {
            if (referral_code) {
                const refferalChatId = referral_code.toString();

                console.log('found refferal text', refferalChatId);

                try {
                    const foundRefferal = await getShopBotUserOrNullByChatId(refferalChatId, db);

                    console.log('found refferal ', foundRefferal);

                    if (foundRefferal) {
                        const refferalsCount = await getShopBotUserRefferalsCount(foundRefferal.toString(), db);
                        try {
                            await shopBot.sendMessage(refferalChatId, `Пользователь <a href="tg://user?id=${chatId}">${msg.from.first_name}</a> присоединился в бот по вашей реферальной ссылке` + '\n \n' + 
                                '<b>Спасибо за то что приглашаете друзей</b>', {
                                parse_mode: "HTML"
                            })
                        } catch (e) {
                            console.log(e);
                        }

                        console.log('refferalsCount', refferalsCount);
                        const newRefferalsNum = Number(refferalsCount.usersNum) + 1;

                        if (newRefferalsNum % 5 === 0 ) {
                            try {
                                await shopBot.sendMessage(refferalChatId, 'Вы получили 3 голосовых за 5 приведенных новых пользователей. Спасибо что рекомендуете нашего бота друзьям')
    
                                const adminsArr = await getShopBotAdminsFromDb(db);
    
                                for (const admin of adminsArr) {
                                    await shopBot.sendMessage(admin.chatId, `<a href='tg://user?id=${refferalChatId}'>Пользователь</a>. Айди: <code>${chatId}</code>` + '\n \n' +
                                        `Получил 3 голосовых за 5 приведенных рефералов`, {
                                            parse_mode: "HTML"
                                        }
                                    );
                                }
                            } catch (e) {
                                console.log(e);
                            }

                            await db.run('UPDATE shop_users SET voicesAvaliable = ? WHERE chatId = ?', [Number(foundRefferal.voicesAvaliable) + 3, refferalChatId], function (err) {
                                if (err) {
                                    return console.error(err.message);
                                }

                                console.log('voicesAvaliable is updated');
                            });
                        }
                    } else {
                        const refferalsCountByTag = await getBotRefferalsCountByTag(refferalChatId, db);

                        if (refferalsCountByTag) {
                            try {
                                await db.run('UPDATE refferalTags SET count = ? WHERE tag = ?', [Number(refferalsCountByTag.count) + 1, refferalChatId], function (err) {
                                    if (err) {
                                        return console.error(err.message);
                                    }

                                    console.log('language is updated');
                                });
                            } catch (e) {
                                throw new Error(e);
                            }
                        } else {
                            try {
                                const sql = `
                                    INSERT INTO refferalTags (
                                        tag
                                    )
                                    VALUES(?)
                                `;

                                db.run(sql, [refferalChatId], function (err) {
                                    if (err) {
                                        return console.log(err);
                                    }
                                });
                            } catch (e) {
                                throw new Error(e);
                            }
                        }
                    }
                } catch (e) {
                    throw new Error(e);
                }
            }

            insertNewShopBotUserInDb(chatId.toString(), referral_code ? referral_code.toString() : '', db);
        }

        if (!foundUserOrNull) {
            return await shopBot.sendMessage(chatId, 'Please select a language 🇬🇧' + '\n' +
                'Пожалуйста, выберите язык 🇷🇺', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: "🇷🇺 Язык",
                                callback_data: 'changeLanguage_ru'
                            }, {
                                text: "🇬🇧 Language",
                                callback_data: 'changeLanguage_en'
                            }]
                        ],
                    }
                });
        }

        if (foundUserOrNull && foundUserOrNull.isBlocked) {
            switch (foundUserOrNull.language) {
                case 'en':
                    messageText = `You are banned in the bot. To unban, you can contact @${creatorNick} (https://t.me/${creatorNick})`;
                    break;
                case "ru":
                    messageText = `Вы заблокированы в боте. Для разблокировки можете написать @${creatorNick} (https://t.me/${creatorNick})`;
                    break;
            }
            return await shopBot.sendMessage(chatId, messageText, {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: foundUserOrNull.language === 'en' ? 'Write to unban' : 'Написать для разблокировки',
                            url: `https://t.me/${creatorNick}`
                        }]
                    ]
                }
            })
        }

        if (chatMembership.status === 'left' || !roundBotMembership) {
            switch (foundUserOrNull.language) {
                case 'en':
                    messageText = '🍓 <b>You are not subscribed to the channels yet</b>!' + '\n \n' +
                        '❗️ <b>To use the bot, subscribe to the channels</b> 👇🏻';
                    break;
                case "ru":
                    messageText = '🍓 <b>Ты ещё не подписан на каналы</b>!' + '\n \n' +
                        '❗️ <b>Для использования бота подпишись на каналы</b> 👇🏻';
                    break;
            }

            return await shopBot.sendMessage(chatId, messageText, {
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: channelName,
                            url: channelLink
                        }, {
                            text: 'Pegas Bot', 
                            url: pegasBotLink
                        }],
                        [{
                            text: foundUserOrNull.language === 'en' ? '🔎 Check suscribtion' : "🔎 Проверить подписку",
                            callback_data: 'check_subscription'
                        }]
                    ]
                }
            })
        }

        await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIpnDmZuToviJWSuPB_N-oVGbci7IQACNFkAAjiScEjRPtOS1bNCfTYE");

        switch (foundUserOrNull.language) {
            case 'en':
                messageText = '👋<b>Hello, hero! I am a bot that turns text into powerful voice messages, like Hades cutting chains with a single strike! 💪⚡️</b>' + '\n \n' +
                    `Creator: @${creatorNick}, the master of sound! 🎤🔥` + '\n \n' +
                    `You have <b>${foundUserOrNull.voicesAvaliable}</b> free voice messages — use them wisely, like Hades uses his power! 🏆💥 Ready to create something epic? Then let’s go! 🎧✨`;
                resultKeyboard = shopBotMainMenuKeyboardEn;
                break;
            case "ru":
                messageText = '👋<b>👋 Привет, герой! Я бот, который превращает текст в мощные голосовые сообщения, словно Аид одним движением разрубает цепи! 💪⚡️</b>' + '\n \n' +
                    `Создатель: @${creatorNick}, , мастер звука! 🎤🔥` + '\n \n' +
                    `У тебя есть <b>${foundUserOrNull.voicesAvaliable}</b> бесплатных голосовых сообщений — используй их с умом, как Аид использует свою силу! 🏆💥 Готов создать что-то эпическое? Тогда вперед! 🎧✨`;
                resultKeyboard = shopBotMainMenuKeyboardRu;
                break;
        }

        return await shopBot.sendAnimation(chatId, './images/intro.MP4', {
            parse_mode: "HTML",
            caption: messageText,
            reply_markup: {
                keyboard: resultKeyboard,
                resize_keyboard: true
            }
        });
    });
}