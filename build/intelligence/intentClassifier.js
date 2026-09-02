"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentClassifier = void 0;
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
const STOP_WORDS = new Set([
    'a',
    'o',
    'as',
    'os',
    'um',
    'uma',
    'uns',
    'umas',
    'de',
    'do',
    'da',
    'dos',
    'das',
    'em',
    'no',
    'na',
    'nos',
    'nas',
    'por',
    'para',
    'com',
    'sem',
    'e',
    'ou',
    'que',
    'se',
    'me',
    'te',
    'eu',
    'voce',
    'você',
]);
const ALPHA = 1;
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function tokenize(text) {
    return normalize(text)
        .split(' ')
        .filter(token => token.length > 1 &&
        !STOP_WORDS.has(token));
}
class IntentClassifier {
    static createEmptyModel() {
        const classCounts = {};
        const tokenCounts = {};
        const totalTokens = {};
        for (const intent of INTENTS) {
            classCounts[intent] = 0;
            tokenCounts[intent] = {};
            totalTokens[intent] = 0;
        }
        return {
            vocabulary: [],
            classCounts,
            tokenCounts,
            totalTokens,
            totalExamples: 0,
        };
    }
    static train(examples) {
        if (examples.length === 0) {
            throw new Error('O conjunto de treinamento não pode estar vazio.');
        }
        const model = this.createEmptyModel();
        const vocabulary = new Set();
        for (const example of examples) {
            const intent = example.intent;
            if (!INTENTS.includes(intent)) {
                throw new Error(`Intenção inválida: ${intent}`);
            }
            const tokens = tokenize(example.text);
            model.classCounts[intent] += 1;
            model.totalExamples += 1;
            for (const token of tokens) {
                vocabulary.add(token);
                const currentCount = model.tokenCounts[intent][token] ??
                    0;
                model.tokenCounts[intent][token] =
                    currentCount + 1;
                model.totalTokens[intent] += 1;
            }
        }
        model.vocabulary =
            [...vocabulary].sort();
        this.model = model;
        this.trained = true;
    }
    static predict(text) {
        if (!this.trained) {
            throw new Error('IntentClassifier ainda não foi treinado.');
        }
        const tokens = tokenize(text);
        const vocabularySize = Math.max(this.model.vocabulary.length, 1);
        const logProbabilities = {};
        let maxLogProbability = Number.NEGATIVE_INFINITY;
        for (const intent of INTENTS) {
            const classCount = this.model.classCounts[intent];
            if (classCount === 0) {
                logProbabilities[intent] =
                    Number.NEGATIVE_INFINITY;
                continue;
            }
            const prior = classCount /
                this.model.totalExamples;
            let score = Math.log(prior);
            const denominator = this.model.totalTokens[intent] +
                ALPHA * vocabularySize;
            for (const token of tokens) {
                const count = this.model.tokenCounts[intent][token] ??
                    0;
                const probability = (count + ALPHA) /
                    denominator;
                score += Math.log(probability);
            }
            logProbabilities[intent] =
                score;
            if (score >
                maxLogProbability) {
                maxLogProbability = score;
            }
        }
        const probabilities = {};
        let probabilitySum = 0;
        for (const intent of INTENTS) {
            const logProbability = logProbabilities[intent];
            if (!Number.isFinite(logProbability)) {
                probabilities[intent] = 0;
                continue;
            }
            const value = Math.exp(logProbability -
                maxLogProbability);
            probabilities[intent] = value;
            probabilitySum += value;
        }
        if (probabilitySum > 0) {
            for (const intent of INTENTS) {
                probabilities[intent] /=
                    probabilitySum;
            }
        }
        let predictedIntent = 'neutral';
        let confidence = 0;
        for (const intent of INTENTS) {
            if (probabilities[intent] >
                confidence) {
                confidence =
                    probabilities[intent];
                predictedIntent =
                    intent;
            }
        }
        return {
            intent: predictedIntent,
            confidence,
            probabilities,
        };
    }
    static isTrained() {
        return this.trained;
    }
    static getVocabularySize() {
        return this.model.vocabulary.length;
    }
    static getTrainingExampleCount() {
        return this.model.totalExamples;
    }
    static exportModel() {
        if (!this.trained) {
            throw new Error('IntentClassifier ainda não foi treinado.');
        }
        return JSON.stringify(this.model, null, 2);
    }
    static importModel(serializedModel) {
        const parsed = JSON.parse(serializedModel);
        if (!Array.isArray(parsed.vocabulary) ||
            !parsed.classCounts ||
            !parsed.tokenCounts ||
            !parsed.totalTokens ||
            typeof parsed.totalExamples !==
                'number') {
            throw new Error('Modelo de intenção inválido.');
        }
        this.model = parsed;
        this.trained = true;
    }
    static reset() {
        this.model =
            this.createEmptyModel();
        this.trained = false;
    }
}
exports.IntentClassifier = IntentClassifier;
_a = IntentClassifier;
IntentClassifier.model = _a.createEmptyModel();
IntentClassifier.trained = false;
