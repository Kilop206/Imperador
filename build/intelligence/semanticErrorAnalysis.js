"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeTfidfErrors = analyzeTfidfErrors;
exports.analyzeNeuralErrors = analyzeNeuralErrors;
exports.formatPrediction = formatPrediction;
exports.formatErrorAnalysis = formatErrorAnalysis;
exports.getHardestErrors = getHardestErrors;
const tfidfVectorizer_1 = require("./tfidfVectorizer");
function analyzeTfidfErrors(training, test, options = {}) {
    const threshold = options.threshold ?? 0.5;
    const vectorizer = new tfidfVectorizer_1.TfidfVectorizer();
    const documents = [];
    for (const pair of training) {
        documents.push(pair.first);
        documents.push(pair.second);
    }
    vectorizer.fit(documents);
    const predictions = test.map((pair) => {
        const firstVector = vectorizer.transformOne(pair.first);
        const secondVector = vectorizer.transformOne(pair.second);
        const score = tfidfVectorizer_1.TfidfVectorizer.cosineSimilarity(firstVector, secondVector);
        return createPrediction(pair, score, threshold);
    });
    return buildAnalysis(predictions);
}
function analyzeNeuralErrors(wordModel, sentenceModel, test, options = {}) {
    const threshold = options.threshold ?? 0.5;
    const predictions = test.map((pair) => {
        const score = sentenceModel.similarity(wordModel, pair.first, pair.second);
        return createPrediction(pair, score, threshold);
    });
    return buildAnalysis(predictions);
}
function formatPrediction(prediction) {
    const expected = prediction.expected === 1
        ? "RELACIONADAS"
        : "NÃO RELACIONADAS";
    const predicted = prediction.predicted === 1
        ? "RELACIONADAS"
        : "NÃO RELACIONADAS";
    const errorLabel = prediction.errorType ===
        "false-positive"
        ? "FALSO POSITIVO"
        : "FALSO NEGATIVO";
    return [
        `Tipo: ${errorLabel}`,
        `Frase A: ${prediction.first}`,
        `Frase B: ${prediction.second}`,
        `Esperado: ${expected}`,
        `Modelo: ${predicted}`,
        `Score: ${prediction.score.toFixed(4)}`,
    ].join("\n");
}
function formatErrorAnalysis(name, analysis) {
    const lines = [
        `=== ${name} ===`,
        `Total: ${analysis.total}`,
        `Acertos: ${analysis.correct}`,
        `Erros: ${analysis.incorrect}`,
        `Falsos positivos: ${analysis.falsePositive.length}`,
        `Falsos negativos: ${analysis.falseNegative.length}`,
    ];
    if (analysis.incorrect === 0) {
        lines.push("", "Nenhum erro encontrado.");
        return lines.join("\n");
    }
    lines.push("", "ERROS:");
    for (const prediction of analysis.predictions) {
        if (prediction.expected !==
            prediction.predicted) {
            lines.push("", formatPrediction(prediction));
        }
    }
    return lines.join("\n");
}
function getHardestErrors(analysis, limit = 5) {
    return analysis.predictions
        .filter((prediction) => prediction.expected !==
        prediction.predicted)
        .sort((first, second) => getErrorDifficulty(second) -
        getErrorDifficulty(first))
        .slice(0, Math.max(1, limit));
}
function createPrediction(pair, score, threshold) {
    const predicted = score >= threshold ? 1 : 0;
    const errorType = predicted === pair.label
        ? null
        : predicted === 1
            ? "false-positive"
            : "false-negative";
    return {
        first: pair.first,
        second: pair.second,
        expected: pair.label,
        predicted,
        score,
        errorType: errorType ?? "false-positive",
    };
}
function buildAnalysis(predictions) {
    const falsePositive = predictions.filter((prediction) => prediction.expected === 0 &&
        prediction.predicted === 1);
    const falseNegative = predictions.filter((prediction) => prediction.expected === 1 &&
        prediction.predicted === 0);
    const incorrect = falsePositive.length +
        falseNegative.length;
    return {
        total: predictions.length,
        correct: predictions.length - incorrect,
        incorrect,
        falsePositive,
        falseNegative,
        predictions,
    };
}
function getErrorDifficulty(prediction) {
    if (prediction.errorType ===
        "false-positive") {
        return prediction.score;
    }
    return 1 - prediction.score;
}
