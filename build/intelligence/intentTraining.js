"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trainAndEvaluateIntentModel = trainAndEvaluateIntentModel;
const intentDataset_1 = require("./intentDataset");
const intentEvaluation_1 = require("./intentEvaluation");
const intentDatasetQuality_1 = require("./intentDatasetQuality");
function trainAndEvaluateIntentModel(testRatio = 0.2, seed = 42) {
    /*
     * Verifica a qualidade do dataset
     * antes de permitir o treinamento.
     */
    const datasetQuality = (0, intentDatasetQuality_1.analyzeDatasetQuality)(intentDataset_1.INTENT_DATASET);
    if (!datasetQuality.isValid) {
        throw new Error([
            'Dataset inválido:',
            ...datasetQuality.errors,
        ].join('\n'));
    }
    const { train, test, } = (0, intentEvaluation_1.splitDataset)(intentDataset_1.INTENT_DATASET, testRatio, seed);
    const result = (0, intentEvaluation_1.evaluateIntentClassifier)(train, test);
    return {
        trainingExamples: train.length,
        testExamples: test.length,
        accuracy: result.accuracy,
        report: (0, intentEvaluation_1.formatEvaluationReport)(result),
    };
}
