"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitSemanticDataset = splitSemanticDataset;
exports.evaluateTfidf = evaluateTfidf;
exports.evaluateNeural = evaluateNeural;
exports.evaluateSemanticModels = evaluateSemanticModels;
exports.formatMetrics = formatMetrics;
exports.formatEvaluationReport = formatEvaluationReport;
const tfidfVectorizer_1 = require("./tfidfVectorizer");
function splitSemanticDataset(dataset, validationRatio = 0.2, seed = 42) {
    if (!Array.isArray(dataset)) {
        throw new TypeError("dataset deve ser um array.");
    }
    if (validationRatio <= 0 ||
        validationRatio >= 1) {
        throw new RangeError("validationRatio deve estar entre 0 e 1.");
    }
    const random = createSeededRandom(seed);
    const shuffled = [...dataset];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [
            shuffled[index],
            shuffled[swapIndex],
        ] = [
            shuffled[swapIndex],
            shuffled[index],
        ];
    }
    const validationSize = Math.max(1, Math.floor(shuffled.length * validationRatio));
    return {
        training: shuffled.slice(0, shuffled.length - validationSize),
        validation: shuffled.slice(shuffled.length - validationSize),
    };
}
function evaluateTfidf(training, validation, threshold = 0.5) {
    const documents = [];
    for (const pair of training) {
        documents.push(pair.first);
        documents.push(pair.second);
    }
    const vectorizer = new tfidfVectorizer_1.TfidfVectorizer();
    vectorizer.fit(documents);
    const predictions = validation.map((pair) => ({
        label: pair.label,
        score: tfidfVectorizer_1.TfidfVectorizer.cosineSimilarity(vectorizer.transformOne(pair.first), vectorizer.transformOne(pair.second)),
    }));
    return calculateMetrics(predictions, threshold);
}
function evaluateNeural(wordModel, sentenceModel, validation, threshold = 0.5) {
    const predictions = validation.map((pair) => ({
        label: pair.label,
        score: sentenceModel.similarity(wordModel, pair.first, pair.second),
    }));
    return calculateMetrics(predictions, threshold);
}
function evaluateSemanticModels(wordModel, sentenceModel, training, validation, options = {}) {
    const threshold = options.threshold ?? 0.5;
    return {
        tfidf: evaluateTfidf(training, validation, threshold),
        neural: evaluateNeural(wordModel, sentenceModel, validation, threshold),
    };
}
function formatMetrics(name, metrics) {
    return [
        `=== ${name} ===`,
        `Total: ${metrics.total}`,
        `Positivos: ${metrics.positiveCount}`,
        `Negativos: ${metrics.negativeCount}`,
        `Accuracy: ${formatNumber(metrics.accuracy)}`,
        `Precision: ${formatNumber(metrics.precision)}`,
        `Recall: ${formatNumber(metrics.recall)}`,
        `F1: ${formatNumber(metrics.f1)}`,
        `Score positivo médio: ${formatNumber(metrics.positiveAverageScore)}`,
        `Score negativo médio: ${formatNumber(metrics.negativeAverageScore)}`,
        `TP: ${metrics.truePositive}`,
        `TN: ${metrics.trueNegative}`,
        `FP: ${metrics.falsePositive}`,
        `FN: ${metrics.falseNegative}`,
    ].join("\n");
}
function formatEvaluationReport(result) {
    return [
        formatMetrics("TF-IDF", result.tfidf),
        "",
        formatMetrics("Neural", result.neural),
    ].join("\n");
}
function calculateMetrics(predictions, threshold) {
    if (predictions.length === 0) {
        return {
            total: 0,
            positiveCount: 0,
            negativeCount: 0,
            truePositive: 0,
            trueNegative: 0,
            falsePositive: 0,
            falseNegative: 0,
            accuracy: 0,
            precision: 0,
            recall: 0,
            f1: 0,
            positiveAverageScore: 0,
            negativeAverageScore: 0,
        };
    }
    let truePositive = 0;
    let trueNegative = 0;
    let falsePositive = 0;
    let falseNegative = 0;
    let positiveScoreSum = 0;
    let negativeScoreSum = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    for (const prediction of predictions) {
        const predicted = prediction.score >= threshold ? 1 : 0;
        if (prediction.label === 1) {
            positiveCount += 1;
            positiveScoreSum += prediction.score;
            if (predicted === 1) {
                truePositive += 1;
            }
            else {
                falseNegative += 1;
            }
        }
        else {
            negativeCount += 1;
            negativeScoreSum += prediction.score;
            if (predicted === 0) {
                trueNegative += 1;
            }
            else {
                falsePositive += 1;
            }
        }
    }
    const total = predictions.length;
    const accuracy = (truePositive + trueNegative) /
        total;
    const precision = truePositive + falsePositive === 0
        ? 0
        : truePositive /
            (truePositive + falsePositive);
    const recall = truePositive + falseNegative === 0
        ? 0
        : truePositive /
            (truePositive + falseNegative);
    const f1 = precision + recall === 0
        ? 0
        : (2 * precision * recall) /
            (precision + recall);
    return {
        total,
        positiveCount,
        negativeCount,
        truePositive,
        trueNegative,
        falsePositive,
        falseNegative,
        accuracy,
        precision,
        recall,
        f1,
        positiveAverageScore: positiveCount === 0
            ? 0
            : positiveScoreSum /
                positiveCount,
        negativeAverageScore: negativeCount === 0
            ? 0
            : negativeScoreSum /
                negativeCount,
    };
}
function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state =
            (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
function formatNumber(value) {
    return value.toFixed(4);
}
