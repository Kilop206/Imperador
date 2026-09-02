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
exports.SemanticCandidateService = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const DATA_DIRECTORY = path.join(process.cwd(), 'data');
const DEFAULT_FILE_PATH = path.join(DATA_DIRECTORY, 'semantic_candidates.json');
const MAX_CANDIDATES = 1000;
class SemanticCandidateService {
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
    static collect(first, second, predictedScore, reason) {
        this.ensureInitialized();
        const normalizedFirst = first.trim();
        const normalizedSecond = second.trim();
        if (!normalizedFirst ||
            !normalizedSecond) {
            return null;
        }
        if (this.normalizeText(normalizedFirst) ===
            this.normalizeText(normalizedSecond)) {
            return null;
        }
        if (!Number.isFinite(predictedScore)) {
            return null;
        }
        if (reason !== 'uncertain' &&
            reason !== 'hard-negative' &&
            reason !== 'novel' &&
            reason !== 'retrieval-conflict') {
            return null;
        }
        const score = Math.max(0, Math.min(1, predictedScore));
        const pairKey = this.normalizePair(normalizedFirst, normalizedSecond);
        const alreadyPending = this.data.candidates.some(candidate => !candidate.reviewed &&
            this.normalizePair(candidate.first, candidate.second) === pairKey);
        if (alreadyPending) {
            return null;
        }
        if (this.data.candidates.length >=
            MAX_CANDIDATES) {
            this.removeOldestReviewed();
            if (this.data.candidates.length >=
                MAX_CANDIDATES) {
                this.data.candidates.shift();
            }
        }
        const candidate = {
            id: this.data.nextId++,
            first: normalizedFirst,
            second: normalizedSecond,
            predictedScore: score,
            reason,
            createdAt: Date.now(),
            reviewed: false,
        };
        this.data.candidates.push(candidate);
        this.save();
        return {
            ...candidate,
        };
    }
    static getPending(limit = 20) {
        this.ensureInitialized();
        const safeLimit = Math.max(1, Math.floor(limit));
        return this.data.candidates
            .filter(candidate => !candidate.reviewed)
            .sort((a, b) => {
            if (b.predictedScore !==
                a.predictedScore) {
                return (Math.abs(0.5 -
                    a.predictedScore) -
                    Math.abs(0.5 -
                        b.predictedScore));
            }
            return (b.createdAt -
                a.createdAt);
        })
            .slice(0, safeLimit)
            .map(candidate => ({
            ...candidate,
        }));
    }
    static getById(id) {
        this.ensureInitialized();
        return (this.data.candidates.find(candidate => candidate.id === id) ?? null);
    }
    static getByReason(reason) {
        this.ensureInitialized();
        return this.data.candidates
            .filter(candidate => candidate.reason ===
            reason)
            .map(candidate => ({
            ...candidate,
        }));
    }
    static markReviewed(id) {
        this.ensureInitialized();
        const candidate = this.data.candidates.find(item => item.id === id);
        if (!candidate) {
            return false;
        }
        if (candidate.reviewed) {
            return false;
        }
        candidate.reviewed =
            true;
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
    static clear() {
        this.ensureInitialized();
        const count = this.data.candidates.length;
        if (count === 0) {
            return 0;
        }
        this.data.candidates = [];
        this.save();
        return count;
    }
    static getPendingCount() {
        this.ensureInitialized();
        return this.data.candidates.filter(candidate => !candidate.reviewed).length;
    }
    static getTotalCount() {
        this.ensureInitialized();
        return this.data.candidates.length;
    }
    static hasPair(first, second) {
        this.ensureInitialized();
        const pairKey = this.normalizePair(first, second);
        return this.data.candidates.some(candidate => this.normalizePair(candidate.first, candidate.second) === pairKey);
    }
    static reset() {
        this.data = {
            version: 1,
            nextId: 1,
            candidates: [],
        };
        this.filePath =
            DEFAULT_FILE_PATH;
        this.initialized =
            false;
    }
    static normalizePair(first, second) {
        return [
            this.normalizeText(first),
            this.normalizeText(second),
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
    static removeOldestReviewed() {
        const index = this.data.candidates.findIndex(candidate => candidate.reviewed);
        if (index >= 0) {
            this.data.candidates.splice(index, 1);
        }
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
                throw new Error('Arquivo de candidatos semânticos inválido.');
            }
            const candidates = parsed.candidates.filter(candidate => this.isValidCandidate(candidate));
            const highestId = candidates.reduce((max, candidate) => Math.max(max, candidate.id), 0);
            return {
                version: 1,
                nextId: Math.max(1, Math.floor(parsed.nextId), highestId + 1),
                candidates,
            };
        }
        catch (error) {
            throw new Error(`Não foi possível carregar candidatos semânticos: ${error instanceof Error
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
    static isValidCandidate(value) {
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
            typeof item.predictedScore ===
                'number' &&
            Number.isFinite(item.predictedScore) &&
            (item.reason ===
                'uncertain' ||
                item.reason ===
                    'hard-negative' ||
                item.reason ===
                    'novel' ||
                item.reason ===
                    'retrieval-conflict') &&
            typeof item.createdAt ===
                'number' &&
            Number.isFinite(item.createdAt) &&
            typeof item.reviewed ===
                'boolean');
    }
}
exports.SemanticCandidateService = SemanticCandidateService;
SemanticCandidateService.filePath = DEFAULT_FILE_PATH;
SemanticCandidateService.data = {
    version: 1,
    nextId: 1,
    candidates: [],
};
SemanticCandidateService.initialized = false;
