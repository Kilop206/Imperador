import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import {
  afterEach,
  beforeEach,
  test,
} from 'node:test';

import {
  AIRuntimeService,
} from '../src/intelligence/aiRuntimeService';

import {
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

import {
  SemanticFeedbackService,
} from '../src/intelligence/semanticFeedbackService';

import {
  SemanticMessageActiveLearningService,
} from '../src/services/semanticMessageActiveLearningService';

import {
  ReplyService,
} from '../src/services/reply';

const temporaryDirectories: string[] = [];

function createTemporaryFile(
  prefix: string,
  filename: string,
): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), prefix),
  );

  temporaryDirectories.push(directory);

  return path.join(directory, filename);
}

beforeEach(() => {
  AIRuntimeService.initialize();

  const candidatesFile = createTemporaryFile(
    'imperador-test-candidates-',
    'semantic_candidates.json',
  );

  const feedbackFile = createTemporaryFile(
    'imperador-test-feedback-',
    'semantic_feedback.json',
  );

  SemanticCandidateService.reset();
  SemanticFeedbackService.reset();

  SemanticCandidateService.initialize(candidatesFile);
  SemanticFeedbackService.initialize(feedbackFile);
});

afterEach(() => {
  SemanticCandidateService.reset();
  SemanticFeedbackService.reset();

  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();

    if (directory && fs.existsSync(directory)) {
      try {
        fs.rmSync(directory, {
          recursive: true,
          force: true,
        });
      } catch {
        // Ignora erros de limpeza temporária no Windows
      }
    }
  }
});

test(
  'SemanticMessageActiveLearningService expõe status consistente',
  () => {
    const status =
      SemanticMessageActiveLearningService.getStatus();

    assert.equal(typeof status.pendingCandidateCount, 'number');
    assert.equal(typeof status.totalFeedbackCount, 'number');
    assert.equal(status.isInitialized, true);
  },
);

test(
  'processInteraction rejeita mensagens vazias ou comandos',
  () => {
    assert.equal(
      SemanticMessageActiveLearningService.processInteraction('', 'resposta'),
      null,
    );

    assert.equal(
      SemanticMessageActiveLearningService.processInteraction('mensagem', '   '),
      null,
    );

    assert.equal(
      SemanticMessageActiveLearningService.processInteraction('!tiberio_status', 'resposta'),
      null,
    );

    assert.equal(
      SemanticMessageActiveLearningService.processInteraction('olá', 'olá'),
      null,
    );
  },
);

test(
  'processInteraction executa análise semântica e active learning sem treinar automaticamente',
  () => {
    const initialFeedbackCount =
      SemanticFeedbackService.getCount();

    const analysis =
      SemanticMessageActiveLearningService.processInteraction(
        'O Senado romano precisa de reformas urgentes',
        'As legiões marcham sob a vontade de Roma',
      );

    assert.ok(analysis);
    assert.ok(analysis.input);
    assert.equal(typeof analysis.input.semanticScore, 'number');
    assert.ok(analysis.score);
    assert.equal(typeof analysis.score.collectionScore, 'number');

    // Regra fundamental: NUNCA adiciona automaticamente ao feedback/treinamento
    assert.equal(
      SemanticFeedbackService.getCount(),
      initialFeedbackCount,
      'O feedback de treinamento não deve ser alterado automaticamente',
    );
  },
);

test(
  'processInteraction enfileira candidato quando os critérios de utilidade são atendidos',
  () => {
    const initialCandidates =
      SemanticMessageActiveLearningService.getPendingCandidateCount();

    // Forçamos opções que garantem a coleta para testar o enfileiramento
    const analysis =
      SemanticMessageActiveLearningService.processInteraction(
        'Explique a expansão do império',
        'A expansão das províncias ocorreu por conquista',
        {
          minimumCollectionScore: 0.01,
          noveltyThreshold: 0.1,
        },
      );

    assert.ok(analysis);

    const pendingCount =
      SemanticMessageActiveLearningService.getPendingCandidateCount();

    assert.ok(
      pendingCount >= initialCandidates,
      'Candidato deve estar na fila se atender aos critérios',
    );
  },
);

test(
  'aprovação manual de candidato semântico adiciona ao feedback e remove da fila',
  () => {
    // Coleta um candidato controlado
    SemanticCandidateService.collect(
      'Cícero discursou perante o senado',
      'Oratória clássica em Roma',
      0.55,
      'uncertain',
    );

    const pending =
      SemanticMessageActiveLearningService.getPendingCandidates(10);

    assert.ok(pending.length > 0);

    const candidate = pending[0];
    const initialFeedbackCount =
      SemanticFeedbackService.getCount();

    // Aprova manualmente como par semanticamente similar (label: 1)
    const approved =
      SemanticMessageActiveLearningService.approveCandidate(
        candidate.id,
        1,
      );

    assert.equal(approved, true);

    // Agora o feedback DEVE ter aumentado em 1
    assert.equal(
      SemanticFeedbackService.getCount(),
      initialFeedbackCount + 1,
    );

    // E o candidato não deve mais constar como pendente
    const pendingAfter =
      SemanticMessageActiveLearningService.getPendingCandidates(10);

    assert.ok(
      !pendingAfter.some(c => c.id === candidate.id),
      'Candidato aprovado não deve mais estar na fila de pendentes',
    );
  },
);

test(
  'rejeição manual de candidato semântico não adiciona ao feedback e remove da fila',
  () => {
    SemanticCandidateService.collect(
      'Catilina conspirou contra a república',
      'Torta de maçã assada no forno',
      0.48,
      'uncertain',
    );

    const pending =
      SemanticMessageActiveLearningService.getPendingCandidates(10);

    assert.ok(pending.length > 0);

    const candidate = pending[0];
    const initialFeedbackCount =
      SemanticFeedbackService.getCount();

    const rejected =
      SemanticMessageActiveLearningService.rejectCandidate(
        candidate.id,
      );

    assert.equal(rejected, true);

    // O repositório de feedback continua sem alteração
    assert.equal(
      SemanticFeedbackService.getCount(),
      initialFeedbackCount,
      'Candidato rejeitado não deve adicionar feedback ao dataset',
    );

    // E não consta mais como pendente
    const pendingAfter =
      SemanticMessageActiveLearningService.getPendingCandidates(10);

    assert.ok(
      !pendingAfter.some(c => c.id === candidate.id),
    );
  },
);

test(
  'comandos administrativos de Semantic Active Learning funcionam no ReplyService',
  () => {
    // 1. Status semântico
    const statusReply =
      ReplyService.getReply({
        content: '!tiberio_semantic_status',
        author: { bot: false, id: 'user_1', username: 'Legatus' },
        channelId: 'allowed_channel',
      } as any);

    assert.ok(statusReply);
    assert.ok(statusReply.includes('Aprendizado Semântico'));

    // 2. Fila vazia
    const emptyCandidatesReply =
      ReplyService.getReply({
        content: '!tiberio_semantic_candidatos',
        author: { bot: false, id: 'user_1', username: 'Legatus' },
        channelId: 'allowed_channel',
      } as any);

    assert.ok(emptyCandidatesReply);
    assert.ok(emptyCandidatesReply.includes('Não existem candidatos semânticos'));

    // 3. Adiciona candidato e lista
    SemanticCandidateService.collect(
      'A águia romana voa sobre as legiões',
      'Símbolo militar do Império Romano',
      0.51,
      'uncertain',
    );

    const candidatesReply =
      ReplyService.getReply({
        content: '!tiberio_semantic_candidatos',
        author: { bot: false, id: 'user_1', username: 'Legatus' },
        channelId: 'allowed_channel',
      } as any);

    assert.ok(candidatesReply);
    assert.ok(candidatesReply.includes('A águia romana voa sobre as legiões'));

    const pending =
      SemanticCandidateService.getPending(1);

    assert.ok(pending.length > 0);
    const id = pending[0].id;

    // 4. Rotular candidato via comando
    const labelReply =
      ReplyService.getReply({
        content: `!tiberio_semantic_rotular ${id} 1`,
        author: { bot: false, id: 'user_1', username: 'Legatus' },
        channelId: 'allowed_channel',
      } as any);

    assert.ok(labelReply);
    assert.ok(labelReply.includes(`aprovado com rótulo 1`));

    // 5. Testar rejeição via comando
    SemanticCandidateService.collect(
      'Frase aleatória A',
      'Frase aleatória B',
      0.50,
      'uncertain',
    );

    const newPending =
      SemanticCandidateService.getPending(1);
    const newId = newPending[0].id;

    const rejectReply =
      ReplyService.getReply({
        content: `!tiberio_semantic_rejeitar ${newId}`,
        author: { bot: false, id: 'user_1', username: 'Legatus' },
        channelId: 'allowed_channel',
      } as any);

    assert.ok(rejectReply);
    assert.ok(rejectReply.includes(`rejeitado`));
  },
);
