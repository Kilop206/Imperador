import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { ModelManager } from '../src/intelligence/modelManager';

describe('ModelManager', () => {
    it('inicializa todos os modelos sem exceção', () => {
        ModelManager.reset();

        const services =
            ModelManager.initialize();

        assert.ok(
            services.wordEmbeddingModel
        );

        assert.ok(
            services.sentenceModel
        );

        assert.ok(
            services.similarityService
        );

        assert.ok(
            services.neuralSemanticMemoryService
        );

        assert.ok(
            services.modelRegistry
        );

        assert.ok(
            services.fineTuningService
        );

        assert.ok(
            services.semanticContextService
        );
    });

    it('é idempotente', () => {
        ModelManager.reset();

        const first =
            ModelManager.initialize();

        const second =
            ModelManager.initialize();

        assert.strictEqual(
            first,
            second
        );
    });

    it('mantém o registro inicial de modelos', () => {
        ModelManager.reset();

        ModelManager.initialize();

        const registry =
            ModelManager.getModelRegistry();

        const models =
            registry.getAll();

        assert.equal(
            models.length,
            1
        );

        const active =
            registry.getActive();

        assert.ok(active);
    });

    it('configura o contexto semântico', () => {
        ModelManager.reset();

        ModelManager.initialize();

        const context =
            ModelManager.getSemanticContextService();

        assert.equal(
            context.isConfigured(),
            true
        );
    });

    it('permite comparação neural sem índice de memórias', async () => {
        ModelManager.reset();

        const neural =
            ModelManager
                .getNeuralSemanticMemoryService();

        const similarity =
            await neural.compare(
                'olá',
                'oi'
            );

        assert.ok(
            Number.isFinite(similarity)
        );

        assert.ok(
            similarity >= 0
        );

        assert.ok(
            similarity <= 1
        );
    });

    it('retorna status consistente', () => {
        ModelManager.reset();

        ModelManager.initialize();

        const status =
            ModelManager.getStatus();

        assert.equal(
            status.initialized,
            true
        );

        assert.ok(
            status.wordEmbedding
        );

        assert.ok(
            status.sentenceModel
        );

        assert.equal(
            status.registry.versionCount,
            1
        );

        assert.equal(
            status.registry.activeVersion,
            1
        );

        assert.equal(
            status.semanticContext,
            true
        );
    });

    it('reset remove o estado global', () => {
        ModelManager.initialize();

        ModelManager.reset();

        assert.equal(
            ModelManager.isInitialized(),
            false
        );
    });
});