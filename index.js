import handleShopBotCallbackQuery from "./handlers/handleShopBotCallbackQuery.js";
import handleShopBotMessage from "./handlers/handleShopBotMessage.js";
import handleShopBotStartMessage from "./handlers/handleShopBotStartMessage.js";
import handleShopBotVoiceMessage from "./handlers/handleShopBotVoiceMessage.js";
import createUsersTable from "./services/createUsersTable.js";
import openConnection from "./utils/openDbConnection.js";

const db = await openConnection();

createUsersTable(db);

handleShopBotStartMessage(db);

handleShopBotMessage(db);

handleShopBotCallbackQuery(db);

handleShopBotVoiceMessage(db);