import CryptoBotAPI from 'crypto-bot-api';
import {
    ElevenLabsClient
} from "elevenlabs";
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
import tmp from 'tmp';
import fs from 'fs';
import * as mm from 'music-metadata';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import {
    channelChatId,
    channelLink,
    channelName,
    creatorNick,
    cryptoBotAPIKey,
    elevenLabsApiKey,
    shopBotAdminCommands,
    andreyDescriptionRu,
    leraDescribtionRu,
    annaDescribtionRu,
    andreyDescriptionEn,
    leraDescriptionEn,
    annaDescriptionEn
} from "../config.js";
import shopBot from "../utils/shopBot.js";
import {
    messageForAllShopBotUsers,
    shopBotCategoryToEditListener,
    userToBlockChatIdListener,
    addVoicesNumberToBuyNumberListener,
    addVoicesNumberToBuyCostListener,
    numOfVoicesToBuyListener,
    girlsVoiceTypeListener,
    modelListener,
    textMessageToVoiceListener,
    voiceMessageToVoiceListener,
    numOfVoicesToEditCostListener,
    newCostForVoicesListener
} from "../utils/maps.js";
import giveShopUserAdminStatus from "../services/giveShopUserAdminStatus.js";
import getShopBotUsersCountFromDb from "../middlewares/getShopBotUsersCountFromDb.js";
import getShopBotUsersChatIds from "../middlewares/getShopBotUsersChatIds.js";
import {
    shopBotMainMenuKeyboardEn,
    shopBotMainMenuKeyboardRu,
    shopBotOwnCabinetMenuEn,
    shopBotOwnCabinetMenuRu
} from "../utils/keyboards.js";
import getShopBotUserRefferalsCount from "../middlewares/getShopBotUserRefferalsCount.js";
import getVoicesCosts from "../middlewares/getVoicesWithCost.js";
import getVoicesToBuyByNumberFromDb from "../middlewares/getVoicesToBuyByNumberFromDb.js";
import insertVoicesCountToBuyInDb from '../services/insertVoicesCountToBuyInDb.js';
import getAllRefferalTagsList from '../middlewares/getAllRefferalTagsList.js';

const CryptoBotClient = new CryptoBotAPI(cryptoBotAPIKey);
const elevenlabs = new ElevenLabsClient({
    apiKey: elevenLabsApiKey // Defaults to process.env.ELEVENLABS_API_KEY
})

export default async function handleShopBotMessage(db) {
    shopBot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        const foundUserOrNull = await getShopBotUserOrNullByChatId(chatId.toString(), db);
        // checking access
        if (!foundUserOrNull) {
            return 0;
        }

        let messageText = '';
        let resultKeyboard = shopBotMainMenuKeyboardRu;

        console.log(foundUserOrNull);

        if (!foundUserOrNull.language) {
            try {
                await db.run("ALTER TABLE shop_users ADD COLUMN language TEXT DEFAULT 'ru'", function (err) {
                    if (err) {
                        return console.error(err.message);
                    }

                    console.log('language is updated');
                });
            } catch (e) {
                throw new Error(e);
            }
        }

        // const voices = await elevenlabs.voices.getAll();

        // console.log('Available voices:', voices);

        if (foundUserOrNull.isBlocked) {
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

        const chatMembership = await shopBot.getChatMember(channelChatId, chatId);

        if (chatMembership.status === 'left') {
            if (text !== '/start') {
                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = '🍓 <b>You are not subscribed to the channels yet</b>!' + '\n \n' +
                            '❗️ <b>To use the bot, subscribe to the channels</b> 👇🏻';
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
                            }],
                            [{
                                text: foundUserOrNull.language === 'en' ? '🔎 Check suscribtion' : "🔎 Проверить подписку",
                                callback_data: 'check_subscription'
                            }]
                        ]
                    }
                })
            }

            return 0;
        } // end of checking Access


        // check if user is admin
        if (foundUserOrNull.status === 'admin') {
            switch (text) {
                case '/addVoicesNumberToBuy': {
                    addVoicesNumberToBuyNumberListener.set(chatId.toString(), 'true');

                    return await shopBot.sendMessage(chatId, 'Введите новое число голосовых доступных для покупки' + '\n' +
                        'Если хотите отменить добавление нового количества голосовых для покупки, нажмите "Отменить"', {
                            reply_markup: {
                                keyboard: [
                                    [{
                                        text: "Отменить"
                                    }]
                                ],
                                resize_keyboard: true
                            }
                        });
                }

                case '/deleteVoicesToBuy': {
                    const voicesCostsArr = await getVoicesCosts(db);

                    if (!voicesCostsArr) {
                        return await shopBot.sendMessage(chatId, '<b>В боте нету возможности купить голосовые</b>' + '\n \n' + shopBotAdminCommands);
                    }

                    const voicesMessages = voicesCostsArr ? voicesCostsArr.map((voice) => (`<b>${voice.number}</b> Голосовых 🎙️ - <b>${voice.cost}</b>💲`)).join('\n') : '<b>В боте нету голосовых</b>';

                    const voicesArr = voicesCostsArr ? voicesCostsArr.map((voice) => {
                        return [{
                            text: `Удалить возможность купить - ${voice.number} голосовых 🎙️`,
                            callback_data: `deleteVoicesToBuy_${voice.id}`
                        }];
                    }) : [];

                    voicesArr.push([{
                        text: 'Отменить',
                        callback_data: 'cancel'
                    }])

                    return await shopBot.sendMessage(chatId, 'Выберите количество голосовых, которое вы хотите удалить для покупки' + '\n' +
                        '💸<b>Цены</b>💸' + '\n \n' +
                        voicesMessages, {
                            reply_markup: {
                                inline_keyboard: voicesArr
                            },
                            parse_mode: "HTML",
                            disable_web_page_preview: true
                        }
                    );
                }

                case '/tagsRefferalsStatistics': {
                    const tagsArr = await getAllRefferalTagsList(db);

                    const keyboard = [];

                    for (let i = 0; i < 5; i++) {
                        if (tagsArr[i]) {
                            keyboard.push([{
                                text: `${tagsArr[i].tag} - пришло людей ${tagsArr[i].count}`,
                                callback_data: `empty`
                            }])
                        }
                    }

                    if (tagsArr.length > 5) {
                        keyboard.push([{
                            text: `>>`,
                            callback_data: `changeStatisticOfTagsArr_1`
                        }])
                    }

                    return await shopBot.sendMessage(chatId, 'Внизу собраны все теги которые вы создавали пользователям', {
                        reply_markup: {
                            inline_keyboard: tagsArr.length ? keyboard : [
                                [{
                                    text: "В боте нету тегов",
                                    callback_data: 'empty'
                                }]
                            ]
                        }
                    });
                }

                case '/editVoicesCostToBuy': {
                    const voicesCostsArr = await getVoicesCosts(db);

                    const voicesMessages = voicesCostsArr ? voicesCostsArr.map((voice) => (`<b>${voice.number}</b> Голосовых 🎙️ - <b>${voice.cost}</b>💲`)).join('\n') : '<b>В боте нету голосовых</b>';

                    const voicesArr = voicesCostsArr ? voicesCostsArr.map((voice) => {
                        return [{
                            text: `${voice.number} голосовых 🎙️`
                        }];
                    }) : [];

                    voicesArr.push([{
                        text: '↩️ Назад'
                    }])

                    numOfVoicesToEditCostListener.set(chatId.toString(), 'true')

                    return await shopBot.sendMessage(chatId, 'Выберите количество голосовых, которому хотите изменить цену из клавиатуры ниже' + '\n' +
                        '💸<b>Цены</b>💸' + '\n \n' +
                        voicesMessages, {
                            reply_markup: {
                                keyboard: voicesArr,
                                resize_keyboard: true
                            },
                            parse_mode: "HTML",
                            disable_web_page_preview: true
                        }
                    );
                }
            }

            if (text === '/sendAdvertisingMessage') {
                await shopBot.sendMessage(chatId, 'Введите сообщение для пользователей бота', {
                    reply_markup: {
                        keyboard: [
                            [{
                                text: "Отменить"
                            }]
                        ]
                    }
                });

                return messageForAllShopBotUsers.set(chatId.toString(), 'true');
            }

            if (text === '/statistic') {
                const {
                    usersNum
                } = await getShopBotUsersCountFromDb(db);

                return await shopBot.sendMessage(chatId, '<b>Статистика пользователей</b>' + '\n \n' +
                    `<i>Всего пользователей в боте</i>: ${usersNum}`, {
                        parse_mode: "HTML"
                    }
                );
            }

            if (text === '/editCategoryName') {
                const goodsKeyboard = [];

                const goodsFromDb = await getAllShopCategoriesFromDb(db);

                console.log(goodsFromDb);

                if (goodsFromDb) {
                    for (const good of goodsFromDb) {
                        goodsKeyboard.push([{
                            text: good.name
                        }]);
                    }
                } else {
                    return await shopBot.sendMessage(chatId, '<b>В боте нету категорий. Сначала добавьте категории в бот</b>' + '\n' + shopBotAdminCommands, {
                        parse_mode: "HTML"
                    });
                }

                shopBotCategoryToEditListener.set(chatId.toString(), 'true')

                return await shopBot.sendMessage(chatId, '<b>Выберите категорию из клавиатуры ниже</b>' + '\n \n' +
                    `<i>Нажмите кнопку "Отменить" чтобы изменить название категории</i>`, {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: [
                                ...goodsKeyboard,
                                [{
                                    text: "Отменить"
                                }]
                            ]
                        }
                    }
                );
            }

            if (text === '/changeBlockStatusUser') {
                userToBlockChatIdListener.set(chatId.toString(), 'true');

                return await shopBot.sendMessage(chatId, '<b>Введите чатИД пользователя для которого хотите изменить статус блокировки</b>' + '\n \n' +
                    `<i>Нажмите кнопку "Отменить" чтобы отменить блокировку пользователя</i>`, {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: [
                                [{
                                    text: 'Отменить'
                                }]
                            ]
                        }
                    }
                );
            }

            if (userToBlockChatIdListener.has(chatId.toString())) {
                userToBlockChatIdListener.delete(chatId.toString());

                if (text == 'Отменить') {
                    return await shopBot.sendMessage(chatId, '<b>Вы отменили блокировку пользователя</b>' + '\n' + shopBotAdminCommands, {
                        parse_mode: "HTML",
                        reply_markup: {
                            remove_keyboard: true,
                        }
                    });
                }


                const userToBlock = await getShopBotUserOrNullByChatId(text, db);

                if (!userToBlock) {
                    userToBlockChatIdListener.set(chatId.toString(), 'true');

                    return await shopBot.sendMessage(chatId, '<b>ПОЛЬЗОВАТЕЛЬ НЕ НАЙДЕН!! Введите чатИД пользователя для которого хотите изменить статус блокировки</b>' + '\n \n' +
                        `<i>Нажмите кнопку "Отменить" чтобы отменить блокировку пользователя</i>`, {
                            parse_mode: "HTML",
                            reply_markup: {
                                keyboard: [
                                    [{
                                        text: 'Отменить'
                                    }]
                                ]
                            }
                        }
                    );
                }

                try {
                    await db.run('UPDATE shop_users SET status = ? WHERE chatId = ?', [Number(userToBlock.isBlocked) ? 0 : 1, userToBlock.chatId], function (err) {
                        if (err) {
                            return console.error(err.message);
                        }

                        console.log('language is updated');
                    });
                } catch (e) {
                    throw new Error(e);
                }

                return await shopBot.sendMessage(chatId, `<b>Вы успешно ${Number(userToBlock.isBlocked) ? 'Разблокировали' : 'Заблокировали'} пользователя</b>` + '\n' + shopBotAdminCommands, {
                    parse_mode: "HTML",
                    reply_markup: {
                        remove_keyboard: true,
                    }
                });
            }

            if (addVoicesNumberToBuyNumberListener.has(chatId.toString())) {
                addVoicesNumberToBuyNumberListener.delete(chatId.toString());

                if (text === "Отменить") {
                    return await shopBot.sendMessage(chatId, '<b>Вы отменили добавление нового количества голосовых для покупки</b>' + '\n' + shopBotAdminCommands, {
                        parse_mode: "HTML",
                        reply_markup: {
                            remove_keyboard: true,
                        }
                    });
                }

                if (isNaN(text)) {
                    addVoicesNumberToBuyNumberListener.set(chatId.toString(), true);

                    return await shopBot.sendMessage(chatId, '<b>Введите количество голосовых числом!!</b>' + '\n' +
                        'Если хотите отменить добавление нового количества голосовых для покупки, нажмите "Отменить"', {
                            parse_mode: "HTML",
                            reply_markup: {
                                keyboard: [
                                    [{
                                        text: "Отменить"
                                    }]
                                ],
                                resize_keyboard: true
                            }
                        });
                }

                addVoicesNumberToBuyCostListener.set(chatId.toString(), text);

                return await shopBot.sendMessage(chatId, `<b>Введите цену для ${text} голосовых</b>` + '\n \n' +
                    'Если хотите изменить количество голосовых, нажмите кнопку "Изменить"', {
                        reply_markup: {
                            keyboard: [
                                [{
                                    text: "Изменить"
                                }]
                            ],
                            resize_keyboard: true
                        },
                        parse_mode: "HTML"
                    })
            }

            if (addVoicesNumberToBuyCostListener.has(chatId.toString())) {
                const voicesNumber = addVoicesNumberToBuyCostListener.get(chatId.toString());
                addVoicesNumberToBuyCostListener.delete(chatId.toString());

                if (text === "Изменить") {
                    addVoicesNumberToBuyNumberListener.set(chatId.toString(), 'true');

                    return await shopBot.sendMessage(chatId, 'Введите новое число голосовых доступных для покупки' + '\n' +
                        'Если хотите отменить добавление нового количества голосовых для покупки, нажмите "Отменить"', {
                            reply_markup: {
                                keyboard: [
                                    [{
                                        text: "Отменить"
                                    }]
                                ],
                                resize_keyboard: true
                            }
                        });
                }

                if (isNaN(text)) {
                    addVoicesNumberToBuyCostListener.set(chatId.toString(), voicesNumber);

                    return await shopBot.sendMessage(chatId, '<b>Введите цену для голосовых в USDT числом!!</b>' + '\n' +
                        'Если хотите изменить количество голосовых, нажмите кнопку "Изменить"', {
                            parse_mode: "HTML",
                            reply_markup: {
                                keyboard: [
                                    [{
                                        text: "Изменить"
                                    }]
                                ],
                                resize_keyboard: true
                            }
                        });
                }

                await insertVoicesCountToBuyInDb(Number(voicesNumber), Number(text), db);

                return await shopBot.sendMessage(chatId, `<b>Вы успешно добавили новое количество голосовых доступных для покупки</b>` + '\n \n' + shopBotAdminCommands, {
                    reply_markup: {
                        remove_keyboard: true
                    },
                    parse_mode: "HTML"
                })
            }

            if (numOfVoicesToEditCostListener.has(chatId.toString())) {
                numOfVoicesToEditCostListener.delete(chatId.toString());
                const numberOfVoicesToChangeCost = parseFloat(text);

                if (!numberOfVoicesToChangeCost || text === 'Отменить') {
                    return await shopBot.sendMessage(chatId, 'Вы отменили изменение цены голосовым' + '\n\n' + shopBotAdminCommands);
                }

                newCostForVoicesListener.set(chatId.toString(), numberOfVoicesToChangeCost);

                return await shopBot.sendMessage(chatId, `Введите новую цену для ${numberOfVoicesToChangeCost} голосовых ЧИСЛОМ.` + '\n\n' +
                    'Чтобы выбрать другое количество голосовых нажмите "Выбрать"', {
                        reply_markup: {
                            keyboard: [
                                [{
                                    text: "Выбрать"
                                }]
                            ]
                        }
                    })
            }

            if (newCostForVoicesListener.has(chatId.toString())) {
                const voicesNumber = newCostForVoicesListener.get(chatId.toString());
                newCostForVoicesListener.delete(chatId.toString());

                if (text === "Выбрать") {
                    const voicesCostsArr = await getVoicesCosts(db);

                    const voicesMessages = voicesCostsArr ? voicesCostsArr.map((voice) => (`<b>${voice.number}</b> Голосовых 🎙️ - <b>${voice.cost}</b>💲`)).join('\n') : '<b>В боте нету голосовых</b>';

                    const voicesArr = voicesCostsArr ? voicesCostsArr.map((voice) => {
                        return [{
                            text: `${voice.number} голосовых 🎙️`
                        }];
                    }) : [];

                    voicesArr.push([{
                        text: '↩️ Назад'
                    }])

                    numOfVoicesToEditCostListener.set(chatId.toString(), 'true')

                    return await shopBot.sendMessage(chatId, 'Выберите количество голосовых, которому хотите изменить цену из клавиатуры ниже' + '\n' +
                        '💸<b>Цены</b>💸' + '\n \n' +
                        voicesMessages, {
                            reply_markup: {
                                keyboard: voicesArr,
                                resize_keyboard: true
                            },
                            parse_mode: "HTML",
                            disable_web_page_preview: true
                        }
                    );
                }

                if (isNaN(text)) {
                    newCostForVoicesListener.set(chatId.toString(), voicesNumber);

                    return await shopBot.sendMessage(chatId, `Введите новую цену для ${voicesNumber} голосовых ЧИСЛОМ.` + '\n\n' +
                        'Чтобы выбрать другое количество голосовых нажмите "Выбрать"', {
                            reply_markup: {
                                keyboard: [
                                    [{
                                        text: "Выбрать"
                                    }]
                                ]
                            }
                        })
                }

                try {
                    await db.run('UPDATE voicesCost SET cost = ? WHERE number = ?', [Number(text), Number(voicesNumber)], function (err) {
                        if (err) {
                            return console.error(err.message);
                        }

                        console.log('language is updated');
                    });
                } catch (e) {
                    throw new Error(e);
                }

                return await shopBot.sendMessage(chatId, 'Вы успешно заменили цену, теперь это: ' + '\n' +
                    `<b>${voicesNumber}</b> Голосовых 🎙️ - <b>${text}</b>💲` + '\n\n' + shopBotAdminCommands, {
                        parse_mode: "HTML"
                    });
            }

            if (messageForAllShopBotUsers.has(chatId.toString())) {
                messageForAllShopBotUsers.delete(chatId.toString());

                if (text === "Отменить") {
                    return await shopBot.sendMessage(chatId, '<b>Вы отменили рассылку сообщения пользователям</b>', {
                        parse_mode: "HTML"
                    });
                }

                const userIds = await getShopBotUsersChatIds(db);

                console.log(userIds);

                for (const userId of userIds) {
                    try {
                        await shopBot.copyMessage(userId, chatId, msg.message_id);
                    } catch (error) {
                        if (error.response && error.response.body && error.response.body.error_code === 403) {
                            console.log(`Пользователь ${userId} заблокировал бота.`);

                            db.run('DELETE FROM shop_users WHERE chatId = ?', [userId], (err) => {
                                if (err) {
                                    throw new Error(`Ошибка при удалении пользователя ${userId}:`, err.message);
                                } else {
                                    console.log(`Пользователь ${userId} был удален из базы данных.`);
                                }
                            });
                        }
                    }
                }

                return await shopBot.sendMessage(chatId, 'Вы успешно разослали сообщение всем пользователям' + '\n' + shopBotAdminCommands, {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: shopBotMainMenuKeyboardRu
                    }
                })
            }
        }

        switch (text) {
            case 'xG7hJm2uNs5kL8oQ': {
                await giveShopUserAdminStatus(chatId.toString(), db);

                return await shopBot.sendMessage(chatId, 'Поздравляю, вы успешно получили статус администратора ' + shopBotAdminCommands);
            }

            case '↩️ Назад':
            case '↩️ Back': {
                if (numOfVoicesToBuyListener.has(chatId.toString())) {
                    numOfVoicesToBuyListener.delete(chatId.toString());
                }

                if (textMessageToVoiceListener.has(chatId.toString())) {
                    textMessageToVoiceListener.delete(chatId.toString());
                }

                if (modelListener.has(chatId.toString())) {
                    modelListener.delete(chatId.toString());
                }

                if (numOfVoicesToBuyListener.has(chatId.toString())) {
                    numOfVoicesToBuyListener.delete(chatId.toString());
                }

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucI5nDma6ynZVH5locgWDsWhuGX9CpwACj2cAArmjaUgrEmxhH2HAbDYE");

                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = '👋 <b>Oh glorious warrior, you have returned to the main menu!</b>' + '\n' +
                            'Choose the path that will lead you to the desired section 🏛️⚡️' + '\n \n' +
                            `<b>Bot creator:</b> @${creatorNick} 🔱`;
                        resultKeyboard = shopBotMainMenuKeyboardEn;
                        break;
                    case "ru":
                        messageText = '👋 <b>О славный воин, ты вернулся в главное меню!</b>' + '\n' +
                            'Выбери путь, что приведет тебя к нужному разделу 🏛️⚡️' + '\n \n' +
                            `<b>Создатель бота:</b> @${creatorNick} 🔱`;
                        resultKeyboard = shopBotMainMenuKeyboardRu;
                        break;
                }

                return await shopBot.sendMessage(chatId, messageText, {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: resultKeyboard,
                        resize_keyboard: true
                    }
                });
            }


            case '👩 Женские голоса':
            case '👩 Female voices': {
                girlsVoiceTypeListener.set(chatId.toString(), 'true');

                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = 'Choose the conversion method.' + '\n' +
                            '📝 <b>Text</b> - the bot will convert the text you write into a pleasant voice message! 💬💪' + '\n' +
                            '<b>Voice</b> - the bot will create a voice message with a female voice based on your audio, as if it’s the voice of a goddess! 🔊👩‍🎤';
                        resultKeyboard = [
                            [{
                                text: "Text",
                            }, {
                                text: "Voice",
                            }, {
                                text: '↩️ Back'
                            }]
                        ];
                        break;
                    case "ru":
                        messageText = 'Выберете способ преобразования.' + '\n' +
                            '📝 <b>Текст</b> - бот преобразует текст, который вы напишите, в приятное голосовое сообщение! 💬💪' + '\n' +
                            '<b>Голосовое</b> - бот сделает голосовое с женским голосом на основе вашего аудио, словно это голос богини! 🔊👩‍🎤';
                        resultKeyboard = [
                            [{
                                text: "Текст",
                            }, {
                                text: "Голосовое",
                            }, {
                                text: '↩️ Назад'
                            }]
                        ];
                        break;
                }

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucJxnDmdcp8iKj8dYjRVSPLbmDgwwuQAC-WYAArSCaUgzuDOl87Tm2DYE");
                return await shopBot.sendMessage(chatId, messageText, {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: resultKeyboard,
                        resize_keyboard: true
                    }
                });
            }

            case "👨 Мужские голоса":
            case "👨 Male voices": {
                modelListener.set(chatId.toString(), "Текст");

                switch (foundUserOrNull.language) {
                    case 'en':
                        modelListener.set(chatId.toString(), "Text");
                        messageText = 'You have chosen the section with male voices. 🎙️💪' + '\n' +
                            '<b>Select a model:</b>' + '\n \n' +
                            '‼️<b>Remember.</b>' + '\n' +
                            `enter text with correct spelling and punctuation. Write numbers in words to maintain the precision of the speech. Use stickers to convey the right mood and enhance the effect of your message! 😊🔥`;

                        // messageText = `💥 <b>Hey, hero!</b>💥` + '\n' +
                        //     'You forgot something... I think you need to choose a model? ⚔️' + '\n\n' +
                        //     'Do it on the panel below and get ready for your great deeds! 💪';
                        resultKeyboard = [
                            [{
                                text: "Andrew",
                            }, {
                                text: '↩️ Назад'
                            }]
                        ];
                        break;
                    case "ru":
                        modelListener.set(chatId.toString(), "Текст");
                        // messageText = `💥 <b>Эй, герой!</b>💥` + '\n' +
                        //     'Ты кое-что забыл… По-моему, нужно выбрать модель? ⚔️' + '\n\n' +
                        //     'Сделай это на панели ниже и приступай к своим великим подвигам! 💪';
                        messageText = 'Вы выбрали раздел с мужскими голосами. 🎙️💪' + '\n' +
                            '<b>Выберете модель:</b>' + '\n \n' +
                            '‼️<b>Помните.</b>' + '\n' +
                            `вводите текст с правильной орфографией и всеми знаками препинания. Цифры пишите прописью, чтобы сохранить точность звучания. Используйте стикеры, чтобы передать нужное настроение и усилить эффект вашего сообщения! 😊🔥`;
                        resultKeyboard = [
                            [{
                                text: "Андрей",
                            }, {
                                text: '↩️ Назад'
                            }]
                        ];

                        break;
                }

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIhnDmY9ZMwmJZ7MVja6WLQRMheMsQACnmYAAtkCaEh506_l6mpDDDYE");
                return await shopBot.sendMessage(chatId, messageText, {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: resultKeyboard,
                        resize_keyboard: true
                    }
                });
            }

            case '👨‍💼 Личный кабинет':
            case '👨‍💼 Profile': {
                const {
                    usersNum
                } = await getShopBotUsersCountFromDb(db);

                switch (foundUserOrNull.language) {
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
                        resultKeyboard = shopBotOwnCabinetMenuRu;
                        break;
                }
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

            case "🤝 Реферальная система":
            case "🤝 Refferal system": {
                const refferalsCount = await getShopBotUserRefferalsCount(chatId.toString(), db);

                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = '<b>Invite friends to our glorious kingdom and receive generous gifts from the gods!</b> 🎁✨' + '\n \n' +
                            '🔱 Here is your sacred referral link, granted by Hades himself:' + '\n' +
                            `https://t.me/MegSoundBot?start=${chatId}` + '\n \n' +
                            `Number of invited heroes: <b>${refferalsCount.usersNum}</b> 🏛️👏` + '\n \n' +
                            '<i>For every fifth invited friend, the gods will reward you with three additional voice messages!</i> 💬🎶';
                        break;
                    case "ru":
                        messageText = '<b>Приглашай друзей в наше славное царство и получай щедрые дары богов!</b>  🎁✨' + '\n \n' +
                            '🔱 Вот твоя священная реферальная ссылка, дарованная самим Аидом:' + '\n' +
                            `https://t.me/MegSoundBot?start=${chatId}` + '\n \n' +
                            `Количество приведённых героев: <b>${refferalsCount.usersNum}</b> 🏛️👏` + '\n \n' +
                            '<i>За каждого пятого приглашённого друга, боги наградят тебя тремя дополнительными голосовыми сообщениями!</i> 💬🎶';
                        break;
                }

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIRnDmX-bm0aaPcW6AZf_ETGxkbHbgAC4F0AAm01aEjrUPZyq9V63TYE");
                // return await shopBot.sendMessage(chatId, 'Пригласи друга и получи бонус! 🎁' + '\n \n' +
                //     'Твоя реферальная ссылка: Ваша новая реферальная ссылка:' + '\n' +
                //     `https://t.me/MegSoundBot?start=${chatId}` + '\n \n' +
                //     `Ты уже пригласил ${refferalsCount.usersNum} человек` + '\n \n' +
                //     'За каждых 5 приглашенных друзей ты будешь получать 3 голосовых 💰', {
                //         parse_mode: "HTML",
                //         disable_web_page_preview: true
                //     }
                // );

                return await shopBot.sendMessage(chatId, messageText, {
                    parse_mode: "HTML",
                    disable_web_page_preview: true
                });

            }

            case '🛍️ Покупка голосовых сообщений':
            case '🛍️ Buy voice messages': {
                const voicesCostsArr = await getVoicesCosts(db);

                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = 'Choose the number of voice messages you want to purchase' + '\n' +
                            '💸<b>Available prices</b>💸';
                        break;
                    case "ru":
                        messageText = 'Выберите количество голосовых сообщений, которые хотите приобрести' + '\n' +
                            '💸<b>Доступные цены</b>💸';
                        break;
                }

                const voicesMessages = voicesCostsArr ? voicesCostsArr.map((voice) => (`<b>${voice.number}</b> ${foundUserOrNull.language === 'en' ? 'Voices' : 'Голосовых'} 🎙️ - <b>${voice.cost}</b>💲`)).join('\n') : foundUserOrNull.language === 'en' ? '' : '<b>В боте нету голосовых</b>';

                const voicesArr = voicesCostsArr ? voicesCostsArr.map((voice) => {
                    return [{
                        text: `${voice.number} ${foundUserOrNull.language === 'en' ? 'voices' : 'голосовых'} 🎙️`
                    }];
                }) : [];

                voicesArr.push([{
                    text: foundUserOrNull.language === 'en' ? '↩️ Back' : '↩️ Назад'
                }])

                numOfVoicesToBuyListener.set(chatId.toString(), 'true')

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucJRnDmcUCNlBRRPzhgWpgXb-MIrp-QACjFwAAqYEaEieWJzGdVvhHTYE");
                // return await shopBot.sendMessage(chatId, 'Выберите количество голосовых, которое хотите купить' + '\n' +
                //     '💸<b>Цены</b>💸' + '\n \n' +
                //     voicesMessages, {
                //         reply_markup: {
                //             keyboard: voicesArr,
                //             resize_keyboard: true
                //         },
                //         parse_mode: "HTML",
                //         disable_web_page_preview: true
                //     }
                // );

                return await shopBot.sendMessage(chatId, messageText + '\n \n' +
                    voicesMessages, {
                        reply_markup: {
                            keyboard: voicesArr,
                            resize_keyboard: true
                        },
                        parse_mode: "HTML",
                        disable_web_page_preview: true
                    }
                );
            }
        }

        if (numOfVoicesToBuyListener.has(chatId.toString())) {
            numOfVoicesToBuyListener.delete(chatId.toString());

            const voicesToBuyNum = parseFloat(text);

            await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucJxnDmdcp8iKj8dYjRVSPLbmDgwwuQAC-WYAArSCaUgzuDOl87Tm2DYE");
            const voices = await getVoicesToBuyByNumberFromDb(voicesToBuyNum, db);

            if (!voices) {
                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = `The requested number of voice messages for purchase is temporarily unavailable` + '\n \n' +
                            'Please use the keyboard';
                        break;
                    case "ru":
                        messageText = `Данное количество голосовых для покупки временно не доступно` + '\n \n' +
                            'Воспользуйтесь клавиатурой';
                        break;
                }

                return await shopBot.sendMessage(chatId, messageText);
            }

            const newInvoice = await CryptoBotClient.createInvoice({
                amount: Number(voices.cost),
                currency: "USDT"
            });

            switch (foundUserOrNull.language) {
                case 'en':
                    messageText = `Amount to be paid: ${voices.cost}💲` + '\n \n' +
                        'After a successful transaction, click the "Check" button';
                    break;
                case "ru":
                    messageText = `Сумма к оплате: ${voices.cost}💲` + '\n \n' +
                        'После успешной проведенной операции нажмите кнопку "Проверить"';
                    break;
            }

            return await shopBot.sendMessage(chatId, messageText, {
                reply_markup: {
                    inline_keyboard: [
                        [{
                            text: foundUserOrNull.language === 'en' ? '💰 Pay' : '💰 Оплатить',
                            url: newInvoice.payUrl
                        }],
                        [{
                            text: foundUserOrNull.language === 'en' ? '🔁 Check' : '🔁 Проверить',
                            callback_data: `checkCryptoBotPayment_${voicesToBuyNum}_${newInvoice.id}`
                        }]
                    ]
                }
            });
        }

        if (girlsVoiceTypeListener.has(chatId.toString())) {
            girlsVoiceTypeListener.delete(chatId.toString());

            if (text !== 'Текст' && text !== 'Голосовое' && text !== 'Text' && text !== 'Voice')
                return 0;

            switch (foundUserOrNull.language) {
                case 'en': {
                    // messageText = `💥 <b>Hey, hero!</b>💥` + '\n' +
                    //     'You forgot something... I think you need to choose a model? ⚔️' + '\n\n' +
                    //     'Do it on the panel below and get ready for your great deeds! 💪';
                    const comment = text === 'Text' ?
                        'Enter the text with correct spelling and all punctuation marks, and write numbers in words! 📜✍️' :
                        'After selecting a model, record a voice message clearly, without background noise';

                    messageText = `You have chosen conversion using ${text === 'Text' ? 'text' : 'voice'}.` + '\n' +
                        '<b>Select a model:</b>' + '\n\n' +
                        '‼️<b>Remember</b>' + '\n' +
                        comment;

                    resultKeyboard = [
                        [{
                            text: "Lera"
                        }, {
                            text: 'Ann'
                        }, {
                            text: '↩️ Back'
                        }]
                    ];
                    break;
                }

                case 'ru': {
                    // messageText = `💥 <b>Эй, герой!</b>💥` + '\n' +
                    //     'Ты кое-что забыл… По-моему, нужно выбрать модель? ⚔️' + '\n\n' +
                    //     'Сделай это на панели ниже и приступай к своим великим подвигам! 💪';

                    const comment = text === 'Текст' ?
                        'Текст вводите с верной орфографией и всеми знаками препинания, а цифры пишите буквами! 📜✍️' :
                        'После выбора модели, запишите голосовое сообщение четко, без лишних звуков на фоне';

                    messageText = `Вы выбрали конвертацию с помощью ${text === 'Текст' ? 'текста': 'голоса'}.` + '\n' +
                        '<b>Выберете модель:</b>' + '\n\n' +
                        '‼️<b>Помните</b>' + '\n' +
                        comment;


                    resultKeyboard = [
                        [{
                            text: "Лера"
                        }, {
                            text: 'Анна'
                        }, {
                            text: '↩️ Назад'
                        }]
                    ];
                    break;
                }
            }


            await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIhnDmY9ZMwmJZ7MVja6WLQRMheMsQACnmYAAtkCaEh506_l6mpDDDYE");

            modelListener.set(chatId.toString(), text);

            return await shopBot.sendMessage(chatId, messageText, {
                parse_mode: "HTML",
                reply_markup: {
                    keyboard: resultKeyboard,
                    resize_keyboard: true
                }
            })
        }

        if (modelListener.has(chatId.toString())) {
            const messageType = modelListener.get(chatId.toString());

            if (!["Лера", 'Анна', 'Андрей', "Lera", 'Ann', 'Andrew'].includes(text)) {
                switch (foundUserOrNull.language) {
                    case 'en': {
                        messageText = `💥 <b>Hey, hero!</b>💥` + '\n' +
                            'You forgot something... I think you need to choose a model? ⚔️' + '\n\n' +
                            'Do it on the panel below and get ready for your great deeds! 💪';
                        // const comment = text === 'Text' ?
                        //     'Enter the text with correct spelling and all punctuation marks, and write numbers in words! 📜✍️' :
                        //     'After selecting a model, record a voice message clearly, without background noise';

                        // messageText = `You have chosen conversion using ${text === 'Text' ? 'text' : 'voice'}.` + '\n' +
                        //     '<b>Select a model:</b>' + '\n\n' +
                        //     '‼️<b>Remember</b>' + '\n' +
                        //     comment;

                        resultKeyboard = [
                            [{
                                text: "Lera"
                            }, {
                                text: 'Ann'
                            }, {
                                text: '↩️ Back'
                            }]
                        ];
                        break;
                    }

                    case 'ru': {
                        messageText = `💥 <b>Эй, герой!</b>💥` + '\n' +
                            'Ты кое-что забыл… По-моему, нужно выбрать модель? ⚔️' + '\n\n' +
                            'Сделай это на панели ниже и приступай к своим великим подвигам! 💪';

                        // const comment = text === 'Текст' ?
                        // 'Текст вводите с верной орфографией и всеми знаками препинания, а цифры пишите буквами! 📜✍️' :
                        // 'После выбора модели, запишите голосовое сообщение четко, без лишних звуков на фоне';
                        // messageText = `Вы выбрали конвертацию с помощью ${text === 'Текст' ? 'текста': 'голоса'}.` + '\n' +
                        //     '<b>Выберете модель:</b>' + '\n\n' +
                        //     '‼️<b>Помните</b>' + '\n' +
                        //     comment;


                        resultKeyboard = [
                            [{
                                text: "Лера"
                            }, {
                                text: 'Анна'
                            }, {
                                text: '↩️ Назад'
                            }]
                        ];
                        break;
                    }
                }

                return await shopBot.sendMessage(chatId, messageText, {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: resultKeyboard,
                        resize_keyboard: true
                    }
                })
            }

            modelListener.delete(chatId.toString());

            if (messageType === 'Текст' || messageType === 'Text') {
                textMessageToVoiceListener.set(chatId.toString(), text);
            } else {
                voiceMessageToVoiceListener.set(chatId.toString(), text);
            }

            switch (foundUserOrNull.language) {
                case 'en': {
                    const age = text === "Lera" ? 18 : text === 'Ann' ? 21 : 20;
                    messageText = `<b>${text}</b>. ${age} years old` + '\n \n' +
                        `${text === 'Andrey' ? andreyDescriptionEn : text === "Lera" ? leraDescriptionEn : annaDescriptionEn}` + '\n \n' +
                        `Send the ${messageType.toLowerCase()} that you want to turn into a voice message, and it will sound like a hymn worthy of kings! 🏛️` + '\n' +
                        'Or press “↩️ <b>Back</b>” if your choice is not yet decided. ⚔️';

                    resultKeyboard = [
                        [{
                            text: '↩️ Back'
                        }]
                    ];
                    break;
                }

                case 'ru': {
                    const age = text === "Лера" ? 18 : text === 'Анна' ? 21 : 20;
                    messageText = `<b>${text}</b>. ${age} лет` + '\n \n' +
                        `${text === 'Андрей' ? andreyDescriptionRu : text === "Лера" ? leraDescribtionRu : annaDescribtionRu}` + '\n \n' +
                        `Отправьте ${messageType.toLowerCase()}, который хочешь превратить в голосовое послание, и оно прозвучит, словно гимн, достойный царей! 🏛️` + '\n' +
                        'Или нажми “↩️ <b>Назад</b>”, если твой выбор пока не определён. ⚔️';

                    resultKeyboard = [
                        [{
                            text: '↩️ Назад'
                        }]
                    ];
                    break;
                }
            }

            return await shopBot.sendPhoto(chatId, `./images/${(text === 'Андрей' || text === 'Andrew') ? 'malePhoto': (text === "Лера" || text === 'Lera') ? 'Lera' : 'Anna'}.jpg`, {
                caption: messageText,
                parse_mode: "HTML",
                reply_markup: {
                    keyboard: resultKeyboard,
                    resize_keyboard: true
                }
            })
        }

        if (textMessageToVoiceListener.has(chatId.toString())) {
            const modelName = textMessageToVoiceListener.get(chatId.toString());

            if (!text || !modelName) {
                return 0;
            }

            if (text.length > 200) {
                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = "The text exceeds the maximum allowed number of characters (200). Please send a shorter text.";

                        break;
                    case "ru":
                        messageText = 'Текст превышает максимально допустимое количество символов (200). Пожалуйста, отправьте текст короче.';
                        break;
                }

                return await shopBot.sendMessage(chatId, messageText);
            }

            if (foundUserOrNull.voicesAvaliable <= 0 && foundUserOrNull.status !== 'admin') {
                textMessageToVoiceListener.delete(chatId.toString());
                switch (foundUserOrNull.language) {
                    case 'en':
                        messageText = 'You have run out of voice messages. To purchase, go to your personal account.';

                        break;
                    case "ru":
                        messageText = 'У вас закончились голосовые. Для покупки перейдите в личный кабинет.';
                        break;
                }

                switch (foundUserOrNull.language) {
                    case 'en':
                        resultKeyboard = shopBotMainMenuKeyboardEn;
                        break;
                    case "ru":
                        resultKeyboard = shopBotMainMenuKeyboardRu;
                        break;
                }

                return await shopBot.sendMessage(chatId, messageText, {
                    reply_markup: {
                        keyboard: resultKeyboard
                    }
                });
            }

            try {
                if (foundUserOrNull.status !== 'admin') {
                    await db.run('UPDATE shop_users SET voicesAvaliable = ? WHERE chatId = ?', [Number(foundUserOrNull.voicesAvaliable) - 1, chatId.toString()], function (err) {
                        if (err) {
                            return console.error(err.message);
                        }

                        console.log('language is updated');
                    });
                }

                await db.run('UPDATE shop_users SET totalVoicesRecorded = ? WHERE chatId = ?', [Number(foundUserOrNull.totalVoicesRecorded) + 1, chatId.toString()], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }

                    console.log('language is updated');
                });
            } catch (e) {
                throw new Error(e);
            }

            let speaker;

            switch (modelName) {
                case 'Андрей': {
                    speaker = {
                        voice_id: 'm2gtxNsYBaIRqPBA5vU5',
                        voice: 'Oleg Krugliak ',
                        voice_settings: {
                            stability: 0.7,
                            similarity_boost: 0.76,
                            style: 0.32,
                            use_speaker_boost: true
                        }
                    };
                    break;
                }

                case 'Lera': {
                    speaker = {
                        voice_id: '2rJo4BNbDooc3q89IWVH',
                        voice: 'Natasha - Valley girl',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0,
                            use_speaker_boost: true
                        }
                    };
                    break;
                }

                case 'Andrew': {
                    speaker = {
                        voice_id: 'jPI42gyGKKPr0fEdosmi',
                        voice: 'Max - fast, friendly, and direct',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0.3,
                            use_speaker_boost: true
                        }
                    };
                    break;
                }

                case "Ann": {
                    speaker = {
                        voice_id: 'BSHBic1jFUy7dqyXEdTY',
                        voice: 'Sophia Dean',
                        voice_settings: {
                            stability: 0.5,
                            similarity_boost: 0.75,
                            style: 0,
                            use_speaker_boost: true
                        }
                    };
                    break;
                }

                case "Лера": {
                    speaker = {
                        voice_id: "wFyaValVXXUOvVMKrn4K", // Use the correct voice ID (Anna)
                        voice: "Anna",
                        voice_settings: {
                            stability: 0.54,
                            similarity_boost: 0.48,
                            style: 0.2,
                            use_speaker_boost: true
                        }
                    };
                    break;
                }

                default: {
                    speaker = {
                        voice_id: '6CzwEjVC4rBP2a3QLCH0',
                        voice: 'Faja',
                        voice_settings: {
                            stability: 0.32,
                            similarity_boost: 0.28,
                            style: 0.2,
                            use_speaker_boost: true
                        }
                    };
                    break;
                }
            }

            try {
                const audioStream = await elevenlabs.generate({
                    ...speaker,
                    text: text,
                    model_id: "eleven_multilingual_v2"
                });

                // Convert the stream to a buffer
                const chunks = [];
                for await (const chunk of audioStream) {
                    chunks.push(chunk);
                }
                const audioBuffer = Buffer.concat(chunks);

                const metadata = await mm.parseBuffer(audioBuffer, {
                    mimeType: 'audio/mpeg'
                });
                const duration = metadata.format.duration;

                console.log(duration);

                // Use ffmpeg to trim 1 second from the end
                const tempFile = tmp.fileSync({
                    postfix: '.mp3'
                });
                fs.writeFileSync(tempFile.name, audioBuffer);

                // Trim the audio to be 1 second shorter
                const trimmedBuffer = await new Promise((resolve, reject) => {
                    const stream = ffmpeg(tempFile.name)
                        .inputFormat('mp3')
                        .outputOptions(['-t', (duration - 0.2).toString()]) // Trim to duration - 1 second
                        .on('end', function () {
                            console.log('Trimming completed');
                        })
                        .on('error', function (err) {
                            console.log('Error during trimming:', err.message);
                            reject(err);
                        })
                        .toFormat('mp3') // Ensure it's in the correct format
                        .pipe();

                    const chunks = [];
                    stream.on('data', chunk => chunks.push(chunk));
                    stream.on('end', () => resolve(Buffer.concat(chunks)));
                    stream.on('error', reject);
                });

                // Clean up the temporary file
                tempFile.removeCallback();

                // Send the trimmed audio buffer directly to Telegram
                await shopBot.sendVoice(chatId, trimmedBuffer, {
                    filename: 'audio.mp3', // Provide a filename
                    contentType: 'audio/mpeg', // MIME type for audio
                });
            } catch (e) {
                throw new Error(e);
            }
        }
    })
}