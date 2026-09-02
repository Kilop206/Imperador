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
const aiRuntimeService_1 = require("./intelligence/aiRuntimeService");
const modelManager_1 = require("./intelligence/modelManager");
const responseEngine_1 = require("./services/responseEngine");
const memoryContext_1 = require("./services/memoryContext");
const semanticMessageActiveLearningService_1 = require("./services/semanticMessageActiveLearningService");
const autonomousAgentOrchestrator_1 = require("./intelligence/autonomousAgentOrchestrator");
const safetyPermissionEngine_1 = require("./intelligence/safetyPermissionEngine");
const toolRegistry_1 = require("./intelligence/toolRegistry");
const observationEngine_1 = require("./intelligence/observationEngine");
const EMOTION_DECAY_INTERVAL_MS = 5 * 60 * 1000;
const AI_STATUS_INTERVAL_MS = 30 * 60 * 1000;
const AUTONOMOUS_AGENT_INTERVAL_MS = 15 * 1000;
const AUTONOMOUS_AGENT_STATUS_INTERVAL_MS = 5 * 60 * 1000;
const autonomousAgentEnabled = process.env.AUTONOMOUS_AGENT_ENABLED ===
    'true';
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
    ],
});
let scheduler;
let emotionDecayInterval;
let aiStatusInterval;
let autonomousAgentInterval;
let autonomousAgentStatusInterval;
let autonomousAgent;
client.once('ready', () => {
    console.log(`Bot conectado como ${client.user?.tag}`);
    memoryService_1.MemoryService.initialize();
    (0, emotionState_1.restoreEmotions)(memoryService_1.MemoryService.loadEmotions());
    try {
        aiRuntimeService_1.AIRuntimeService.initialize();
        responseEngine_1.ResponseEngine.setSemanticService(modelManager_1.ModelManager
            .getSemanticContextService());
        console.log('Módulo de IA inicializado:', aiRuntimeService_1.AIRuntimeService.getStatus());
    }
    catch (error) {
        console.error('Erro ao inicializar o módulo de IA:', error);
    }
    /*
     * O AutonomousAgentOrchestrator possui suas próprias
     * barreiras de segurança, mas permanece completamente
     * desligado em produção até AUTONOMOUS_AGENT_ENABLED
     * ser explicitamente definido como "true".
     */
    try {
        const toolRegistry = new toolRegistry_1.ToolRegistry();
        const safetyPermissionEngine = new safetyPermissionEngine_1.SafetyPermissionEngine(toolRegistry);
        const observationEngine = new observationEngine_1.ObservationEngine();
        autonomousAgent =
            new autonomousAgentOrchestrator_1.AutonomousAgentOrchestrator(safetyPermissionEngine, observationEngine, {
                enabled: autonomousAgentEnabled,
                minimumCycleIntervalMs: AUTONOMOUS_AGENT_INTERVAL_MS,
                maximumCyclesPerWindow: 30,
                cycleWindowMs: 60 * 60 * 1000,
            });
        console.log(`Agente autônomo ${autonomousAgentEnabled
            ? 'habilitado'
            : 'desabilitado'}.`);
        if (autonomousAgentEnabled) {
            autonomousAgentInterval =
                setInterval(() => {
                    if (!autonomousAgent) {
                        return;
                    }
                    void autonomousAgent
                        .tick()
                        .then(result => {
                        if (result.decision ===
                            'executed' ||
                            result.decision ===
                                'blocked' ||
                            result.decision ===
                                'failed' ||
                            result.decision ===
                                'completed' ||
                            result.decision ===
                                'plan_created' ||
                            result.decision ===
                                'goal_created') {
                            console.log('Ciclo autônomo:', result);
                        }
                    })
                        .catch(error => {
                        console.error('Erro no ciclo do agente autônomo:', error);
                    });
                }, AUTONOMOUS_AGENT_INTERVAL_MS);
            autonomousAgentStatusInterval =
                setInterval(() => {
                    if (!autonomousAgent) {
                        return;
                    }
                    console.log('Estado do agente autônomo:', autonomousAgent.getStatus());
                }, AUTONOMOUS_AGENT_STATUS_INTERVAL_MS);
        }
    }
    catch (error) {
        autonomousAgent =
            undefined;
        console.error('Erro ao inicializar o agente autônomo:', error);
    }
    emotionDecayInterval =
        setInterval(() => {
            emotionEngine_1.EmotionEngine.decay();
            memoryService_1.MemoryService.saveEmotions(emotionEngine_1.EmotionEngine.getState());
            console.log(`Estado emocional atualizado: ${emotionEngine_1.EmotionEngine.describeMood()}`);
        }, EMOTION_DECAY_INTERVAL_MS);
    aiStatusInterval =
        setInterval(() => {
            try {
                console.log('Estado do módulo de IA:', aiRuntimeService_1.AIRuntimeService.getStatus());
            }
            catch (error) {
                console.error('Erro ao consultar estado da IA:', error);
            }
        }, AI_STATUS_INTERVAL_MS);
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
    else {
        /*
         * Para mensagens que não geram resposta direta,
         * verifica se há memória contextual relevante para
         * alimentar o Semantic Active Learning com pares contextuais.
         *
         * Não adiciona automaticamente ao treinamento.
         */
        const trimmed = message.content.trim();
        if (!trimmed.startsWith('!')) {
            const relevantMemory = memoryContext_1.MemoryContextService.findRelevantMemory(message.author.id, trimmed);
            if (relevantMemory &&
                relevantMemory.summary) {
                semanticMessageActiveLearningService_1.SemanticMessageActiveLearningService
                    .processInteraction(trimmed, relevantMemory.summary);
            }
        }
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
    if (aiStatusInterval) {
        clearInterval(aiStatusInterval);
        aiStatusInterval =
            undefined;
    }
    if (autonomousAgentInterval) {
        clearInterval(autonomousAgentInterval);
        autonomousAgentInterval =
            undefined;
    }
    if (autonomousAgentStatusInterval) {
        clearInterval(autonomousAgentStatusInterval);
        autonomousAgentStatusInterval =
            undefined;
    }
    scheduler?.stop();
    modeManager_1.ModeManager.clearModeTimeout();
    memoryService_1.MemoryService.saveEmotions(emotionEngine_1.EmotionEngine.getState());
    try {
        modelManager_1.ModelManager.save();
    }
    catch (error) {
        console.error('Erro ao persistir modelos da IA durante encerramento:', error);
    }
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
        aiRuntimeService_1.AIRuntimeService.initialize();
        await client.login(config_1.config.token);
    }
    catch (error) {
        console.error('Erro ao iniciar o bot:', error);
        if (emotionDecayInterval) {
            clearInterval(emotionDecayInterval);
        }
        if (aiStatusInterval) {
            clearInterval(aiStatusInterval);
        }
        if (autonomousAgentInterval) {
            clearInterval(autonomousAgentInterval);
        }
        if (autonomousAgentStatusInterval) {
            clearInterval(autonomousAgentStatusInterval);
        }
        memoryService_1.MemoryService.close();
        process.exit(1);
    }
}
void main();
