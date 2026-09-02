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
    static prepareTraining(options = {}) {
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
        const trainingDataset = [
            ...split.train,
            ...feedback,
        ];
        const input = {
            originalDataset: trainingDataset,
            validationDataset: split.validation,
            testDataset: split.test,
        };
        return {
            input,
            context: {
                feedbackCount: feedback.length,
                trainingBaseCount: split.train.length,
                validationCount: split.validation.length,
                testCount: split.test.length,
                split,
            },
        };
    }
    static train(options = {}) {
        const preparation = this.prepareTraining(options);
        const result = modelManager_1.ModelManager.fineTune(preparation.input);
        return {
            result,
            context: preparation.context,
        };
    }
    static preview(options = {}) {
        return this.prepareTraining(options).context;
    }
    static getFeedbackCount() {
        return semanticFeedbackService_1.SemanticFeedbackService
            .getCount();
    }
    static canTrain(minimumFeedbackExamples = 1) {
        if (!Number.isFinite(minimumFeedbackExamples)) {
            return false;
        }
        const minimum = Math.max(1, Math.floor(minimumFeedbackExamples));
        return (semanticFeedbackService_1.SemanticFeedbackService
            .getCount() >= minimum);
    }
    static getActiveVersion() {
        return modelManager_1.ModelManager
            .getActiveVersion();
    }
    static formatResult(training) {
        const { result, context, } = training;
        const lines = [
            '=== Treinamento por Feedback Semântico ===',
            `Feedbacks utilizados: ${context.feedbackCount}`,
            `Dataset-base no treino: ${context.trainingBaseCount} pares`,
            `Total efetivo de treino: ${result.totalTrainingPairs} pares`,
            `Validação: ${context.validationCount} pares`,
            `Teste: ${context.testCount} pares`,
            '',
            `Versão candidata: ${result.candidateVersion}`,
            `Pares originais: ${result.originalPairs}`,
            `Hard negatives: ${result.hardNegativePairs}`,
            `Augmentation: +${result.augmentedPairs}`,
            `Total de treino reportado: ${result.totalTrainingPairs}`,
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
