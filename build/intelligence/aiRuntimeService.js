"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRuntimeService = void 0;
const intentClassifier_1 = require("./intentClassifier");
const intentLearningService_1 = require("./intentLearningService");
const intentCandidateService_1 = require("./intentCandidateService");
const intentFeedbackService_1 = require("./intentFeedbackService");
const activeLearningService_1 = require("./activeLearningService");
const modelManager_1 = require("./modelManager");
const semanticActiveLearningService_1 = require("./semanticActiveLearningService");
const semanticCandidateService_1 = require("./semanticCandidateService");
const semanticFeedbackService_1 = require("./semanticFeedbackService");
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
     * Analisa semanticamente dois textos e os envia
     * ao pipeline de Semantic Active Learning.
     *
     * O método não força a criação de candidato:
     * isso depende da política configurada no
     * SemanticActiveLearningService.
     */
    static analyzeSemanticPair(first, second, options = {}, noveltyScore = 1, tfidfScore, keywordScore, retrievalScore) {
        this.ensureInitialized();
        const normalizedFirst = first.trim();
        const normalizedSecond = second.trim();
        if (!normalizedFirst ||
            !normalizedSecond) {
            throw new Error('Os textos do par semântico não podem estar vazios.');
        }
        const semanticScore = modelManager_1.ModelManager
            .getSentenceModel()
            .similarity(modelManager_1.ModelManager
            .getWordEmbeddingModel(), normalizedFirst, normalizedSecond);
        const input = {
            first: normalizedFirst,
            second: normalizedSecond,
            semanticScore,
            tfidfScore,
            keywordScore,
            retrievalScore,
            noveltyScore,
        };
        const score = semanticActiveLearningService_1.SemanticActiveLearningService.score(input, options);
        const candidate = semanticActiveLearningService_1.SemanticActiveLearningService.consider(input, options);
        return {
            input,
            score,
            candidate,
        };
    }
    /**
     * Retorna os candidatos semânticos pendentes
     * ordenados pelo próprio CandidateService.
     */
    static getPendingSemanticCandidates(limit = 20) {
        this.ensureInitialized();
        return semanticCandidateService_1.SemanticCandidateService
            .getPending(limit);
    }
    /**
     * Retorna a quantidade de candidatos semânticos
     * aguardando revisão.
     */
    static getPendingSemanticCandidateCount() {
        this.ensureInitialized();
        return semanticCandidateService_1.SemanticCandidateService
            .getPendingCount();
    }
    /**
     * Aprova um candidato semântico como par positivo
     * ou negativo.
     *
     * O candidato vira feedback supervisionado humano
     * e deixa de aparecer na fila de revisão.
     */
    static approveSemanticCandidate(candidateId, label) {
        this.ensureInitialized();
        const candidate = semanticCandidateService_1.SemanticCandidateService.getById(candidateId);
        if (!candidate) {
            return false;
        }
        if (candidate.reviewed) {
            return false;
        }
        if (label !== 0 &&
            label !== 1) {
            return false;
        }
        const feedback = semanticFeedbackService_1.SemanticFeedbackService.add(candidate.first, candidate.second, label, 'human');
        /*
         * Um par que já exista como feedback não deve
         * impedir a revisão de ser finalizada.
         *
         * Isso cobre o caso de o feedback ter sido
         * inserido por outra rotina depois da criação
         * do candidato.
         */
        if (!feedback &&
            !semanticFeedbackService_1.SemanticFeedbackService.hasPair(candidate.first, candidate.second, label)) {
            return false;
        }
        return semanticCandidateService_1.SemanticCandidateService
            .markReviewed(candidateId);
    }
    /**
     * Rejeita um candidato semântico.
     *
     * Nenhum dado é adicionado ao treinamento.
     */
    static rejectSemanticCandidate(candidateId) {
        this.ensureInitialized();
        return semanticCandidateService_1.SemanticCandidateService
            .markReviewed(candidateId);
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
