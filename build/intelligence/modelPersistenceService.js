"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModelPersistenceService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const CURRENT_SCHEMA_VERSION = 1;
const DEFAULT_DIRECTORY = (0, node_path_1.resolve)(process.cwd(), 'data', 'models');
const DEFAULT_FILENAME = 'semantic-models.json';
class ModelPersistenceService {
    constructor(options = {}) {
        this.directory =
            (0, node_path_1.resolve)(options.directory ??
                DEFAULT_DIRECTORY);
        this.filename =
            options.filename ??
                DEFAULT_FILENAME;
        this.filepath =
            (0, node_path_1.join)(this.directory, this.filename);
    }
    exists() {
        try {
            (0, node_fs_1.readFileSync)(this.filepath, 'utf-8');
            return true;
        }
        catch {
            return false;
        }
    }
    getPath() {
        return this.filepath;
    }
    save(models) {
        this.validate(models);
        (0, node_fs_1.mkdirSync)((0, node_path_1.dirname)(this.filepath), {
            recursive: true,
        });
        const content = JSON.stringify(models, null, 2) + '\n';
        /*
         * O arquivo temporário precisa ser exclusivo
         * para esta operação de persistência.
         *
         * Usar simplesmente `${filepath}.tmp` permite
         * que duas gravações concorrentes compartilhem
         * o mesmo arquivo e uma delas apague o arquivo
         * enquanto a outra ainda tenta renomeá-lo/copiar.
         */
        const temporaryPath = this.createTemporaryPath();
        try {
            (0, node_fs_1.writeFileSync)(temporaryPath, content, {
                encoding: 'utf-8',
            });
            this.replaceTarget(temporaryPath);
        }
        catch (error) {
            this.safeUnlink(temporaryPath);
            throw error;
        }
    }
    load() {
        if (!this.exists()) {
            return null;
        }
        let raw = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                raw = (0, node_fs_1.readFileSync)(this.filepath, 'utf-8');
                break;
            }
            catch (err) {
                const errorCode = err &&
                    typeof err === 'object' &&
                    'code' in err
                    ? err.code
                    : null;
                if ((errorCode ===
                    'EBUSY' ||
                    errorCode ===
                        'EPERM') &&
                    attempt < 4) {
                    continue;
                }
                console.error(`Falha ao carregar modelos persistidos em ${this.filepath}:`, err);
                return null;
            }
        }
        if (!raw) {
            return null;
        }
        try {
            const parsed = JSON.parse(raw);
            this.validate(parsed);
            return parsed;
        }
        catch (error) {
            console.error(`Falha ao validar modelos persistidos em ${this.filepath}:`, error);
            return null;
        }
    }
    delete() {
        try {
            (0, node_fs_1.unlinkSync)(this.filepath);
        }
        catch {
            // Arquivo inexistente = estado já limpo.
        }
    }
    getSchemaVersion() {
        return CURRENT_SCHEMA_VERSION;
    }
    createTemporaryPath() {
        const uniqueSuffix = [
            process.pid,
            Date.now(),
            Math.random()
                .toString(36)
                .slice(2),
        ].join('-');
        return `${this.filepath}.${uniqueSuffix}.tmp`;
    }
    replaceTarget(temporaryPath) {
        try {
            (0, node_fs_1.renameSync)(temporaryPath, this.filepath);
            return;
        }
        catch {
            /*
             * No Windows, substituir um arquivo que esteja
             * momentaneamente aberto pode fazer renameSync
             * falhar. Nesse caso usamos copyFileSync.
             */
        }
        try {
            (0, node_fs_1.copyFileSync)(temporaryPath, this.filepath);
        }
        finally {
            this.safeUnlink(temporaryPath);
        }
    }
    safeUnlink(filepath) {
        try {
            (0, node_fs_1.unlinkSync)(filepath);
        }
        catch {
            /*
             * Não há problema se outro fluxo já removeu
             * o arquivo temporário.
             */
        }
    }
    validate(value) {
        if (!value ||
            typeof value !== 'object') {
            throw new TypeError('Dados persistidos inválidos.');
        }
        const data = value;
        if (data.schemaVersion !==
            CURRENT_SCHEMA_VERSION) {
            throw new Error(`Versão de schema incompatível: ${String(data.schemaVersion)}. Esperada: ${CURRENT_SCHEMA_VERSION}.`);
        }
        if (typeof data.savedAt !==
            'number' ||
            !Number.isFinite(data.savedAt)) {
            throw new TypeError('savedAt inválido.');
        }
        if (!this.isObject(data.wordEmbedding)) {
            throw new TypeError('wordEmbedding ausente ou inválido.');
        }
        if (!this.isObject(data.sentenceModel)) {
            throw new TypeError('sentenceModel ausente ou inválido.');
        }
        if (!this.isObject(data.similarity)) {
            throw new TypeError('similarity ausente ou inválido.');
        }
        if (!this.isObject(data.registry)) {
            throw new TypeError('registry ausente ou inválido.');
        }
        this.validateWordEmbedding(data.wordEmbedding);
        this.validateSentenceModel(data.sentenceModel);
        this.validateSimilarity(data.similarity);
        this.validateRegistry(data.registry);
    }
    validateWordEmbedding(value) {
        if (!Array.isArray(value.vocabulary) ||
            !Array.isArray(value.embeddings) ||
            typeof value.dimension !==
                'number') {
            throw new TypeError('Modelo de word embeddings inválido.');
        }
        if (value.vocabulary.length !==
            value.embeddings.length) {
            throw new Error('Vocabulário e embeddings possuem tamanhos incompatíveis.');
        }
    }
    validateSentenceModel(value) {
        if (typeof value.inputDimension !==
            'number' ||
            typeof value.outputDimension !==
                'number' ||
            !Array.isArray(value.projection)) {
            throw new TypeError('Modelo semântico de sentença inválido.');
        }
    }
    validateSimilarity(value) {
        if (!this.isObject(value.vectorizer) ||
            !Array.isArray(value.documents)) {
            throw new TypeError('Modelo TF-IDF inválido.');
        }
        for (const document of value.documents) {
            if (!this.isObject(document) ||
                typeof document.id !==
                    'string' ||
                typeof document.text !==
                    'string') {
                throw new TypeError('Documento TF-IDF inválido.');
            }
        }
    }
    validateRegistry(value) {
        if (!Array.isArray(value.versions) ||
            typeof value.nextVersion !==
                'number') {
            throw new TypeError('Registry de modelos inválido.');
        }
        for (const version of value.versions) {
            if (!this.isObject(version)) {
                throw new TypeError('Versão de modelo inválida.');
            }
            if (typeof version.version !==
                'number' ||
                typeof version.createdAt !==
                    'number' ||
                typeof version.datasetSize !==
                    'number' ||
                typeof version.trainingPairs !==
                    'number' ||
                typeof version.validationScore !==
                    'number' ||
                typeof version.testScore !==
                    'number' ||
                typeof version.active !==
                    'boolean' ||
                !this.isObject(version.modelData)) {
                throw new TypeError('Metadados da versão do modelo inválidos.');
            }
        }
    }
    isObject(value) {
        return (typeof value ===
            'object' &&
            value !== null &&
            !Array.isArray(value));
    }
}
exports.ModelPersistenceService = ModelPersistenceService;
