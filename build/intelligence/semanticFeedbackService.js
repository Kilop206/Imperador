"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticFeedbackService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const DATA_DIRECTORY = (0, node_path_1.join)(process.cwd(), 'data');
const DEFAULT_FILE = (0, node_path_1.join)(DATA_DIRECTORY, 'semantic_feedback.json');
const MAX_EXAMPLES = 10000;
class SemanticFeedbackService {
    static initialize(filePath = DEFAULT_FILE) {
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
            throw new Error('As duas frases precisam possuir conteúdo.');
        }
        const exists = this.data.examples.some(example => this.normalize(example.first) ===
            this.normalize(normalizedFirst) &&
            this.normalize(example.second) ===
                this.normalize(normalizedSecond) &&
            example.label === label);
        if (exists) {
            throw new Error('Este exemplo semântico já existe.');
        }
        if (this.data.examples.length >=
            MAX_EXAMPLES) {
            this.removeOldest();
        }
        const example = {
            id: this.data.nextId++,
            first: normalizedFirst,
            second: normalizedSecond,
            label,
            createdAt: Date.now(),
            source,
        };
        this.data.examples.push(example);
        this.save();
        return {
            ...example,
        };
    }
    static addPair(pair, source = 'human') {
        return this.add(pair.first, pair.second, pair.label, source);
    }
    static getAll() {
        this.ensureInitialized();
        return this.data.examples.map(example => ({
            ...example,
        }));
    }
    static getTrainingPairs() {
        this.ensureInitialized();
        return this.data.examples.map(example => ({
            first: example.first,
            second: example.second,
            label: example.label,
        }));
    }
    static getCount() {
        this.ensureInitialized();
        return this.data.examples.length;
    }
    static remove(id) {
        this.ensureInitialized();
        const index = this.data.examples.findIndex(example => example.id === id);
        if (index < 0) {
            return false;
        }
        this.data.examples.splice(index, 1);
        this.save();
        return true;
    }
    static clear() {
        this.ensureInitialized();
        this.data.examples = [];
        this.save();
    }
    static reset() {
        this.data = {
            version: 1,
            nextId: 1,
            examples: [],
        };
        this.initialized = false;
    }
    static load() {
        try {
            let raw;
            try {
                raw = (0, node_fs_1.readFileSync)(this.filePath, 'utf-8');
            }
            catch {
                return {
                    version: 1,
                    nextId: 1,
                    examples: [],
                };
            }
            const parsed = JSON.parse(raw);
            if (parsed.version !== 1 ||
                !Array.isArray(parsed.examples) ||
                typeof parsed.nextId !==
                    'number') {
                throw new Error('Arquivo de feedback semântico inválido.');
            }
            const examples = parsed.examples.filter(example => this.isValidExample(example));
            return {
                version: 1,
                nextId: Math.max(1, Math.floor(parsed.nextId)),
                examples,
            };
        }
        catch (error) {
            throw new Error(`Não foi possível carregar feedback semântico: ${error instanceof Error
                ? error.message
                : String(error)}`);
        }
    }
    static save() {
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.filePath), {
            recursive: true,
        });
        const temporaryPath = `${this.filePath}.tmp`;
        try {
            (0, node_fs_1.writeFileSync)(temporaryPath, JSON.stringify(this.data, null, 2), 'utf-8');
            (0, node_fs_1.renameSync)(temporaryPath, this.filePath);
        }
        catch (error) {
            try {
                (0, node_fs_1.unlinkSync)(temporaryPath);
            }
            catch {
                // Ignora falha de limpeza.
            }
            throw error;
        }
    }
    static removeOldest() {
        let oldestIndex = 0;
        for (let index = 1; index <
            this.data.examples.length; index += 1) {
            if (this.data.examples[index]
                .createdAt <
                this.data.examples[oldestIndex]
                    .createdAt) {
                oldestIndex = index;
            }
        }
        this.data.examples.splice(oldestIndex, 1);
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
    static isValidExample(example) {
        if (!example ||
            typeof example !== 'object') {
            return false;
        }
        const value = example;
        return (typeof value.id === 'number' &&
            typeof value.first ===
                'string' &&
            value.first.trim().length > 0 &&
            typeof value.second ===
                'string' &&
            value.second.trim().length > 0 &&
            (value.label === 0 ||
                value.label === 1) &&
            typeof value.createdAt ===
                'number' &&
            (value.source === 'human' ||
                value.source === 'system' ||
                value.source === 'mined'));
    }
}
exports.SemanticFeedbackService = SemanticFeedbackService;
SemanticFeedbackService.filePath = DEFAULT_FILE;
SemanticFeedbackService.data = {
    version: 1,
    nextId: 1,
    examples: [],
};
SemanticFeedbackService.initialized = false;
