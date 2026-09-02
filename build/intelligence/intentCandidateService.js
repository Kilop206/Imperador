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
exports.IntentCandidateService = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DEFAULT_FILE_PATH = path.join(DATA_DIRECTORY, 'intent_candidates.json');
const DEFAULT_THRESHOLD = 0.65;
const MAX_CANDIDATES = 1000;
class IntentCandidateService {
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
    static collect(text, prediction, threshold = DEFAULT_THRESHOLD) {
        this.ensureInitialized();
        const normalizedText = text.trim();
        if (!normalizedText ||
            prediction.confidence >= threshold) {
            return null;
        }
        const alreadyPending = this.data.candidates.some(candidate => !candidate.reviewed &&
            this.normalize(candidate.text) === this.normalize(normalizedText));
        if (alreadyPending) {
            return null;
        }
        if (this.data.candidates.length >=
            MAX_CANDIDATES) {
            this.removeOldestReviewed();
        }
        const candidate = {
            id: this.data.nextId++,
            text: normalizedText,
            predictedIntent: prediction.intent,
            confidence: prediction.confidence,
            probabilities: {
                ...prediction.probabilities,
            },
            createdAt: Date.now(),
            reviewed: false,
        };
        this.data.candidates.push(candidate);
        this.save();
        return candidate;
    }
    static getPending(limit = 20) {
        this.ensureInitialized();
        const safeLimit = Math.max(1, Math.floor(limit));
        return this.data.candidates
            .filter(candidate => !candidate.reviewed)
            .sort((a, b) => b.createdAt -
            a.createdAt)
            .slice(0, safeLimit);
    }
    static getById(id) {
        this.ensureInitialized();
        return (this.data.candidates.find(candidate => candidate.id === id) ?? null);
    }
    static markReviewed(id) {
        this.ensureInitialized();
        const candidate = this.getById(id);
        if (!candidate) {
            return false;
        }
        candidate.reviewed = true;
        this.save();
        return true;
    }
    static remove(id) {
        this.ensureInitialized();
        const index = this.data.candidates.findIndex(candidate => candidate.id === id);
        if (index < 0) {
            return false;
        }
        this.data.candidates.splice(index, 1);
        this.save();
        return true;
    }
    static clearReviewed() {
        this.ensureInitialized();
        const before = this.data.candidates.length;
        this.data.candidates =
            this.data.candidates.filter(candidate => !candidate.reviewed);
        const removed = before -
            this.data.candidates.length;
        if (removed > 0) {
            this.save();
        }
        return removed;
    }
    static getPendingCount() {
        this.ensureInitialized();
        return this.data.candidates.filter(candidate => !candidate.reviewed).length;
    }
    static getTotalCount() {
        this.ensureInitialized();
        return this.data.candidates.length;
    }
    static removeOldestReviewed() {
        const index = this.data.candidates.findIndex(candidate => candidate.reviewed);
        if (index >= 0) {
            this.data.candidates.splice(index, 1);
            return;
        }
        this.data.candidates.shift();
    }
    static load() {
        try {
            if (!fs.existsSync(this.filePath)) {
                return {
                    version: 1,
                    nextId: 1,
                    candidates: [],
                };
            }
            const raw = fs.readFileSync(this.filePath, 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1 ||
                !Array.isArray(parsed.candidates) ||
                typeof parsed.nextId !==
                    'number') {
                throw new Error('Arquivo de candidatos inválido.');
            }
            return {
                version: 1,
                nextId: Math.max(1, Math.floor(parsed.nextId)),
                candidates: parsed.candidates.filter(candidate => this.isValidCandidate(candidate)),
            };
        }
        catch (error) {
            throw new Error(`Não foi possível carregar candidatos de intenção: ${error instanceof Error
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
    static normalize(text) {
        return text
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    static isValidCandidate(candidate) {
        if (!candidate ||
            typeof candidate !== 'object') {
            return false;
        }
        const value = candidate;
        return (typeof value.id ===
            'number' &&
            typeof value.text ===
                'string' &&
            value.text.trim()
                .length > 0 &&
            typeof value.predictedIntent ===
                'string' &&
            typeof value.confidence ===
                'number' &&
            value.probabilities !== null &&
            typeof value.probabilities ===
                'object' &&
            typeof value.createdAt ===
                'number' &&
            typeof value.reviewed ===
                'boolean');
    }
    static reset() {
        this.data = {
            version: 1,
            nextId: 1,
            candidates: [],
        };
        this.initialized = false;
    }
}
exports.IntentCandidateService = IntentCandidateService;
IntentCandidateService.filePath = DEFAULT_FILE_PATH;
IntentCandidateService.data = {
    version: 1,
    nextId: 1,
    candidates: [],
};
IntentCandidateService.initialized = false;
