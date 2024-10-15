import TelegramApi from 'node-telegram-bot-api';
import { shopBotToken } from "../config.js";

const shopBot = new TelegramApi(shopBotToken, {
    polling: true
});

export default shopBot;