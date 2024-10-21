import {
    ElevenLabsClient,
    ElevenLabs
} from "elevenlabs";
import {
    pipeline,
    Readable
} from 'stream';
import fs, {
    writeFileSync,
    mkdirSync,
    existsSync
} from 'fs';
import path, {
    dirname,
} from 'path';
import {
    fileURLToPath
} from 'url';
import shopBot from "../utils/shopBot.js";
import {
    elevenLabsApiKey
} from '../config.js';
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = dirname(__filename);
import fetch from 'node-fetch';
import {
    voiceMessageToVoiceListener
} from "../utils/maps.js";
import getShopBotUserOrNullByChatId from "../middlewares/getShopBotUserOrNullByChatId.js";
import {
    shopBotMainMenuKeyboardEn,
    shopBotMainMenuKeyboardRu
} from "../utils/keyboards.js";


const imagesDir = path.join(__dirname, '../images');
// Ensure the images directory exists
if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir);
}

const client = new ElevenLabsClient({
    apiKey: elevenLabsApiKey
});

export default async function handleShopBotVoiceMessage(db) {
    shopBot.on('voice', async (msg) => {
        const chatId = msg.chat.id;

        const foundUserOrNull = await getShopBotUserOrNullByChatId(chatId.toString(), db);
        let messageText = '';
        let resultKeyboard;

        if (voiceMessageToVoiceListener.has(chatId.toString())) {
            const modelName = voiceMessageToVoiceListener.get(chatId.toString());
            if (!modelName) {
                return 0;
            }

            if (foundUserOrNull.voicesAvaliable <= 0 && foundUserOrNull.status !== 'admin') {
                voiceMessageToVoiceListener.delete(chatId.toString());
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

            let voiceId;
            let voice_setting;

            switch (modelName) {
                case "Лера": {
                    voiceId = "wFyaValVXXUOvVMKrn4K";
                    voice_setting = {
                        stability: 0.54,
                        similarity_boost: 0.48,
                        style: 0.2,
                        use_speaker_boost: true

                    };
                    break;
                }

                case "Анна": {
                    voiceId = '6CzwEjVC4rBP2a3QLCH0';
                    voice_setting = {
                        stability: 0.32,
                        similarity_boost: 0.28,
                        style: 0.2,
                        use_speaker_boost: true
                    };
                    break;
                }

                case 'Lera': {
                    voiceId = '2rJo4BNbDooc3q89IWVH';
                    voice_setting = {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0,
                        use_speaker_boost: true
                    };
                    break;
                }

                case 'Ann': {
                    voiceId = 'BSHBic1jFUy7dqyXEdTY';
                    voice_setting = {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0,
                        use_speaker_boost: true
                    };
                    break;
                }

                default: {
                    voiceId = '6CzwEjVC4rBP2a3QLCH0';
                    voice_setting = {
                        stability: 0.32,
                        similarity_boost: 0.28,
                        style: 0.2,
                        use_speaker_boost: true
                    };
                    break;
                }
            }

            const fileId = msg.voice.file_id;

            try {
                // Get the file URL
                const fileUrl = await shopBot.getFileLink(fileId);

                // Download the voice message and get a readable stream
                const response = await fetch(fileUrl);
                if (!response.ok) throw new Error(`Error fetching voice message: ${response.statusText}`);

                // Convert the response to a Buffer
                const audioArrayBuffer = await response.arrayBuffer();

                // Create a Buffer from the ArrayBuffer
                const audioBuffer = Buffer.from(audioArrayBuffer);

                // Create a Readable stream from the Buffer
                const audioStream = new Readable();
                audioStream.push(audioBuffer);
                audioStream.push(null); // Signal the end of the stream

                // Make the request to ElevenLabs API, streaming the audio directly
                const apiResponse = await client.speechToSpeech.convert(voiceId, {
                    audio: audioStream, // Specify output format if needed
                    model_id: "eleven_multilingual_sts_v2",
                    voice_settings: JSON.stringify(voice_setting)
                });


                // Collect the audio data from the readable stream returned by the API
                const chunks = [];
                for await (const chunk of apiResponse) {
                    chunks.push(chunk);
                }
                const processedAudioBuffer = Buffer.concat(chunks);

                // Send the processed audio back as a voice message
                await shopBot.sendVoice(chatId, processedAudioBuffer, {
                    filename: 'audio.mp3', // Provide a filename
                    contentType: 'audio/mpeg', // MIME type for audio
                });
            } catch (error) {
                console.error('Error handling voice message:', error);
                await shopBot.sendMessage(chatId, 'Sorry, there was an error processing your voice message.');
            }
        }
    });
}