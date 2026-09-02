"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentLearningService = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const intentClassifier_1 = require("./intentClassifier");
const intentDataset_1 = require("./intentDataset");
const VALID_INTENTS = [
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
const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DEFAULT_FILE_PATH = path.join(DATA_DIRECTORY, 'intent_learning.json');
const MAX_LEARNED_EXAMPLES = 5000;
class IntentLearningService {
    static initialize(filePath = DEFAULT_FILE_PATH) {
        this.filePath = filePath;
        if (this.initialized) {
            return;
        }
        this.data = this.load();
        this.initialized = true;
        this.train();
    }
    static ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }
    static learn(text, intent) {
        this.ensureInitialized();
        const normalizedText = text.trim();
        if (!normalizedText) {
            throw new Error('O texto de treinamento não pode estar vazio.');
        }
        if (!VALID_INTENTS.includes(intent)) {
            throw new Error(`Intenção inválida: ${intent}`);
        }
        const normalizedForComparison = this.normalizeForComparison(normalizedText);
        const alreadyExists = intentDataset_1.INTENT_DATASET.some(example => this.normalizeForComparison(example.text) === normalizedForComparison &&
            example.intent === intent) ||
            this.data.examples.some(example => this.normalizeForComparison(example.text) === normalizedForComparison &&
                example.intent === intent);
        if (alreadyExists) {
            return false;
        }
        if (this.data.examples.length >=
            MAX_LEARNED_EXAMPLES) {
            throw new Error(`Limite de ${MAX_LEARNED_EXAMPLES} exemplos aprendidos atingido.`);
        }
        this.data.examples.push({
            text: normalizedText,
            intent,
        });
        this.save();
        this.train();
        return true;
    }
    static getLearnedExamples() {
        this.ensureInitialized();
        return [
            ...this.data.examples,
        ];
    }
    static getLearnedExampleCount() {
        this.ensureInitialized();
        return this.data.examples.length;
    }
    static getTotalExampleCount() {
        this.ensureInitialized();
        return (intentDataset_1.INTENT_DATASET.length +
            this.data.examples.length);
    }
    static getModelTrainingCount() {
        this.ensureInitialized();
        return (intentClassifier_1.IntentClassifier
            .getTrainingExampleCount());
    }
    static removeLearnedExample(text, intent) {
        this.ensureInitialized();
        const normalizedText = this.normalizeForComparison(text);
        const index = this.data.examples.findIndex(example => this.normalizeForComparison(example.text) === normalizedText &&
            example.intent === intent);
        if (index < 0) {
            return false;
        }
        this.data.examples.splice(index, 1);
        this.save();
        this.train();
        return true;
    }
    static clearLearnedExamples() {
        this.ensureInitialized();
        this.data.examples = [];
        this.save();
        this.train();
    }
    static retrain() {
        this.ensureInitialized();
        this.train();
    }
    static train() {
        intentClassifier_1.IntentClassifier.train([
            ...intentDataset_1.INTENT_DATASET,
            ...this.data.examples,
        ]);
    }
    static load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return {
                    version: 1,
                    examples: [],
                };
            }
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1 ||
                !Array.isArray(parsed.examples)) {
                throw new Error('Arquivo de aprendizado inválido.');
            }
            const examples = parsed.examples.filter(example => this.isValidExample(example));
            return {
                version: 1,
                examples,
            };
        }
        catch (error) {
            throw new Error(`Não foi possível carregar o aprendizado incremental: ${error instanceof Error
                ? error.message
                : String(error)}`);
        }
    }
    static save() {
        fs.mkdirSync(path.dirname(this.filePath), {
            recursive: true,
        });
        const content = JSON.stringify(this.data, null, 2);
        const temporaryPath = `${this.filePath}.tmp`;
        fs.writeFileSync(temporaryPath, content, 'utf-8');
        fs.renameSync(temporaryPath, this.filePath);
    }
    static isValidExample(example) {
        if (!example ||
            typeof example !== 'object') {
            return false;
        }
        const candidate = example;
        return (typeof candidate.text ===
            'string' &&
            candidate.text.trim()
                .length > 0 &&
            typeof candidate.intent ===
                'string' &&
            VALID_INTENTS.includes(candidate.intent));
    }
    static normalizeForComparison(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
}
exports.IntentLearningService = IntentLearningService;
IntentLearningService.filePath = DEFAULT_FILE_PATH;
IntentLearningService.data = {
    version: 1,
    examples: [],
};
IntentLearningService.initialized = false;
