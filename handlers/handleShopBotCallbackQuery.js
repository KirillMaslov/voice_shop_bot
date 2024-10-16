import {
    channelChatId,
    creatorNick,
    cryptoBotAPIKey,
    shopBotAdminCommands
} from "../config.js";
import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import {
    shopBotMainMenuKeyboard
} from "../utils/keyboards.js";
import CryptoBotAPI from 'crypto-bot-api';
import shopBot from "../utils/shopBot.js";
import getShopBotAdminsFromDb from "../middlewares/getShopBotAdminsFromDb.js";


const CryptoBotClient = new CryptoBotAPI(cryptoBotAPIKey);

export default async function handleShopBotCallbackQuery(db) {
    shopBot.on('callback_query', async (query) => {
        const queryId = query.id;
        const chatId = query.message.chat.id;
        const messageId = query.message.message_id;
        const foundUserOrNull = await getShopBotUserOrNullByChatId(chatId.toString(), db);

        if (query.data === 'soldOut') {
            return await shopBot.answerCallbackQuery(queryId, {
                text: 'Данный товар распродан, ожидайте его поступления!',
                show_alert: true,
            });
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

        if (query.data === 'check_subscription') {
            const chatMembership = await shopBot.getChatMember(channelChatId, chatId);

            console.log(chatMembership);

            if (chatMembership.status !== 'left') {
                try {
                    db.run('UPDATE shop_users SET isSubscribed = ? WHERE chatId = ?', [
                        1,
                        chatId.toString(),
                    ], function (err) {
                        if (err) {
                            return console.error(err.message);
                        }

                        console.log(`Email adress was updated`);
                    });
                } catch (e) {
                    throw new Error(e);
                }

                await shopBot.answerCallbackQuery(queryId, {
                    text: 'Вы успешно подписались на канал',
                    show_alert: true,
                });

                await shopBot.editMessageText('✅ Вы подписались на наш канал', {
                    reply_markup: {
                        inline_keyboard: []
                    },
                    chat_id: chatId,
                    message_id: messageId
                });

                const avaliableNumber = foundUserOrNull ? foundUserOrNull.voicesAvaliable : 3;

                await shopBot.sendSticker(chatId, "CAACAgIAAxkBAAEucIpnDmZuToviJWSuPB_N-oVGbci7IQACNFkAAjiScEjRPtOS1bNCfTYE");

                return await shopBot.sendAnimation(chatId, './images/intro.MP4', {
                    parse_mode: "HTML",
                    caption:  '👋<b>👋 Привет, герой! Я бот, который превращает текст в мощные голосовые сообщения, словно Аид одним движением разрубает цепи! 💪⚡️</b>' + '\n \n' +
                    `Создатель: @${creatorNick}, , мастер звука! 🎤🔥` + '\n \n' +
                    `У тебя есть <b>${avaliableNumber}</b> бесплатных голосовых сообщений — используй их с умом, как Аид использует свою силу! 🏆💥 Готов создать что-то эпическое? Тогда вперед! 🎧✨`,
                    reply_markup: {
                        keyboard: shopBotMainMenuKeyboard,
                        resize_keyboard: true
                    }
                });
            }

            await shopBot.answerCallbackQuery(queryId, {
                text: 'Подписка на канал не найдена, подпишитесь на канал и нажмите кнопку повторно',
                show_alert: true,
            });

        }

        if (query.data.includes('payWithCryptoBot')) {
            const goodId = query.data.split('_')[1];
            const good = await getShopBotGoodFromDbById(goodId, db);
            if (!good) {
                return await shopBot.editMessageText('Данного товара уже нету в боте, воспользуйтесь меню', {
                    chat_id: chatId,
                    message_id: messageId
                })
            }

            const newInvoice = await CryptoBotClient.createInvoice({
                amount: good.cost,
                currency: "USDT"
            });

            console.log(newInvoice);

            return await shopBot.editMessageText('✅ Счет на оплату CryptoBot создан, нажмите "<b>Перейти к оплате</b>" и оплатите товар.' + '\n \n' +
                `Сумма к оплате: <b>${good.cost} USDT</b>` + '\n \n' +
                'После оплаты бот передаст ваш заказ администрации и вы получите товар.', {
                    parse_mode: "HTML",
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: {
                        inline_keyboard: [
                            [{
                                text: '✅ Перейти к оплате',
                                url: newInvoice.payUrl
                            }],
                            [{
                                text: '☑️ Проверить оплату',
                                callback_data: `checkCryptoBotPayment_${goodId}_${newInvoice.id}`
                            }],
                            [{
                                text: 'Назад 🔙',
                                callback_data: `selectGood_${goodId}`
                            }]
                        ]
                    }
                });
        }

        if (query.data.includes('checkCryptoBotPayment')) {
            const voicesNumber = query.data.split('_')[1];
            const invoiceId = query.data.split('_')[2];

            console.log('invoiceId: ', invoiceId);

            const newInvoice = await CryptoBotClient.getInvoices({
                asset: "USDT",
                invoice_ids: [invoiceId],
                count: 1
            });

            console.log('Invoice: ', newInvoice)

            if (newInvoice.items[0].status === 'active') {
                return await shopBot.answerCallbackQuery(queryId, {
                    text: 'Вы ещё не оплатили ваш товар! Оплатите его по ссылке под сообщением',
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


            await shopBot.answerCallbackQuery(queryId, {
                text: '💸 Ваша покупка успешно завершена!',
                show_alert: true,
            });

            return await shopBot.editMessageText('💸 <b>Ваша покупка успешно завершена!</b>.' + "\n" +
                '🥰 <b><i>Число доступных вам голосовых было изменено</i></b>', {
                    chat_id: chatId,
                    message_id: messageId,
                    parse_mode: "HTML",
                    reply_markup: {
                        inline_keyboard: []
                    }
                }
            );
        }

    });
}