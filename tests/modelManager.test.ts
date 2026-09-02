import {
  describe,
  it,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  ModelManager,
} from '../src/intelligence/modelManager';

describe(
  'ModelManager',
  () => {
    it(
      'inicializa todos os modelos sem exceção',
      () => {
        ModelManager.reset(
          true,
        );

        const services =
          ModelManager.initialize();

        assert.ok(
          services.wordEmbeddingModel,
        );

        assert.ok(
          services.sentenceModel,
        );

        assert.ok(
          services.similarityService,
        );

        assert.ok(
          services.neuralSemanticMemoryService,
        );

        assert.ok(
          services.modelRegistry,
        );

        assert.ok(
          services.fineTuningService,
        );

        assert.ok(
          services.semanticContextService,
        );
      },
    );

    it(
      'é idempotente',
      () => {
        ModelManager.reset(
          true,
        );

        const first =
          ModelManager.initialize();

        const second =
          ModelManager.initialize();

        assert.strictEqual(
          first,
          second,
        );
      },
    );

    it(
      'mantém o registro inicial de modelos',
      () => {
        ModelManager.reset(
          true,
        );

        ModelManager.initialize();

        const registry =
          ModelManager
            .getModelRegistry();

        const models =
          registry.getAll();

        assert.equal(
          models.length,
          1,
        );

        const active =
          registry.getActive();

        assert.ok(
          active,
        );

        assert.equal(
          active.version,
          1,
        );
      },
    );

    it(
      'configura o contexto semântico',
      () => {
        ModelManager.reset(
          true,
        );

        ModelManager.initialize();

        const context =
          ModelManager
            .getSemanticContextService();

        assert.equal(
          context.isConfigured(),
          true,
        );
      },
    );

    it(
      'permite comparação neural sem índice de memórias',
      async () => {
        ModelManager.reset(
          true,
        );

        const neural =
          ModelManager
            .getNeuralSemanticMemoryService();

        const similarity =
          await neural.compare(
            'olá',
            'oi',
          );

        assert.ok(
          Number.isFinite(
            similarity,
          ),
        );

        assert.ok(
          similarity >= 0,
        );

        assert.ok(
          similarity <= 1,
        );
      },
    );

    it(
      'retorna status consistente',
      () => {
        ModelManager.reset(
          true,
        );

        ModelManager.initialize();

        const status =
          ModelManager.getStatus();

        assert.equal(
          status.initialized,
          true,
        );

        assert.equal(
          status.source,
          'trained',
        );

        assert.ok(
          status.wordEmbedding,
        );

        assert.ok(
          status.sentenceModel,
        );

        assert.ok(
          status.similarity,
        );

        assert.equal(
          status.registry.versionCount,
          1,
        );

        assert.equal(
          status.registry.activeVersion,
          1,
        );

        assert.equal(
          status.neuralMemory.ready,
          true,
        );

        assert.equal(
          status.semanticContext,
          true,
        );

        assert.equal(
          status.persistence.available,
          true,
        );
      },
    );

    it(
      'expõe a versão ativa corretamente',
      () => {
        ModelManager.reset(
          true,
        );

        ModelManager.initialize();

        assert.equal(
          ModelManager
            .getActiveVersion(),
          1,
        );
      },
    );

    it(
      'permite ativar uma versão registrada',
      () => {
        ModelManager.reset(
          true,
        );

        const services =
          ModelManager.initialize();

        const registry =
          services.modelRegistry;

        const original =
          registry.getActive();

        assert.ok(
          original,
        );

        const second =
          registry.register(
            services
              .sentenceModel
              .exportModel(),
            {
              datasetSize: 1,
              trainingPairs: 1,
              validationScore: 0.9,
              testScore: 0.9,
            },
          );

        assert.equal(
          registry.getActive()?.version,
          1,
        );

        const activated =
          ModelManager.activateVersion(
            second.version,
          );

        assert.equal(
          activated,
          true,
        );

        assert.equal(
          ModelManager
            .getActiveVersion(),
          second.version,
        );

        assert.equal(
          ModelManager
            .getNeuralSemanticMemoryService()
            .isReady(),
          true,
        );

        assert.equal(
          ModelManager.getStatus()
            .registry.activeVersion,
          second.version,
        );
      },
    );

    it(
      'não ativa uma versão inexistente',
      () => {
        ModelManager.reset(
          true,
        );

        ModelManager.initialize();

        const result =
          ModelManager.activateVersion(
            999999,
          );

        assert.equal(
          result,
          false,
        );

        assert.equal(
          ModelManager
            .getActiveVersion(),
          1,
        );
      },
    );

    it(
      'reset remove o estado global',
      () => {
        ModelManager.reset(
          true,
        );

        ModelManager.initialize();

        ModelManager.reset(
          true,
        );

        assert.equal(
          ModelManager.isInitialized(),
          false,
        );
      },
    );
  },
);