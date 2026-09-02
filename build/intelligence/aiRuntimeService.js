"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRuntimeService = void 0;
const intentClassifier_1 = require("./intentClassifier");
const intentLearningService_1 = require("./intentLearningService");
const intentCandidateService_1 = require("./intentCandidateService");
const intentFeedbackService_1 = require("./intentFeedbackService");
const activeLearningService_1 = require("./activeLearningService");
const modelManager_1 = require("./modelManager");
const semanticFeedbackTrainingService_1 = require("./semanticFeedbackTrainingService");
const semanticSafeFineTuningService_1 = require("./semanticSafeFineTuningService");
class AIRuntimeService {
    static initialize() {
        if (this.initialized) {
            return;
        }
        /*
         * O aprendizado incremental de intenção
         * precisa estar carregado antes do classifier
         * ser utilizado.
         */
        intentLearningService_1.IntentLearningService.initialize();
        /*
         * Inicializa os modelos semânticos,
         * carregando os modelos persistidos quando
         * disponíveis ou treinando-os quando necessário.
         */
        modelManager_1.ModelManager.initialize();
        this.initialized = true;
    }
    static ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }
    static isInitialized() {
        return this.initialized;
    }
    static analyzeIntent(text) {
        this.ensureInitialized();
        const prediction = intentClassifier_1.IntentClassifier.predict(text);
        const activeLearning = activeLearningService_1.ActiveLearningService.score(text, prediction);
        return {
            prediction,
            activeLearning,
        };
    }
    /**
     * Analisa uma mensagem e, caso ela possua
     * valor suficiente para active learning,
     * adiciona-a à fila de candidatos.
     */
    static collectCandidate(text, prediction, minimumScore = 0.45) {
        this.ensureInitialized();
        const result = activeLearningService_1.ActiveLearningService.consider(text, prediction, minimumScore);
        if (!result.shouldCollect) {
            return null;
        }
        const normalized = this.normalize(text);
        const candidates = intentCandidateService_1.IntentCandidateService.getPending(1000);
        return (candidates.find(candidate => this.normalize(candidate.text) === normalized) ?? null);
    }
    /**
     * Aprova manualmente um candidato de intenção.
     *
     * O IntentFeedbackService já cuida de:
     * - armazenar o exemplo;
     * - re-treinar o IntentClassifier;
     * - marcar o candidato como revisado.
     */
    static approveIntent(candidateId, intent) {
        this.ensureInitialized();
        return intentFeedbackService_1.IntentFeedbackService.approve(candidateId, intent);
    }
    /**
     * Rejeita um candidato de intenção sem
     * adicioná-lo ao conjunto de treinamento.
     */
    static rejectIntent(candidateId) {
        this.ensureInitialized();
        return intentFeedbackService_1.IntentFeedbackService.reject(candidateId);
    }
    static getPendingIntentCandidates(limit = 10) {
        this.ensureInitialized();
        return intentCandidateService_1.IntentCandidateService.getPending(limit);
    }
    static getPendingIntentCandidateCount() {
        this.ensureInitialized();
        return intentCandidateService_1.IntentCandidateService
            .getPendingCount();
    }
    static getIntentPrediction(text) {
        this.ensureInitialized();
        return intentClassifier_1.IntentClassifier.predict(text);
    }
    static retrainIntentModel() {
        this.ensureInitialized();
        intentLearningService_1.IntentLearningService.retrain();
    }
    /**
     * Inicia um ciclo de fine-tuning semântico
     * controlado pelo AIRuntime.
     *
     * Fluxo:
     *
     * feedback
     *   ↓
     * split disjunto
     *   ↓
     * train + feedback
     *   ↓
     * fine-tuning
     *   ↓
     * promotion gate
     *   ↓
     * ativação OU rollback
     */
    static trainSemanticFromFeedback(options = {}, thresholds = {}) {
        this.ensureInitialized();
        const preparation = semanticFeedbackTrainingService_1.SemanticFeedbackTrainingService
            .prepareTraining(options);
        const safeFineTuning = new semanticSafeFineTuningService_1.SemanticSafeFineTuningService();
        const result = safeFineTuning.run(preparation.input, thresholds);
        return {
            safeFineTuning: result,
            context: preparation.context,
        };
    }
    /**
     * Retorna como o próximo treinamento semântico
     * ficará dividido, sem executar fine-tuning.
     */
    static previewSemanticTraining(options = {}) {
        this.ensureInitialized();
        return semanticFeedbackTrainingService_1.SemanticFeedbackTrainingService
            .preview(options);
    }
    /**
     * Persiste explicitamente os modelos semânticos
     * atualmente ativos.
     */
    static saveModels() {
        this.ensureInitialized();
        modelManager_1.ModelManager.save();
    }
    static getStatus() {
        this.ensureInitialized();
        return {
            initialized: this.initialized,
            intent: {
                trained: intentClassifier_1.IntentClassifier.isTrained(),
                vocabularySize: intentClassifier_1.IntentClassifier
                    .getVocabularySize(),
                trainingExamples: intentClassifier_1.IntentClassifier
                    .getTrainingExampleCount(),
                learnedExamples: intentLearningService_1.IntentLearningService
                    .getLearnedExampleCount(),
                totalExamples: intentLearningService_1.IntentLearningService
                    .getTotalExampleCount(),
                pendingCandidates: intentCandidateService_1.IntentCandidateService
                    .getPendingCount(),
            },
            semantic: modelManager_1.ModelManager.getStatus(),
        };
    }
    static reset() {
        this.initialized = false;
    }
    static normalize(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}
exports.AIRuntimeService = AIRuntimeService;
AIRuntimeService.initialized = false;
