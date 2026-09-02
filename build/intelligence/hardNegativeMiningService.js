"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HardNegativeMiningService = void 0;
const semanticErrorAnalysis_1 = require("./semanticErrorAnalysis");
class HardNegativeMiningService {
    constructor() {
        this.examples = [];
    }
    mine(predictions, options = {}) {
        if (!Array.isArray(predictions)) {
            throw new TypeError("predictions deve ser um array.");
        }
        const maxExamples = Math.max(1, Math.floor(options.maxExamples ?? 20));
        const minimumScore = Math.max(0, Math.min(1, options.minimumScore ?? 0.5));
        const analysis = {
            total: predictions.length,
            correct: 0,
            incorrect: 0,
            falsePositive: predictions.filter((prediction) => prediction.expected === 0 &&
                prediction.predicted === 1),
            falseNegative: predictions.filter((prediction) => prediction.expected === 1 &&
                prediction.predicted === 0),
            predictions,
        };
        const candidates = (0, semanticErrorAnalysis_1.getHardestErrors)(analysis, maxExamples * 3).filter((prediction) => prediction.errorType ===
            "false-positive" &&
            prediction.score >=
                minimumScore);
        const mined = [];
        for (const candidate of candidates) {
            if (this.exists(candidate.first, candidate.second)) {
                continue;
            }
            const example = {
                first: candidate.first,
                second: candidate.second,
                label: 0,
                source: "model-error",
                score: candidate.score,
                createdAt: Date.now(),
            };
            this.examples.push(example);
            mined.push(example);
            if (mined.length >= maxExamples) {
                break;
            }
        }
        return mined;
    }
    mineFromAnalysis(analysis, options = {}) {
        return this.mine(analysis.predictions, options);
    }
    getExamples() {
        return this.examples.map((example) => ({
            ...example,
        }));
    }
    getExampleCount() {
        return this.examples.length;
    }
    toTrainingExamples() {
        return this.examples.map((example) => ({
            first: example.first,
            second: example.second,
            label: 0,
        }));
    }
    remove(first, second) {
        const before = this.examples.length;
        this.examples = this.examples.filter((example) => !samePair(example.first, example.second, first, second));
        return (this.examples.length !== before);
    }
    clear() {
        this.examples = [];
    }
    exportData() {
        return this.getExamples();
    }
    importData(examples) {
        if (!Array.isArray(examples)) {
            throw new TypeError("examples deve ser um array.");
        }
        for (const example of examples) {
            if (typeof example?.first !== "string" ||
                typeof example?.second !== "string" ||
                example.first.trim().length === 0 ||
                example.second.trim().length === 0 ||
                example.label !== 0 ||
                example.source !==
                    "model-error" ||
                typeof example.score !==
                    "number" ||
                typeof example.createdAt !==
                    "number") {
                throw new TypeError("Hard negative inválido.");
            }
        }
        this.examples = [];
        for (const example of examples) {
            if (!this.exists(example.first, example.second)) {
                this.examples.push({
                    first: example.first,
                    second: example.second,
                    label: 0,
                    source: "model-error",
                    score: example.score,
                    createdAt: example.createdAt,
                });
            }
        }
        return this;
    }
    exists(first, second) {
        return this.examples.some((example) => samePair(example.first, example.second, first, second));
    }
}
exports.HardNegativeMiningService = HardNegativeMiningService;
function normalize(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
function samePair(firstA, secondA, firstB, secondB) {
    const a1 = normalize(firstA);
    const a2 = normalize(secondA);
    const b1 = normalize(firstB);
    const b2 = normalize(secondB);
    return ((a1 === b1 && a2 === b2) ||
        (a1 === b2 && a2 === b1));
}
