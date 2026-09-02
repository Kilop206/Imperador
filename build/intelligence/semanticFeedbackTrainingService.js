"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticFeedbackTrainingService = void 0;
const modelManager_1 = require("./modelManager");
const semanticFeedbackService_1 = require("./semanticFeedbackService");
const semanticSentenceDataset_1 = require("./semanticSentenceDataset");
const semanticDatasetSplit_1 = require("./semanticDatasetSplit");
const DEFAULT_OPTIONS = {
    seed: 42,
    minimumFeedbackExamples: 1,
    trainRatio: 0.70,
    validationRatio: 0.15,
};
class SemanticFeedbackTrainingService {
    /**
     * Executa um treinamento supervisionado usando
     * os feedbacks semânticos acumulados.
     *
     * O dataset-base é usado como núcleo do treinamento
     * e seus próprios dados são divididos para validation/test.
     *
     * Os feedbacks permanecem exclusivamente no conjunto
     * de treinamento fornecido pelo ModelManager.
     */
    static train(options = {}) {
        const resolved = this.resolveOptions(options);
        const feedback = semanticFeedbackService_1.SemanticFeedbackService
            .getTrainingPairs();
        if (feedback.length <
            resolved.minimumFeedbackExamples) {
            throw new Error(`São necessários pelo menos ${resolved.minimumFeedbackExamples} exemplos de feedback semântico para iniciar o treinamento. Atualmente existem ${feedback.length}.`);
        }
        const split = (0, semanticDatasetSplit_1.splitSemanticDataset)(semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET, {
            trainRatio: resolved.trainRatio,
            validationRatio: resolved.validationRatio,
            seed: resolved.seed,
        });
        /*
         * ModelManager.fineTuneFromFeedback()
         * mantém o dataset-base completo + feedback
         * no treinamento, mas recebe explicitamente
         * os conjuntos de validação e teste.
         *
         * Assim os dados utilizados como validation/test
         * não são os próprios feedbacks supervisionados.
         */
        const result = modelManager_1.ModelManager
            .fineTuneFromFeedback(split.validation, split.test);
        return {
            result,
            context: {
                feedbackCount: feedback.length,
                trainingBaseCount: semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length,
                validationCount: split.validation.length,
                testCount: split.test.length,
                split,
            },
        };
    }
    /**
     * Retorna informações sobre como o próximo treinamento
     * será estruturado, sem iniciar o treinamento.
     */
    static preview(options = {}) {
        const resolved = this.resolveOptions(options);
        const feedback = semanticFeedbackService_1.SemanticFeedbackService
            .getTrainingPairs();
        if (feedback.length <
            resolved.minimumFeedbackExamples) {
            throw new Error(`São necessários pelo menos ${resolved.minimumFeedbackExamples} exemplos de feedback semântico para iniciar o treinamento. Atualmente existem ${feedback.length}.`);
        }
        const split = (0, semanticDatasetSplit_1.splitSemanticDataset)(semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET, {
            trainRatio: resolved.trainRatio,
            validationRatio: resolved.validationRatio,
            seed: resolved.seed,
        });
        return {
            feedbackCount: feedback.length,
            trainingBaseCount: semanticSentenceDataset_1.SEMANTIC_SENTENCE_DATASET.length,
            validationCount: split.validation.length,
            testCount: split.test.length,
            split,
        };
    }
    /**
     * Retorna quantos feedbacks supervisionados existem.
     */
    static getFeedbackCount() {
        return semanticFeedbackService_1.SemanticFeedbackService
            .getCount();
    }
    /**
     * Indica se já existe quantidade suficiente
     * de feedback para iniciar treinamento.
     */
    static canTrain(minimumFeedbackExamples = 1) {
        if (!Number.isFinite(minimumFeedbackExamples)) {
            return false;
        }
        const minimum = Math.max(1, Math.floor(minimumFeedbackExamples));
        return (semanticFeedbackService_1.SemanticFeedbackService
            .getCount() >= minimum);
    }
    /**
     * Retorna o último modelo ativo conhecido
     * pelo ModelManager.
     */
    static getActiveVersion() {
        return modelManager_1.ModelManager
            .getActiveVersion();
    }
    /**
     * Retorna um relatório resumido do treinamento.
     */
    static formatResult(training) {
        const { result, context, } = training;
        const lines = [
            '=== Treinamento por Feedback Semântico ===',
            `Feedbacks utilizados: ${context.feedbackCount}`,
            `Dataset-base: ${context.trainingBaseCount} pares`,
            `Validação: ${context.validationCount} pares`,
            `Teste: ${context.testCount} pares`,
            '',
            `Versão candidata: ${result.candidateVersion}`,
            `Pares originais: ${result.originalPairs}`,
            `Hard negatives: ${result.hardNegativePairs}`,
            `Augmentation: +${result.augmentedPairs}`,
            `Total de treino: ${result.totalTrainingPairs}`,
            '',
            `F1 validação anterior: ${result.previousValidationMetrics.f1.toFixed(4)}`,
            `F1 validação candidata: ${result.candidateValidationMetrics.f1.toFixed(4)}`,
            `Accuracy validação candidata: ${result.candidateValidationMetrics.accuracy.toFixed(4)}`,
            '',
            `Status: ${result.activated
                ? 'ATIVADO'
                : 'REJEITADO'}`,
            `Motivo: ${result.reason}`,
        ];
        if (result.candidateTestMetrics) {
            lines.push('', `F1 teste: ${result.candidateTestMetrics.f1.toFixed(4)}`, `Accuracy teste: ${result.candidateTestMetrics.accuracy.toFixed(4)}`);
        }
        return lines.join('\n');
    }
    static resolveOptions(options) {
        const resolved = {
            seed: options.seed ??
                DEFAULT_OPTIONS.seed,
            minimumFeedbackExamples: options.minimumFeedbackExamples ??
                DEFAULT_OPTIONS
                    .minimumFeedbackExamples,
            trainRatio: options.trainRatio ??
                DEFAULT_OPTIONS
                    .trainRatio,
            validationRatio: options.validationRatio ??
                DEFAULT_OPTIONS
                    .validationRatio,
        };
        if (!Number.isFinite(resolved.seed)) {
            resolved.seed =
                DEFAULT_OPTIONS.seed;
        }
        resolved.minimumFeedbackExamples =
            Math.max(1, Math.floor(Number.isFinite(resolved.minimumFeedbackExamples)
                ? resolved.minimumFeedbackExamples
                : DEFAULT_OPTIONS
                    .minimumFeedbackExamples));
        resolved.trainRatio =
            this.clampRatio(resolved.trainRatio, DEFAULT_OPTIONS.trainRatio);
        resolved.validationRatio =
            this.clampRatio(resolved.validationRatio, DEFAULT_OPTIONS
                .validationRatio);
        const testRatio = 1 -
            resolved.trainRatio -
            resolved.validationRatio;
        if (testRatio <= 0) {
            resolved.trainRatio =
                DEFAULT_OPTIONS.trainRatio;
            resolved.validationRatio =
                DEFAULT_OPTIONS
                    .validationRatio;
        }
        return resolved;
    }
    static clampRatio(value, fallback) {
        if (!Number.isFinite(value)) {
            return fallback;
        }
        return Math.max(0.01, Math.min(0.98, value));
    }
}
exports.SemanticFeedbackTrainingService = SemanticFeedbackTrainingService;
