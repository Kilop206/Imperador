"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("./config/config");
const memoryService_1 = require("./services/memoryService");
const scheduler_1 = require("./services/scheduler");
const reply_1 = require("./services/reply");
const triggerManager_1 = require("./services/triggerManager");
const modeManager_1 = require("./services/modeManager");
const autoMemoryService_1 = require("./services/autoMemoryService");
const textAnalyzer_1 = require("./services/textAnalyzer");
const emotionEngine_1 = require("./intelligence/emotionEngine");
const emotionState_1 = require("./state/emotionState");
const modelManager_1 = require("./intelligence/modelManager");
const responseEngine_1 = require("./services/responseEngine");
const EMOTION_DECAY_INTERVAL_MS = 5 * 60 * 1000;
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
let scheduler;
let emotionDecayInterval;
client.once('ready', () => {
    console.log(`Bot conectado como ${client.user?.tag}`);
    memoryService_1.MemoryService.initialize();
    (0, emotionState_1.restoreEmotions)(memoryService_1.MemoryService.loadEmotions());
    /*
     * Inicializa a infraestrutura semântica
     * somente depois de o sistema de memória
     * estar pronto.
     */
    try {
        modelManager_1.ModelManager.initialize();
        responseEngine_1.ResponseEngine.setSemanticService(modelManager_1.ModelManager.getSemanticContextService());
        console.log('Inteligência semântica inicializada:', modelManager_1.ModelManager.getStatus());
    }
    catch (error) {
        /*
         * A camada semântica é complementar.
         * Se ela falhar, o restante do bot continua
         * funcionando normalmente.
         */
        console.error('Erro ao inicializar inteligência semântica:', error);
    }
    emotionDecayInterval =
        setInterval(() => {
            emotionEngine_1.EmotionEngine.decay();
            memoryService_1.MemoryService.saveEmotions(emotionEngine_1.EmotionEngine.getState());
            console.log(`Estado emocional atualizado: ${emotionEngine_1.EmotionEngine.describeMood()}`);
        }, EMOTION_DECAY_INTERVAL_MS);
    scheduler =
        new scheduler_1.SchedulerService(client);
    scheduler.start();
});
client.on('messageCreate', async (message) => {
    if (message.author.bot) {
        return;
    }
    triggerManager_1.TriggerManager.checkTriggers(message.content);
    /*
     * Todas as mensagens humanas passam
     * pelos sistemas de memória e emoção,
     * independentemente de Tibério responder.
     */
    const analysis = textAnalyzer_1.TextAnalyzer.analyze(message.content);
    autoMemoryService_1.AutoMemoryService.processMessage(message.author.id, message.author.username, message.content);
    emotionEngine_1.EmotionEngine.processMessage(analysis);
    memoryService_1.MemoryService.saveEmotions(emotionEngine_1.EmotionEngine.getState());
    if (reply_1.ReplyService.shouldReply(message)) {
        await reply_1.ReplyService.reply(message);
    }
});
client.on('error', error => {
    console.error('Erro no cliente Discord:', error);
});
const shutdown = (signal) => {
    console.log(`Recebido ${signal}, desligando bot...`);
    if (emotionDecayInterval) {
        clearInterval(emotionDecayInterval);
        emotionDecayInterval =
            undefined;
    }
    scheduler?.stop();
    modeManager_1.ModeManager.clearModeTimeout();
    /*
     * Garante que o estado emocional
     * atual seja salvo antes do encerramento.
     */
    memoryService_1.MemoryService.saveEmotions(emotionEngine_1.EmotionEngine.getState());
    memoryService_1.MemoryService.close();
    client.destroy();
    process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
async function main() {
    if (!(0, config_1.validateConfig)()) {
        process.exit(1);
    }
    try {
        memoryService_1.MemoryService.initialize();
        await client.login(config_1.config.token);
    }
    catch (error) {
        console.error('Erro ao iniciar o bot:', error);
        if (emotionDecayInterval) {
            clearInterval(emotionDecayInterval);
        }
        memoryService_1.MemoryService.close();
        process.exit(1);
    }
}
void main();
