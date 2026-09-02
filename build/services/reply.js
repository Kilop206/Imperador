"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReplyService = void 0;
const config_1 = require("../config/config");
const triggerManager_1 = require("./triggerManager");
const modeManager_1 = require("./modeManager");
const rarityManager_1 = require("./rarityManager");
const responseEngine_1 = require("./responseEngine");
const autoMemoryService_1 = require("./autoMemoryService");
const intentCandidateService_1 = require("../intelligence/intentCandidateService");
const intentFeedbackService_1 = require("../intelligence/intentFeedbackService");
const intentLearningService_1 = require("../intelligence/intentLearningService");
const semanticMessageActiveLearningService_1 = require("./semanticMessageActiveLearningService");
const SPECIAL_COMMANDS = new Set([
    '!tiberio_caotico',
    '!tiberio_bebado',
    '!tiberio_normal',
    '!tiberio_ameaca',
    '!tiberio_humor',
    '!tiberio_serio',
    '!tiberio_nostalgico',
    '!tiberio_filosofico',
    '!tiberio_romano',
    '!tiberio_status',
    '!tiberio_raro',
    '!tiberio_triggers',
    '!tiberio_memoria',
    '!tiberio_candidatos',
    '!tiberio_rotular',
    '!tiberio_rejeitar',
    '!tiberio_semantic_candidatos',
    '!tiberio_semantic_status',
]);
const VALID_INTENTS = [
    'aggressive',
    'compliment',
    'question',
    'greeting',
    'farewell',
    'humor',
    'serious',
    'nostalgic',
    'philosophical',
    'roman',
    'neutral',
];
class ReplyService {
    static getLearningCandidates() {
        const candidates = intentCandidateService_1.IntentCandidateService.getPending(10);
        if (candidates.length === 0) {
            return ('Não existem candidatos de intenção aguardando rotulagem.');
        }
        const lines = [
            '=== Candidatos de intenção ===',
        ];
        for (const candidate of candidates) {
            lines.push(`#${candidate.id} | ` +
                `"${candidate.text}" | ` +
                `previsto: ${candidate.predictedIntent} | ` +
                `confiança: ${(candidate.confidence * 100).toFixed(2)}%`);
        }
        lines.push('');
        lines.push('Para rotular: !tiberio_rotular ID intenção');
        lines.push('Para rejeitar: !tiberio_rejeitar ID');
        return lines.join('\n');
    }
    static getSemanticLearningCandidates() {
        const candidates = semanticMessageActiveLearningService_1.SemanticMessageActiveLearningService.getPendingCandidates(10);
        if (candidates.length === 0) {
            return ('Não existem candidatos semânticos aguardando rotulagem.');
        }
        const lines = [
            '=== Candidatos Semânticos (Active Learning) ===',
        ];
        for (const candidate of candidates) {
            lines.push(`#${candidate.id} | ` +
                `"${candidate.first}" <-> "${candidate.second}" | ` +
                `score: ${(candidate.predictedScore * 100).toFixed(1)}% | ` +
                `razão: ${candidate.reason}`);
        }
        lines.push('');
        lines.push('Para rotular: !tiberio_semantic_rotular ID 0|1 (1 = similar, 0 = diferente)');
        lines.push('Para rejeitar: !tiberio_semantic_rejeitar ID');
        return lines.join('\n');
    }
    static handleCandidateLabel(content) {
        const payload = content
            .slice('!tiberio_rotular'.length)
            .trim();
        const parts = payload.split(/\s+/);
        if (parts.length < 2) {
            return ('Formato: !tiberio_rotular ID intenção');
        }
        const id = Number.parseInt(parts[0], 10);
        const intent = parts[1].toLowerCase();
        const validIntents = [
            'aggressive',
            'compliment',
            'question',
            'greeting',
            'farewell',
            'humor',
            'serious',
            'nostalgic',
            'philosophical',
            'roman',
            'neutral',
        ];
        if (!Number.isInteger(id)) {
            return 'ID inválido.';
        }
        if (!validIntents.includes(intent)) {
            return (`Intenção inválida. Use: ${validIntents.join(', ')}`);
        }
        const candidate = intentCandidateService_1.IntentCandidateService.getById(id);
        if (!candidate) {
            return (`Candidato #${id} não encontrado.`);
        }
        if (candidate.reviewed) {
            return (`Candidato #${id} já foi revisado.`);
        }
        intentFeedbackService_1.IntentFeedbackService.approve(id, intent);
        return (`Candidato #${id} rotulado como "${intent}". ` +
            `Modelo retreinado com ${IntentLearningServiceSafeCount()} exemplos.`);
    }
    static handleSemanticCandidateLabel(content) {
        const prefix = content.toLowerCase().startsWith('!tiberio_semantic_aprovar')
            ? '!tiberio_semantic_aprovar'
            : '!tiberio_semantic_rotular';
        const payload = content
            .slice(prefix.length)
            .trim();
        const parts = payload.split(/\s+/);
        if (parts.length < 2) {
            return ('Formato: !tiberio_semantic_rotular ID 0|1');
        }
        const id = Number.parseInt(parts[0], 10);
        const labelVal = Number.parseInt(parts[1], 10);
        if (!Number.isInteger(id)) {
            return 'ID inválido.';
        }
        if (labelVal !== 0 &&
            labelVal !== 1) {
            return 'Rótulo inválido. Use 1 para similar ou 0 para não similar.';
        }
        const approved = semanticMessageActiveLearningService_1.SemanticMessageActiveLearningService.approveCandidate(id, labelVal);
        if (!approved) {
            return `Não foi possível aprovar o candidato semântico #${id} (não encontrado ou já revisado).`;
        }
        return (`Candidato semântico #${id} aprovado com rótulo ${labelVal}. ` +
            'Exemplo adicionado com segurança ao repositório de feedback para o próximo ciclo de treino.');
    }
    static handleCandidateRejection(content) {
        const payload = content
            .slice('!tiberio_rejeitar'.length)
            .trim();
        const id = Number.parseInt(payload, 10);
        if (!Number.isInteger(id)) {
            return ('Formato: !tiberio_rejeitar ID');
        }
        const rejected = intentFeedbackService_1.IntentFeedbackService.reject(id);
        return rejected
            ? `Candidato #${id} rejeitado.`
            : `Candidato #${id} não encontrado.`;
    }
    static handleSemanticCandidateRejection(content) {
        const payload = content
            .slice('!tiberio_semantic_rejeitar'.length)
            .trim();
        const id = Number.parseInt(payload, 10);
        if (!Number.isInteger(id)) {
            return ('Formato: !tiberio_semantic_rejeitar ID');
        }
        const rejected = semanticMessageActiveLearningService_1.SemanticMessageActiveLearningService.rejectCandidate(id);
        return rejected
            ? `Candidato semântico #${id} rejeitado.`
            : `Candidato semântico #${id} não encontrado.`;
    }
    static shouldReply(message) {
        if (!config_1.config.allowedChannels.includes(message.channelId)) {
            return false;
        }
        if (message.author.bot) {
            return false;
        }
        const command = message.content
            .toLowerCase()
            .trim();
        if (SPECIAL_COMMANDS.has(command) ||
            command.startsWith('!tiberio_aprender ') ||
            command ===
                '!tiberio_aprender' ||
            command ===
                '!tiberio_aprendizado' ||
            command.startsWith('!tiberio_rotular ') ||
            command.startsWith('!tiberio_rejeitar ') ||
            command.startsWith('!tiberio_semantic_rotular ') ||
            command.startsWith('!tiberio_semantic_aprovar ') ||
            command.startsWith('!tiberio_semantic_rejeitar ')) {
            return true;
        }
        return (responseEngine_1.ResponseEngine
            .generateCandidates(message.content, message.author.id)
            .length > 0);
    }
    static getReply(message) {
        const content = message.content;
        const command = content
            .toLowerCase()
            .trim();
        const userId = message.author.id;
        const username = message.author.username;
        if (command ===
            '!tiberio_aprendizado') {
            return this.getLearningStatus();
        }
        if (command ===
            '!tiberio_aprender') {
            return ('Formato: !tiberio_aprender intenção | texto');
        }
        if (command.startsWith('!tiberio_aprender ')) {
            return this.handleLearningCommand(content);
        }
        if (command ===
            '!tiberio_candidatos') {
            return this.getLearningCandidates();
        }
        if (command.startsWith('!tiberio_rotular ')) {
            return this.handleCandidateLabel(content);
        }
        if (command.startsWith('!tiberio_rejeitar ')) {
            return this.handleCandidateRejection(content);
        }
        if (command ===
            '!tiberio_semantic_candidatos') {
            return this.getSemanticLearningCandidates();
        }
        if (command.startsWith('!tiberio_semantic_rotular ') ||
            command.startsWith('!tiberio_semantic_aprovar ')) {
            return this.handleSemanticCandidateLabel(content);
        }
        if (command.startsWith('!tiberio_semantic_rejeitar ')) {
            return this.handleSemanticCandidateRejection(content);
        }
        if (command ===
            '!tiberio_semantic_status') {
            return this.getSemanticLearningStatus();
        }
        if (SPECIAL_COMMANDS.has(command)) {
            return this.handleCommand(content, userId, username);
        }
        return responseEngine_1.ResponseEngine.selectResponse(content, userId);
    }
    static handleLearningCommand(content) {
        const payload = content.slice('!tiberio_aprender'.length).trim();
        const separatorIndex = payload.indexOf('|');
        if (separatorIndex < 0) {
            return ('Formato inválido. Use: !tiberio_aprender intenção | texto');
        }
        const intentText = payload
            .slice(0, separatorIndex)
            .trim()
            .toLowerCase();
        const trainingText = payload
            .slice(separatorIndex + 1)
            .trim();
        if (!VALID_INTENTS.includes(intentText)) {
            return (`Intenção inválida. Use uma destas: ${VALID_INTENTS.join(', ')}`);
        }
        if (!trainingText) {
            return ('O texto de treinamento não pode estar vazio.');
        }
        try {
            const learned = intentLearningService_1.IntentLearningService.learn(trainingText, intentText);
            if (!learned) {
                return ('Esse exemplo já pertence ao conjunto de aprendizado.');
            }
            return (`Exemplo aprendido como "${intentText}". ` +
                `Modelo retreinado com ${intentLearningService_1.IntentLearningService.getModelTrainingCount()} exemplos.`);
        }
        catch (error) {
            return (`Falha ao aprender exemplo: ${error instanceof Error
                ? error.message
                : String(error)}`);
        }
    }
    static getLearningStatus() {
        try {
            intentLearningService_1.IntentLearningService.ensureInitialized();
            return [
                '=== Aprendizado de Tibério (Intenção) ===',
                `Exemplos base: ${intentLearningService_1.IntentLearningService.getTotalExampleCount() - intentLearningService_1.IntentLearningService.getLearnedExampleCount()}`,
                `Exemplos aprendidos: ${intentLearningService_1.IntentLearningService.getLearnedExampleCount()}`,
                `Total no modelo: ${intentLearningService_1.IntentLearningService.getModelTrainingCount()}`,
                `Candidatos de intenção pendentes: ${intentCandidateService_1.IntentCandidateService.getPendingCount()}`,
            ].join('\n');
        }
        catch (error) {
            return (`Falha ao consultar aprendizado: ${error instanceof Error
                ? error.message
                : String(error)}`);
        }
    }
    static getSemanticLearningStatus() {
        try {
            const status = semanticMessageActiveLearningService_1.SemanticMessageActiveLearningService.getStatus();
            return [
                '=== Aprendizado Semântico de Tibério (Active Learning) ===',
                `Candidatos semânticos pendentes: ${status.pendingCandidateCount}`,
                `Feedbacks acumulados: ${status.totalFeedbackCount}`,
                `Módulo inicializado: ${status.isInitialized ? 'Sim' : 'Não'}`,
            ].join('\n');
        }
        catch (error) {
            return (`Falha ao consultar aprendizado semântico: ${error instanceof Error
                ? error.message
                : String(error)}`);
        }
    }
    static handleCommand(content, userId, _username) {
        const command = content
            .toLowerCase()
            .trim();
        switch (command) {
            case '!tiberio_caotico':
            case '!tiberio_bebado':
                modeManager_1.ModeManager.setMode('drunk');
                return 'Tibério aceita oficialmente esta contribuição ao Império.';
            case '!tiberio_normal':
                modeManager_1.ModeManager.resetToNormal();
                return 'Ordem restaurada.';
            case '!tiberio_ameaca':
                modeManager_1.ModeManager.setMode('threat');
                return 'Sua insolência foi registrada.';
            case '!tiberio_humor':
                modeManager_1.ModeManager.setMode('humor');
                return 'Roma não é contrária ao entretenimento.';
            case '!tiberio_serio':
                modeManager_1.ModeManager.setMode('serious');
                return 'O Imperador assume a postura apropriada.';
            case '!tiberio_nostalgico':
                modeManager_1.ModeManager.setMode('nostalgic');
                return 'O passado nem sempre permanece no passado.';
            case '!tiberio_filosofico':
                modeManager_1.ModeManager.setMode('philosophical');
                return 'Existem questões que transcendem o Império.';
            case '!tiberio_romano':
                modeManager_1.ModeManager.setMode('roman');
                return 'SPQR.';
            case '!tiberio_status':
                return (`Modo atual: ${modeManager_1.ModeManager.getMode()}\n` +
                    `Triggers: ${triggerManager_1.TriggerManager.getTriggerStatus()}`);
            case '!tiberio_raro':
                return (rarityManager_1.RarityManager.getRandomRareResponse() ??
                    'O Imperador não tem nada a dizer no momento.');
            case '!tiberio_triggers':
                triggerManager_1.TriggerManager.resetTriggers();
                return 'Triggers resetados.';
            case '!tiberio_memoria': {
                if (!userId) {
                    return 'Tibério não conseguiu identificar você.';
                }
                const memory = autoMemoryService_1.AutoMemoryService.getMemorySummary(userId);
                return (memory ||
                    'Os arquivos do Imperador estão vazios.');
            }
            default:
                return null;
        }
    }
    static async reply(message) {
        try {
            const replyText = this.getReply(message);
            if (!replyText) {
                return;
            }
            await message.reply(replyText);
            console.log(`Resposta enviada para mensagem de ${message.author.username}: ${replyText}`);
            /*
             * Integração com Semantic Active Learning:
             * Avalia a interação do usuário com a resposta emitida.
             * Se o par revelar incerteza semântica, novidade ou conflito,
             * é enfileirado como candidato semântico para revisão humana posterior.
             * NÃO adiciona ao treinamento automaticamente.
             */
            const trimmedContent = message.content.trim();
            if (!trimmedContent.startsWith('!')) {
                semanticMessageActiveLearningService_1.SemanticMessageActiveLearningService.processInteraction(trimmedContent, replyText);
            }
        }
        catch (error) {
            console.error('Erro ao enviar resposta:', error);
        }
    }
}
exports.ReplyService = ReplyService;
function IntentLearningServiceSafeCount() {
    return intentLearningService_1.IntentLearningService
        .getModelTrainingCount();
}
