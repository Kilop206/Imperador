"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticMessageActiveLearningService = void 0;
const aiRuntimeService_1 = require("../intelligence/aiRuntimeService");
const semanticFeedbackService_1 = require("../intelligence/semanticFeedbackService");
/**
 * Serviço responsável por integrar o fluxo de mensagens reais
 * do Discord com o Semantic Active Learning.
 *
 * Pipeline:
 * Discord Message
 *   -> análise
 *   -> semantic analysis
 *   -> active learning
 *   -> candidate queue
 *
 * Regra fundamental:
 * Candidatos identificados como úteis/incertos são ENFILEIRADOS
 * na fila de candidatos (SemanticCandidateService), e NUNCA
 * adicionados automaticamente ao treinamento sem aprovação.
 */
class SemanticMessageActiveLearningService {
    /**
     * Processa um par de textos originados de uma interação do Discord
     * (por exemplo: mensagem do usuário e resposta gerada ou contexto de memória).
     *
     * Avalia a incerteza semântica, conflito lexical/semântico ou novidade.
     * Se os critérios forem atendidos, enfileira o candidato na fila.
     */
    static processInteraction(userMessage, contextOrReply, options = {}) {
        const message = userMessage?.trim();
        const target = contextOrReply?.trim();
        if (!message || !target) {
            return null;
        }
        // Não analisa comandos administrativos como texto de treinamento
        if (message.startsWith('!') || target.startsWith('!')) {
            return null;
        }
        // Não analisa textos idênticos
        if (message.toLowerCase() === target.toLowerCase()) {
            return null;
        }
        try {
            aiRuntimeService_1.AIRuntimeService.ensureInitialized();
            const analysis = aiRuntimeService_1.AIRuntimeService.analyzeSemanticPair(message, target, options);
            return analysis;
        }
        catch (error) {
            console.error('Erro ao processar Semantic Active Learning para mensagem:', error);
            return null;
        }
    }
    /**
     * Retorna os candidatos semânticos pendentes de revisão.
     */
    static getPendingCandidates(limit = 10) {
        try {
            aiRuntimeService_1.AIRuntimeService.ensureInitialized();
            return aiRuntimeService_1.AIRuntimeService.getPendingSemanticCandidates(limit);
        }
        catch (error) {
            console.error('Erro ao consultar candidatos semânticos pendentes:', error);
            return [];
        }
    }
    /**
     * Retorna o total de candidatos semânticos aguardando revisão.
     */
    static getPendingCandidateCount() {
        try {
            aiRuntimeService_1.AIRuntimeService.ensureInitialized();
            return aiRuntimeService_1.AIRuntimeService.getPendingSemanticCandidateCount();
        }
        catch (error) {
            console.error('Erro ao consultar contagem de candidatos semânticos:', error);
            return 0;
        }
    }
    /**
     * Aprova um candidato semântico com o rótulo informado (0 ou 1).
     * O candidato é transformado em feedback e removido da fila pendente.
     */
    static approveCandidate(candidateId, label) {
        try {
            aiRuntimeService_1.AIRuntimeService.ensureInitialized();
            return aiRuntimeService_1.AIRuntimeService.approveSemanticCandidate(candidateId, label);
        }
        catch (error) {
            console.error(`Erro ao aprovar candidato semântico #${candidateId}:`, error);
            return false;
        }
    }
    /**
     * Rejeita um candidato semântico sem adicioná-lo aos dados de treinamento.
     */
    static rejectCandidate(candidateId) {
        try {
            aiRuntimeService_1.AIRuntimeService.ensureInitialized();
            return aiRuntimeService_1.AIRuntimeService.rejectSemanticCandidate(candidateId);
        }
        catch (error) {
            console.error(`Erro ao rejeitar candidato semântico #${candidateId}:`, error);
            return false;
        }
    }
    /**
     * Retorna o status operacional da fila e do repositório de feedback.
     */
    static getStatus() {
        try {
            aiRuntimeService_1.AIRuntimeService.ensureInitialized();
            return {
                pendingCandidateCount: aiRuntimeService_1.AIRuntimeService.getPendingSemanticCandidateCount(),
                totalFeedbackCount: semanticFeedbackService_1.SemanticFeedbackService.getCount(),
                isInitialized: aiRuntimeService_1.AIRuntimeService.isInitialized(),
            };
        }
        catch {
            return {
                pendingCandidateCount: 0,
                totalFeedbackCount: 0,
                isInitialized: false,
            };
        }
    }
}
exports.SemanticMessageActiveLearningService = SemanticMessageActiveLearningService;
