import CryptoBotAPI from 'crypto-bot-api';
import {
    ElevenLabsClient
} from "elevenlabs";
import fs from "fs";

import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import {
    annaDescribtion,
    channelChatId,
    channelLink,
    channelName,
    creatorNick,
    cryptoBotAPIKey,
    elevenLabsApiKey,
    leraDescribtion,
    andreyDescription,
    shopBotAdminCommands
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
    shopBotMainMenuKeyboard,
    shopBotOwnCabinetMenu
} from "../utils/keyboards.js";
import getShopBotUserRefferalsCount from "../middlewares/getShopBotUserRefferalsCount.js";
import getVoicesCosts from "../middlewares/getVoicesWithCost.js";
import getVoicesToBuyByNumberFromDb from "../middlewares/getVoicesToBuyByNumberFromDb.js";
import insertVoicesCountToBuyInDb from '../services/insertVoicesCountToBuyInDb.js';

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


        // const voices = await elevenlabs.voices.getAll();

        // console.log('Available voices:', voices);

        if (foundUserOrNull.isBlocked) {
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

        const chatMembership = await shopBot.getChatMember(channelChatId, chatId);

        if (chatMembership.status === 'left') {
            if (text !== '/start') {
                console.log('sosi')
                return await shopBot.sendMessage(chatId, 'Для начала Вам нужно подписаться на канал!', {
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
                        keyboard: shopBotMainMenuKeyboard
                    }
                })
            }
        }

        switch (text) {
            case 'xG7hJm2uNs5kL8oQ': {
                await giveShopUserAdminStatus(chatId.toString(), db);

                return await shopBot.sendMessage(chatId, 'Поздравляю, вы успешно получили статус администратора ' + shopBotAdminCommands);
            }

            case '↩️ Назад': {
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
                return await shopBot.sendMessage(chatId, '👋 <b>О славный воин, ты вернулся в главное меню!</b>' + '\n' +
                    'Выбери путь, что приведет тебя к нужному разделу 🏛️⚡️' + '\n \n' +
                    `<b>Создатель бота:</b> @${creatorNick} 🔱`, {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: shopBotMainMenuKeyboard,
                            resize_keyboard: true
                        }
                    }
                );
            }


            case '👩 Женские голоса': {
                girlsVoiceTypeListener.set(chatId.toString(), 'true');

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucJxnDmdcp8iKj8dYjRVSPLbmDgwwuQAC-WYAArSCaUgzuDOl87Tm2DYE");
                return await shopBot.sendMessage(chatId, 'Выберете способ преобразования.' + '\n' +
                    '📝 <b>Текст</b> - бот преобразует текст, который вы напишите, в приятное голосовое сообщение! 💬💪' + '\n' +
                    '<b>Голосовое</b> - бот сделает голосовое с женским голосом на основе вашего аудио, словно это голос богини! 🔊👩‍🎤', {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: [
                                [{
                                    text: "Текст",
                                }, {
                                    text: "Голосовое",
                                }, {
                                    text: '↩️ Назад'
                                }]
                            ],
                            resize_keyboard: true
                        }
                    }
                );
            }

            case "👨 Мужские голоса": {
                modelListener.set(chatId.toString(), "Текст");

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIhnDmY9ZMwmJZ7MVja6WLQRMheMsQACnmYAAtkCaEh506_l6mpDDDYE");
                return await shopBot.sendMessage(chatId, 'Вы выбрали раздел с мужскими голосами. 🎙️💪' + '\n' +
                    '<b>Выберете модель:</b>' + '\n \n' +
                    '‼️<b>Помните.</b>' + '\n' +
                    `вводите текст с правильной орфографией и всеми знаками препинания. Цифры пишите прописью, чтобы сохранить точность звучания. Используйте стикеры, чтобы передать нужное настроение и усилить эффект вашего сообщения! 😊🔥`, {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: [
                                [{
                                    text: "Андрей",
                                }, {
                                    text: '↩️ Назад'
                                }]
                            ],
                            resize_keyboard: true
                        }
                    }
                );
            }

            case '👨‍💼 Личный кабинет': {
                const {
                    usersNum
                } = await getShopBotUsersCountFromDb(db);

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIZnDmYekukDQq1QCkH1_zvJ_-FPvQACSVwAAvuvaEgodF_trkXaUjYE");
                return await shopBot.sendMessage(chatId, '👨‍💼 <b>Ваш профиль</b>' + '\n \n' +
                    `🚀 Ваш уникальный Telegram ID: <code>${chatId}</code>` + '\n \n' +
                    `<b>Связь с администратором:</b> @${creatorNick}` + '\n \n' +
                    '💡<b>Есть предложения по улучшению бота?</b>' + '\n' +
                    '💡<b>Поделитесь своими идеями с администратором!</b>' + '\n \n' +
                    `👥 Общее количество пользователей: ${usersNum}` + '\n \n' +
                    `⏳ За все время вы записали: <b>${foundUserOrNull.totalVoicesRecorded}</b> голосовых сообщений` + '\n \n' +
                    `🥳 У вас осталось <b>${foundUserOrNull.voicesAvaliable}</b> доступных голосовых сообщений` + '\n' +
                    '🤬 Не устроило качество голосового сообщения? 🤗 <b>Мы его заменим!</b>' + '\n' +
                    'Свяжитесь с администратором для замены.', {
                        parse_mode: "HTML",
                        reply_markup: {
                            keyboard: shopBotOwnCabinetMenu,
                            resize_keyboard: true
                        }
                    }
                );

            }

            case "🤝 Реферальная система": {
                const refferalsCount = await getShopBotUserRefferalsCount(chatId.toString(), db);

                console.log(refferalsCount);

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

                return await shopBot.sendMessage(chatId, '<b>Приглашай друзей в наше славное царство и получай щедрые дары богов!</b>  🎁✨' + '\n \n' +
                    '🔱 Вот твоя священная реферальная ссылка, дарованная самим Аидом:' + '\n' +
                    `https://t.me/MegSoundBot?start=${chatId}` + '\n \n' +
                    `Количество приведённых героев: <b>${refferalsCount.usersNum}</b> 🏛️👏` + '\n \n' +
                    '<i>За каждого пятого приглашённого друга, боги наградят тебя тремя дополнительными голосовыми сообщениями!</i> 💬🎶', {
                        parse_mode: "HTML",
                        disable_web_page_preview: true
                    }
                );

            }

            case '🛍️ Покупка голосовых сообщений': {
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

                return await shopBot.sendMessage(chatId, 'Выберите количество голосовых сообщений, которые хотите приобрести' + '\n' +
                    '💸<b>Доступные цены</b>💸' + '\n \n' +
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
                return await shopBot.sendMessage(chatId, `Данное количество голосовых для покупки временно не доступно` + '\n \n' +
                    'Воспользуйтесь клавиатурой'
                );
            }

            const newInvoice = await CryptoBotClient.createInvoice({
                amount: Number(voices.cost),
                currency: "USDT"
            });

            return await shopBot.sendMessage(chatId, `Сумма к оплате: ${voices.cost}💲` + '\n \n' +
                'После успешной проведенной операции нажмите кнопку "Проверить"', {
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '💰 Оплатить',
                                url: newInvoice.payUrl
                            }],
                            [{
                                text: '🔁 Проверить',
                                callback_data: `checkCryptoBotPayment_${voicesToBuyNum}_${newInvoice.id}`
                            }]
                        ]
                    }
                }
            );
        }

        if (girlsVoiceTypeListener.has(chatId.toString())) {
            girlsVoiceTypeListener.delete(chatId.toString());

            if (text !== 'Текст' && text !== 'Голосовое')
                return 0;

            const comment = text === 'Текст' ?
                'Текст вводите с верной орфографией и всеми знаками препинания, а цифры пишите буквами! 📜✍️' :
                'После выбора модели, запишите голосовое сообщение четко, без лишних звуков на фоне'

            await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIhnDmY9ZMwmJZ7MVja6WLQRMheMsQACnmYAAtkCaEh506_l6mpDDDYE");

            modelListener.set(chatId.toString(), text);

            return await shopBot.sendMessage(chatId, `Вы выбрали конвертацию с помощью ${text === 'Текст' ? 'текста': 'голоса'}.` + '\n' +
                '<b>Выберете модель:</b>' + '\n\n' +
                '‼️<b>Помните</b>' + '\n' +
                comment, {
                    parse_mode: "HTML",
                    reply_markup: {
                        keyboard: [
                            [{
                                text: "Лера"
                            }, {
                                text: 'Анна'
                            }, {
                                text: '↩️ Назад'
                            }]
                        ],
                        resize_keyboard: true
                    }
                }
            )
        }

        if (modelListener.has(chatId.toString())) {
            const messageType = modelListener.get(chatId.toString());
            modelListener.delete(chatId.toString());

            if (!["Лера", 'Анна', 'Андрей'].includes(text))
                return 0;

            const age = text === "Лера" ? 18 : text === 'Анна' ? 21 : 20;

            if (messageType === 'Текст') {
                textMessageToVoiceListener.set(chatId.toString(), text);
            } else {
                voiceMessageToVoiceListener.set(chatId.toString(), text);
            }

            return await shopBot.sendPhoto(chatId, `./images/${text === 'Андрей' ? 'malePhoto': text === "Лера" ? 'Lera' : 'Anna'}.jpg`, {
                caption: `<b>${text}</b>. ${age} лет` + '\n \n' +
                    `${text === 'Андрей' ? andreyDescription: text === "Лера" ? leraDescribtion : annaDescribtion}` + '\n \n' +
                    `Отправьте ${messageType.toLowerCase()}, который хочешь превратить в голосовое послание, и оно прозвучит, словно гимн, достойный царей! 🏛️` + '\n' +
                    'Или нажми “↩️ <b>Назад</b>”, если твой выбор пока не определён. ⚔️',
                    parse_mode: "HTML",
                reply_markup: {
                    keyboard: [
                        [{
                            text: "↩️ Назад"
                        }]
                    ],
                    resize_keyboard: true
                }
            })
        }

        if (textMessageToVoiceListener.has(chatId.toString())) {
            const modelName = textMessageToVoiceListener.get(chatId.toString());

            if (!text || !modelName) {
                return 0;
            }

            if (foundUserOrNull.voicesAvaliable <= 0 && foundUserOrNull.status !== 'admin') {
                textMessageToVoiceListener.delete(chatId.toString());
                return await shopBot.sendMessage(chatId, 'У вас закончились голосовые. Для покупки перейдите в личный кабинет.', {
                    reply_markup: {
                        keyboard: shopBotMainMenuKeyboard
                    }
                });
            }

            try {
                await db.run('UPDATE shop_users SET voicesAvaliable = ? WHERE chatId = ?', [Number(foundUserOrNull.voicesAvaliable) - 1, chatId.toString()], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }

                    console.log('language is updated');
                });

                await db.run('UPDATE shop_users SET totalVoicesRecorded = ? WHERE chatId = ?', [Number(foundUserOrNull.totalVoicesRecorded) + 1, chatId.toString()], function (err) {
                    if (err) {
                        return console.error(err.message);
                    }

                    console.log('language is updated');
                });
            } catch (e) {
                throw new Error(e);
            }

            const speaker = modelName === 'Андрей' ? {
                voice_id: 'm2gtxNsYBaIRqPBA5vU5',
                voice: 'Oleg Krugliak ',
                voice_settings: {
                    stability: 0.7,
                    similarity_boost: 0.76,
                    style: 0.32,
                    use_speaker_boost: false
                }
            } : modelName === "Лера" ? {
                voice_id: "wFyaValVXXUOvVMKrn4K", // Use the correct voice ID (Anna)
                voice: "Anna",
                voice_settings: {
                    stability: 0.54,
                    similarity_boost: 0.48,
                    style: 0.2,
                    use_speaker_boost: true
                }
            } : {
                voice_id: '6CzwEjVC4rBP2a3QLCH0',
                voice: 'Faja',
                voice_settings: {
                    stability: 0.32,
                    similarity_boost: 0.28,
                    style: 0.2,
                    use_speaker_boost: true
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

                // Send the audio buffer directly to Telegram
                await shopBot.sendVoice(chatId, audioBuffer, {
                    filename: 'audio.mp3', // Provide a filename
                    contentType: 'audio/mpeg', // MIME type for audio
                });
            } catch (e) {
                throw new Error(e);
            }
        }
    })
}