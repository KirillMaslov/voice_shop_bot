import {
    channelChatId,
    creatorNick,
    cryptoBotAPIKey,
    shopBotAdminCommands
} from "../config.js";
import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import {
    shopBotMainMenuKeyboardEn,
    shopBotMainMenuKeyboardRu,
    shopBotOwnCabinetMenuEn,
    shopBotOwnCabinetMenuRu
} from "../utils/keyboards.js";
import CryptoBotAPI from 'crypto-bot-api';
import shopBot from "../utils/shopBot.js";
import getShopBotAdminsFromDb from "../middlewares/getShopBotAdminsFromDb.js";
import getShopBotUsersCountFromDb from "../middlewares/getShopBotUsersCountFromDb.js";
import getRoundBotUserOrNullByChatId from "../middlewares/getRoundBotUserOrNullByChatId.js";


const CryptoBotClient = new CryptoBotAPI(cryptoBotAPIKey);

export default async function handleShopBotCallbackQuery(db) {
    shopBot.on('callback_query', async (query) => {
        const queryId = query.id;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const foundUserOrNull = await getShopBotUserOrNullByChatId(chatId.toString(), db);
        let alertText = '';
        let messageText = '';
        let resultKeyboard = shopBotMainMenuKeyboardRu;

        if (!foundUserOrNull) {
            return await shopBot.sendMessage('Нажмите /start');
        }

        if (query.data === 'empty') {
            return await shopBot.answerCallbackQuery(queryId);
        }

        if (query.data === 'cancel') {
            await shopBot.answerCallbackQuery(queryId, {
                text: `Вы успешно отменили удаление числа голосовых`,
                show_alert: true,
            });

            return await shopBot.editMessageText('<b>Вы успешно отменили удаление числа голосовых</b>' + '\n\n' + shopBotAdminCommands, {
                inline_keyboard: [],
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
            })
        }

        if (query.data.includes('deleteVoicesToBuy')) {
            const deleteNumId = query.data.split('_')[1];

            try {
                await db.run('DELETE FROM voicesCost WHERE id = ?', [deleteNumId], async function (err) {
                    if (err) {
                        throw new Error(err);
                    }
                });
            } catch (e) {
                throw new Error(e);
            }

            await shopBot.answerCallbackQuery(queryId, {
                text: `Вы успешно удалили возможность купить это количество голосовых из бота`,
                show_alert: true,
            });

            return await shopBot.editMessageText('<b>Вы успешно удалили число голосовых</b>' + '\n\n' + shopBotAdminCommands, {
                inline_keyboard: [],
                parse_mode: "HTML",
                chat_id: chatId,
                message_id: messageId,
            })
        }

        if (query.data.includes('changeLanguage')) {
            const newLanguage = query.data.split('_')[1];

            try {
                await db.run('UPDATE shop_users SET language = ? WHERE chatId = ?', [newLanguage.toLowerCase(), chatId.toString()], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }

                    console.log('language is updated');
                });
            } catch (e) {
                throw new Error(e);
            }

            const {
                usersNum
            } = await getShopBotUsersCountFromDb(db);

            switch (newLanguage) {
                case 'en':
                    messageText = '👨‍💼 <b>Your Profile</b>' + '\n \n' +
                        `🚀 Your unique Telegram ID: <code>${chatId}</code>` + '\n \n' +
                        `<b>Contact the administrator:</b> @${creatorNick}` + '\n \n' +
                        '💡<b>Have suggestions for improving the bot?</b>' + '\n' +
                        '💡<b>Share your ideas with the administrator!</b>' + '\n \n' +
                        `👥 Total number of users: ${usersNum}` + '\n \n' +
                        `⏳ You have recorded: <b>${foundUserOrNull.totalVoicesRecorded}</b> voice messages` + '\n \n' +
                        `🥳 You have <b>${foundUserOrNull.voicesAvaliable}</b> available voice messages left` + '\n' +
                        '🤬 Not satisfied with the quality of the voice message? 🤗 <b>We will replace it!</b>' + '\n' +
                        'Contact the administrator for a replacement.';
                    alertText = "You've chosen the language 🇬🇧";
                    resultKeyboard = shopBotOwnCabinetMenuEn;
                    break;
                case "ru":
                    messageText = '👨‍💼 <b>Ваш профиль</b>' + '\n \n' +
                        `🚀 Ваш уникальный Telegram ID: <code>${chatId}</code>` + '\n \n' +
                        `<b>Связь с администратором:</b> @${creatorNick}` + '\n \n' +
                        '💡<b>Есть предложения по улучшению бота?</b>' + '\n' +
                        '💡<b>Поделитесь своими идеями с администратором!</b>' + '\n \n' +
                        `👥 Общее количество пользователей: ${usersNum}` + '\n \n' +
                        `⏳ За все время вы записали: <b>${foundUserOrNull.totalVoicesRecorded}</b> голосовых сообщений` + '\n \n' +
                        `🥳 У вас осталось <b>${foundUserOrNull.voicesAvaliable}</b> доступных голосовых сообщений` + '\n' +
                        '🤬 Не устроило качество голосового сообщения? 🤗 <b>Мы его заменим!</b>' + '\n' +
                        'Свяжитесь с администратором для замены.';
                    alertText = "Вы выбрали язык 🇷🇺";
                    resultKeyboard = shopBotOwnCabinetMenuRu;
                    break;
            }

            await shopBot.answerCallbackQuery(queryId, {
                text: alertText,
                show_alert: true,
            });

            await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIZnDmYekukDQq1QCkH1_zvJ_-FPvQACSVwAAvuvaEgodF_trkXaUjYE", {
                reply_markup: {
                    keyboard: resultKeyboard,
                    resize_keyboard: true
                }
            });

            return await shopBot.sendMessage(chatId, messageText, {
                parse_mode: "HTML",
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

        if (query.data === 'check_subscription') {
            const chatMembership = await shopBot.getChatMember(channelChatId, chatId);
            const roundBotMembership = await getRoundBotUserOrNullByChatId(chatId.toString());

            const avaliableNumber = foundUserOrNull.voicesAvaliable;

            switch (foundUserOrNull.language) {
                case 'en':
                    messageText = '👋<b>Hello, hero! I am a bot that turns text into powerful voice messages, like Hades cutting chains with a single strike! 💪⚡️</b>' + '\n \n' +
                        `Creator: @${creatorNick}, the master of sound! 🎤🔥` + '\n \n' +
                        `You have <b>${avaliableNumber}</b> free voice messages — use them wisely, like Hades uses his power! 🏆💥 Ready to create something epic? Then let’s go! 🎧✨`;
                    resultKeyboard = shopBotMainMenuKeyboardEn;
                    alertText = 'Channel subscription not found, please subscribe to the channel and press the button again';

                    break;
                case "ru":
                    messageText = '👋<b>👋 Привет, герой! Я бот, который превращает текст в мощные голосовые сообщения, словно Аид одним движением разрубает цепи! 💪⚡️</b>' + '\n \n' +
                        `Создатель: @${creatorNick}, , мастер звука! 🎤🔥` + '\n \n' +
                        `У тебя есть <b>${avaliableNumber}</b> бесплатных голосовых сообщений — используй их с умом, как Аид использует свою силу! 🏆💥 Готов создать что-то эпическое? Тогда вперед! 🎧✨`;
                    resultKeyboard = shopBotMainMenuKeyboardRu;
                    alertText = 'Подписка на канал не найдена, подпишитесь на канал и нажмите кнопку повторно';
                    break;
            }

            if (chatMembership.status !== 'left' && roundBotMembership) {
                switch (foundUserOrNull.language) {
                    case 'en':
                        alertText = 'You have successfully subscribed to the channel';
                        break;
                    case "ru":
                        alertText = 'Вы успешно подписались на канал';
                        break;
                }
                await shopBot.answerCallbackQuery(queryId, {
                    text: alertText,
                    show_alert: true,
                });

                await shopBot.deleteMessage(chatId, messageId);

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIpnDmZuToviJWSuPB_N-oVGbci7IQACNFkAAjiScEjRPtOS1bNCfTYE");

                return await shopBot.sendAnimation(chatId, './images/intro.MP4', {
                    parse_mode: "HTML",
                    caption: messageText,
                    reply_markup: {
                        keyboard: resultKeyboard,
                        resize_keyboard: true
                    }
                });
            }

            return await shopBot.answerCallbackQuery(queryId, {
                text: alertText,
                show_alert: true,
            });

        }

        if (query.data.includes('changeStatisticOfTagsArr')) {
            const iterator = Number(data.split('_')[1]);
            const cycleNum = iterator * 5;

            const tagsArr = await getAllRefferalTagsList(db);

            const keyboard = [];

            for (let i = cycleNum; i < cycleNum + 5; i++) {
                if (tagsArr[i]) {
                    keyboard.push([{
                        text: `${tagsArr[i].tag} - пришло людей ${tagsArr[i].count}`,
                        callback_data: `empty`
                    }])
                }
            }

            const navigationButtons = [];

            if (iterator > 0) {
                navigationButtons.push({
                    text: `<<`,
                    callback_data: `changeStatisticOfTagsArr_${iterator - 1}`
                })
            }

            if (tagsArr.length > cycleNum + 5) {
                navigationButtons.push({
                    text: `>>`,
                    callback_data: `changeStatisticOfTagsArr_${iterator + 1}`
                });
            }

            keyboard.push(navigationButtons);

            await shopBot.editMessageReplyMarkup({
                inline_keyboard: tagsArr.length ? keyboard : [
                    [{
                        text: "В боте нету тегов",
                        callback_data: 'empty'
                    }]
                ]
            }, {
                chat_id: chatId,
                message_id: messageId
            });
        }

        if (query.data.includes('checkCryptoBotPayment')) {
            const voicesNumber = query.data.split('_')[1];
            const invoiceId = query.data.split('_')[2];

            const newInvoice = await CryptoBotClient.getInvoices({
                asset: "USDT",
                invoice_ids: [invoiceId],
                count: 1
            });

            if (newInvoice.items[0].status === 'active') {
                switch (foundUserOrNull.language) {
                    case 'en':
                        alertText = 'You haven’t paid for the voice messages yet! Please make the payment using the link below the message';
                        break;
                    case "ru":
                        alertText = 'Вы ещё не оплатили голосовые! Оплатите его по ссылке под сообщением';
                        break;
                }

                return await shopBot.answerCallbackQuery(queryId, {
                    text: alertText,
                    show_alert: true,
                });
            }

            const adminsArr = await getShopBotAdminsFromDb(db);

            try {
                await db.run('UPDATE shop_users SET voicesAvaliable = ? WHERE chatId = ?', [Number(foundUserOrNull.voicesAvaliable) + Number(voicesNumber), chatId.toString()], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }

                    console.log('voicesAvaliable is updated');
                });
            } catch (e) {
                throw new Error(e);
            }

            try {
                for (const admin of adminsArr) {
                    await shopBot.sendMessage(admin.chatId, `💸 <b>Только что была совершена оплата ${voicesNumber} Голосовых</b>` + '\n' +
                        `Название: ${voicesNumber}, Цена: ${newInvoice.items[0].amount} USDT` + '\n \n' +
                        `Покупатель: ${query.from.first_name}. Username: ${query.from.username ? `@${query.from.username}` : '<code>НЕТУ ЮЗЕРНЕЙМА</code>'}, ChatId <code>${chatId}</code>`, {
                            parse_mode: "HTML"
                        }
                    );
                }
            } catch (e) {
                console.log(e);
            }

            switch (foundUserOrNull.language) {
                case 'en':
                    alertText = '💸 Your purchase was successfully completed!';
                    messageText = '💸 <b>Your purchase was successfully completed!</b>.' + "\n" +
                        '🥰 <b><i>The number of voice messages available to you has been updated</i></b>';
                    break;
                case "ru":
                    alertText = '💸 Ваша покупка успешно завершена!';
                    messageText = '💸 <b>Ваша покупка успешно завершена!</b>.' + "\n" +
                        '🥰 <b><i>Число доступных вам голосовых было изменено</i></b>';
                    break;
            }


            await shopBot.answerCallbackQuery(queryId, {
                text: alertText,
                show_alert: true,
            });

            return await shopBot.editMessageText(messageText, {
                chat_id: chatId,
                message_id: messageId,
                parse_mode: "HTML",
                reply_markup: {
                    inline_keyboard: []
                }
            });
        }

    });
}