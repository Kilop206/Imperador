import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';

import {
  tmpdir,
} from 'node:os';

import {
  join,
} from 'node:path';

import {
  describe,
  it,
} from 'node:test';

import assert from 'node:assert/strict';

import {
  WordEmbeddingModel,
} from '../src/intelligence/wordEmbeddingModel';

import {
  SemanticSentenceModel,
} from '../src/intelligence/semanticSentenceModel';

import {
  SemanticSimilarityService,
} from '../src/intelligence/semanticSimilarityService';

import {
  SemanticModelRegistry,
} from '../src/intelligence/semanticFineTuningService';

import {
  SEMANTIC_SENTENCE_DATASET,
} from '../src/intelligence/semanticSentenceDataset';

import {
  ModelPersistenceService,
} from '../src/intelligence/modelPersistenceService';

describe(
  'ModelPersistenceService',
  () => {
    it(
      'salva e carrega modelos completos',
      () => {
        const directory =
          mkdtempSync(
            join(
              tmpdir(),
              'imperador-models-',
            ),
          );

        try {
          const wordModel =
            new WordEmbeddingModel({
              dimension: 8,
              epochs: 2,
            });

          wordModel.train([
            'roma caiu',
            'roma foi poderosa',
            'programacao e tecnologia',
            'tecnologia cria software',
          ]);

          const sentenceModel =
            new SemanticSentenceModel({
              outputDimension: 8,
              epochs: 2,
            });

          sentenceModel.train(
            wordModel,
            SEMANTIC_SENTENCE_DATASET,
          );

          const similarity =
            new SemanticSimilarityService();

          similarity.train([
            {
              id: '1',
              text: 'Roma caiu',
            },
            {
              id: '2',
              text: 'Como programar?',
            },
          ]);

          const registry =
            new SemanticModelRegistry();

          const registered =
            registry.register(
              sentenceModel.exportModel(),
              {
                datasetSize:
                  SEMANTIC_SENTENCE_DATASET.length,

                trainingPairs:
                  SEMANTIC_SENTENCE_DATASET.length,

                validationScore: 0.75,
                testScore: 0.70,
              },
            );

          assert.equal(
            registry.activate(
              registered.version,
            ),
            true,
          );

          const persistence =
            new ModelPersistenceService({
              directory,
            });

          persistence.save({
            schemaVersion:
              persistence.getSchemaVersion(),

            savedAt:
              Date.now(),

            wordEmbedding:
              wordModel.exportModel(),

            sentenceModel:
              sentenceModel.exportModel(),

            similarity:
              similarity.exportModel(),

            registry:
              registry.exportData(),
          });

          assert.equal(
            persistence.exists(),
            true,
          );

          const raw =
            readFileSync(
              persistence.getPath(),
              'utf-8',
            );

          assert.ok(
            raw.length > 0,
          );

          const loaded =
            persistence.load();

          assert.ok(
            loaded,
          );

          assert.equal(
            loaded.wordEmbedding.dimension,
            wordModel.getDimension(),
          );

          assert.equal(
            loaded.wordEmbedding.vocabulary.length,
            wordModel.getVocabularySize(),
          );

          assert.equal(
            loaded.sentenceModel.outputDimension,
            sentenceModel.getOutputDimension(),
          );

          assert.equal(
            loaded.similarity.documents.length,
            2,
          );

          assert.equal(
            loaded.registry.versions.length,
            1,
          );

          assert.equal(
            loaded.registry.nextVersion,
            2,
          );
        } finally {
          rmSync(
            directory,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      'retorna null quando o arquivo não existe',
      () => {
        const directory =
          mkdtempSync(
            join(
              tmpdir(),
              'imperador-models-',
            ),
          );

        try {
          const persistence =
            new ModelPersistenceService({
              directory,
            });

          assert.equal(
            persistence.exists(),
            false,
          );

          assert.equal(
            persistence.load(),
            null,
          );
        } finally {
          rmSync(
            directory,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      'retorna null para schema incompatível',
      () => {
        const directory =
          mkdtempSync(
            join(
              tmpdir(),
              'imperador-models-',
            ),
          );

        try {
          const persistence =
            new ModelPersistenceService({
              directory,
            });

          mkdirSync(
            directory,
            {
              recursive: true,
            },
          );

          writeFileSync(
            persistence.getPath(),
            JSON.stringify({
              schemaVersion: 999,
              savedAt: Date.now(),
            }),
            'utf-8',
          );

          assert.equal(
            persistence.load(),
            null,
          );
        } finally {
          rmSync(
            directory,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );

    it(
      'remove o arquivo persistido',
      () => {
        const directory =
          mkdtempSync(
            join(
              tmpdir(),
              'imperador-models-',
            ),
          );

        try {
          const persistence =
            new ModelPersistenceService({
              directory,
            });

          const wordModel =
            new WordEmbeddingModel({
              dimension: 8,
              epochs: 1,
            });

          wordModel.train([
            'roma caiu',
            'roma venceu',
          ]);

          const sentenceModel =
            new SemanticSentenceModel({
              outputDimension: 8,
              epochs: 1,
            });

          sentenceModel.train(
            wordModel,
            SEMANTIC_SENTENCE_DATASET,
          );

          const similarity =
            new SemanticSimilarityService();

          similarity.train([
            {
              id: '1',
              text: 'roma',
            },
          ]);

          const registry =
            new SemanticModelRegistry();

          const registered =
            registry.register(
              sentenceModel.exportModel(),
              {
                datasetSize: 1,
                trainingPairs: 1,
                validationScore: 0,
                testScore: 0,
              },
            );

          registry.activate(
            registered.version,
          );

          persistence.save({
            schemaVersion:
              persistence.getSchemaVersion(),

            savedAt:
              Date.now(),

            wordEmbedding:
              wordModel.exportModel(),

            sentenceModel:
              sentenceModel.exportModel(),

            similarity:
              similarity.exportModel(),

            registry:
              registry.exportData(),
          });

          assert.equal(
            persistence.exists(),
            true,
          );

          persistence.delete();

          assert.equal(
            persistence.exists(),
            false,
          );

          assert.equal(
            persistence.load(),
            null,
          );
        } finally {
          rmSync(
            directory,
            {
              recursive: true,
              force: true,
            },
          );
        }
      },
    );
  },
);