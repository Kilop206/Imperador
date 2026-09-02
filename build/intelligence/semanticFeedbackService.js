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
exports.SemanticFeedbackService = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DEFAULT_FILE_PATH = path.join(DATA_DIRECTORY, 'semantic_feedback.json');
const MAX_FEEDBACK = 5000;
class SemanticFeedbackService {
    static initialize(filePath = DEFAULT_FILE_PATH) {
        this.filePath = filePath;
        if (this.initialized) {
            return;
        }
        this.data = this.load();
        this.initialized = true;
    }
    static ensureInitialized() {
        if (!this.initialized) {
            this.initialize();
        }
    }
    static add(first, second, label, source = 'human') {
        this.ensureInitialized();
        const normalizedFirst = first.trim();
        const normalizedSecond = second.trim();
        if (!normalizedFirst ||
            !normalizedSecond) {
            return null;
        }
        if (normalizedFirst ===
            normalizedSecond) {
            return null;
        }
        if (label !== 0 &&
            label !== 1) {
            return null;
        }
        if (source !== 'human' &&
            source !== 'automatic' &&
            source !== 'hard-negative') {
            return null;
        }
        const normalizedPair = this.normalizePair(normalizedFirst, normalizedSecond);
        const alreadyExists = this.data.feedback.some(item => this.normalizePair(item.first, item.second) === normalizedPair &&
            item.label === label);
        if (alreadyExists) {
            return null;
        }
        if (this.data.feedback.length >=
            MAX_FEEDBACK) {
            this.removeOldest();
        }
        const entry = {
            id: this.data.nextId++,
            first: normalizedFirst,
            second: normalizedSecond,
            label,
            source,
            createdAt: Date.now(),
        };
        this.data.feedback.push(entry);
        this.save();
        return entry;
    }
    static addPair(pair, source = 'human') {
        return this.add(pair.first, pair.second, pair.label, source);
    }
    static getAll() {
        this.ensureInitialized();
        return this.data.feedback
            .map(item => ({
            ...item,
        }));
    }
    static getById(id) {
        this.ensureInitialized();
        return (this.data.feedback.find(item => item.id === id) ?? null);
    }
    static getByLabel(label) {
        this.ensureInitialized();
        return this.data.feedback
            .filter(item => item.label === label)
            .map(item => ({
            ...item,
        }));
    }
    static getBySource(source) {
        this.ensureInitialized();
        return this.data.feedback
            .filter(item => item.source === source)
            .map(item => ({
            ...item,
        }));
    }
    static getTrainingPairs() {
        this.ensureInitialized();
        return this.data.feedback.map(item => ({
            first: item.first,
            second: item.second,
            label: item.label,
        }));
    }
    static remove(id) {
        this.ensureInitialized();
        const index = this.data.feedback.findIndex(item => item.id === id);
        if (index < 0) {
            return false;
        }
        this.data.feedback.splice(index, 1);
        this.save();
        return true;
    }
    static clear() {
        this.ensureInitialized();
        const count = this.data.feedback.length;
        if (count === 0) {
            return 0;
        }
        this.data.feedback = [];
        this.save();
        return count;
    }
    static getCount() {
        this.ensureInitialized();
        return this.data.feedback.length;
    }
    static getPositiveCount() {
        return this.getByLabel(1)
            .length;
    }
    static getNegativeCount() {
        return this.getByLabel(0)
            .length;
    }
    static getSourceCount(source) {
        return this.getBySource(source).length;
    }
    static hasPair(first, second, label) {
        this.ensureInitialized();
        const normalizedPair = this.normalizePair(first, second);
        return this.data.feedback.some(item => {
            if (this.normalizePair(item.first, item.second) !== normalizedPair) {
                return false;
            }
            if (label === undefined) {
                return true;
            }
            return item.label === label;
        });
    }
    static toTrainingPairs() {
        return this.getTrainingPairs();
    }
    static reset() {
        this.data = {
            version: 1,
            nextId: 1,
            feedback: [],
        };
        this.initialized = false;
        this.filePath =
            DEFAULT_FILE_PATH;
    }
    static normalizePair(first, second) {
        const normalizedFirst = this.normalizeText(first);
        const normalizedSecond = this.normalizeText(second);
        return [
            normalizedFirst,
            normalizedSecond,
        ]
            .sort()
            .join('\u0000');
    }
    static normalizeText(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    static removeOldest() {
        if (this.data.feedback.length === 0) {
            return;
        }
        let oldestIndex = 0;
        for (let index = 1; index <
            this.data.feedback.length; index += 1) {
            if (this.data.feedback[index]
                .createdAt <
                this.data.feedback[oldestIndex].createdAt) {
                oldestIndex = index;
            }
        }
        this.data.feedback.splice(oldestIndex, 1);
    }
    static load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return {
                    version: 1,
                    nextId: 1,
                    feedback: [],
                };
            }
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1 ||
                !Array.isArray(parsed.feedback) ||
                typeof parsed.nextId !==
                    'number') {
                throw new Error('Arquivo de feedback semântico inválido.');
            }
            const feedback = parsed.feedback.filter(item => this.isValidFeedback(item));
            const highestId = feedback.reduce((max, item) => Math.max(max, item.id), 0);
            return {
                version: 1,
                nextId: Math.max(1, Math.floor(parsed.nextId), highestId + 1),
                feedback,
            };
        }
        catch (error) {
            throw new Error(`Não foi possível carregar feedback semântico: ${error instanceof Error
                ? error.message
                : String(error)}`);
        }
    }
    static save() {
        fs.mkdirSync(path.dirname(this.filePath), {
            recursive: true,
        });
        const temporaryPath = `${this.filePath}.tmp`;
        fs.writeFileSync(temporaryPath, JSON.stringify(this.data, null, 2), 'utf-8');
        fs.renameSync(temporaryPath, this.filePath);
    }
    static isValidFeedback(value) {
        if (!value ||
            typeof value !== 'object') {
            return false;
        }
        const item = value;
        return (typeof item.id ===
            'number' &&
            Number.isInteger(item.id) &&
            item.id > 0 &&
            typeof item.first ===
                'string' &&
            item.first.trim()
                .length > 0 &&
            typeof item.second ===
                'string' &&
            item.second.trim()
                .length > 0 &&
            (item.label === 0 ||
                item.label === 1) &&
            (item.source ===
                'human' ||
                item.source ===
                    'automatic' ||
                item.source ===
                    'hard-negative') &&
            typeof item.createdAt ===
                'number' &&
            Number.isFinite(item.createdAt));
    }
}
exports.SemanticFeedbackService = SemanticFeedbackService;
SemanticFeedbackService.filePath = DEFAULT_FILE_PATH;
SemanticFeedbackService.data = {
    version: 1,
    nextId: 1,
    feedback: [],
};
SemanticFeedbackService.initialized = false;
