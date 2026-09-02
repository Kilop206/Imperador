"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitDataset = splitDataset;
exports.evaluateIntentClassifier = evaluateIntentClassifier;
exports.formatEvaluationReport = formatEvaluationReport;
const intentClassifier_1 = require("./intentClassifier");
const INTENTS = [
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
function createEmptyMatrix() {
    const matrix = {};
    for (const actual of INTENTS) {
        matrix[actual] =
            {};
        for (const predicted of INTENTS) {
            matrix[actual][predicted] = 0;
        }
    }
    return matrix;
}
function splitDataset(examples, testRatio = 0.2, seed = 42) {
    if (examples.length < 2) {
        throw new Error('O dataset precisa possuir pelo menos 2 exemplos.');
    }
    if (testRatio <= 0 ||
        testRatio >= 1) {
        throw new Error('testRatio deve estar entre 0 e 1.');
    }
    const indexed = examples.map((example, index) => ({
        example,
        index,
    }));
    let state = Math.abs(Math.floor(seed)) || 1;
    const random = () => {
        state =
            (state * 1664525 + 1013904223) %
                4294967296;
        return state / 4294967296;
    };
    for (let i = indexed.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [
            indexed[i],
            indexed[j],
        ] = [
            indexed[j],
            indexed[i],
        ];
    }
    const testSize = Math.max(1, Math.floor(examples.length * testRatio));
    const shuffled = indexed.map(item => item.example);
    const test = shuffled.slice(0, testSize);
    const testSet = new Set(test);
    const train = shuffled.filter(example => !testSet.has(example));
    if (train.length === 0) {
        throw new Error('A divisão gerou um conjunto de treinamento vazio.');
    }
    return {
        train,
        test,
    };
}
function evaluateIntentClassifier(trainingExamples, testExamples) {
    if (trainingExamples.length === 0) {
        throw new Error('O conjunto de treinamento está vazio.');
    }
    if (testExamples.length === 0) {
        throw new Error('O conjunto de teste está vazio.');
    }
    intentClassifier_1.IntentClassifier.reset();
    intentClassifier_1.IntentClassifier.train(trainingExamples);
    const confusionMatrix = createEmptyMatrix();
    let correct = 0;
    for (const example of testExamples) {
        const prediction = intentClassifier_1.IntentClassifier.predict(example.text);
        confusionMatrix[example.intent][prediction.intent] += 1;
        if (prediction.intent ===
            example.intent) {
            correct += 1;
        }
    }
    const classes = INTENTS.map(intent => {
        const row = confusionMatrix[intent];
        const support = Object.values(row).reduce((sum, value) => sum + value, 0);
        const truePositive = row[intent];
        let predictedPositive = 0;
        for (const actual of INTENTS) {
            predictedPositive +=
                confusionMatrix[actual][intent];
        }
        const precision = predictedPositive === 0
            ? 0
            : truePositive /
                predictedPositive;
        const recall = support === 0
            ? 0
            : truePositive /
                support;
        const f1 = precision + recall === 0
            ? 0
            : (2 *
                precision *
                recall) /
                (precision + recall);
        return {
            intent,
            support,
            correct: truePositive,
            precision,
            recall,
            f1,
        };
    });
    return {
        totalExamples: testExamples.length,
        correct,
        accuracy: correct /
            testExamples.length,
        classes,
        confusionMatrix,
    };
}
function formatEvaluationReport(result) {
    const lines = [];
    lines.push('=== Intent Classifier Evaluation ===');
    lines.push(`Examples: ${result.totalExamples}`);
    lines.push(`Correct: ${result.correct}`);
    lines.push(`Accuracy: ${(result.accuracy * 100).toFixed(2)}%`);
    lines.push('');
    lines.push('Intent            Support   Precision   Recall   F1');
    for (const metrics of result.classes) {
        lines.push(`${metrics.intent.padEnd(17)} ` +
            `${String(metrics.support).padStart(7)}   ` +
            `${(metrics.precision * 100)
                .toFixed(2)
                .padStart(8)}%   ` +
            `${(metrics.recall * 100)
                .toFixed(2)
                .padStart(6)}%   ` +
            `${(metrics.f1 * 100)
                .toFixed(2)
                .padStart(6)}%`);
    }
    return lines.join('\n');
}
