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
  AutonomousLearningController,
  DEFAULT_LEARNING_POLICY,
} from '../src/intelligence/autonomousLearningController';

import {
  SemanticCandidateService,
} from '../src/intelligence/semanticCandidateService';

import {
  SemanticFeedbackService,
} from '../src/intelligence/semanticFeedbackService';

import {
  ModeManager,
} from '../src/services/modeManager';

const temporaryDirectories: string[] = [];

function createTemporaryFile(prefix: string, filename: string): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), prefix),
  );

  temporaryDirectories.push(directory);

  return path.join(directory, filename);
}

beforeEach(() => {
  AutonomousLearningController.resetPolicy();
  ModeManager.resetToNormal();

  const candidatesFile = createTemporaryFile(
    'imperador-ctrl-candidates-',
    'candidates.json',
  );

  const feedbackFile = createTemporaryFile(
    'imperador-ctrl-feedback-',
    'feedback.json',
  );

  SemanticCandidateService.reset();
  SemanticFeedbackService.reset();

  SemanticCandidateService.initialize(candidatesFile);
  SemanticFeedbackService.initialize(feedbackFile);
});

afterEach(() => {
  AutonomousLearningController.resetPolicy();
  ModeManager.resetToNormal();
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
        // Ignora erros temporários no Windows
      }
    }
  }
});

test(
  'AutonomousLearningController gerencia políticas configuráveis',
  () => {
    const policy = AutonomousLearningController.getPolicy();

    assert.equal(
      policy.minFeedbackForTraining,
      DEFAULT_LEARNING_POLICY.minFeedbackForTraining,
    );

    AutonomousLearningController.setPolicy({
      minFeedbackForTraining: 12,
      maxBatchSize: 80,
    });

    const updated = AutonomousLearningController.getPolicy();
    assert.equal(updated.minFeedbackForTraining, 12);
    assert.equal(updated.maxBatchSize, 80);

    AutonomousLearningController.resetPolicy();
    assert.equal(
      AutonomousLearningController.getPolicy().minFeedbackForTraining,
      DEFAULT_LEARNING_POLICY.minFeedbackForTraining,
    );
  },
);

test(
  'shouldCollectData decide corretamente quando coletar e quando ignorar',
  () => {
    // 1. Mensagem comum em modo normal -> permitido
    const r1 = AutonomousLearningController.shouldCollectData(
      'Roma foi construída sobre sete colinas',
      'normal',
    );
    assert.equal(r1.shouldCollect, true);

    // 2. Coleta desativada por política
    AutonomousLearningController.setPolicy({ dataCollectionEnabled: false });
    const r2 = AutonomousLearningController.shouldCollectData(
      'Roma foi construída sobre sete colinas',
      'normal',
    );
    assert.equal(r2.shouldCollect, false);
    assert.ok(r2.reason.includes('desativada'));

    AutonomousLearningController.resetPolicy();

    // 3. Bloqueio em modo de ameaça
    const r3 = AutonomousLearningController.shouldCollectData(
      'Roma foi construída sobre sete colinas',
      'threat',
    );
    assert.equal(r3.shouldCollect, false);
    assert.ok(r3.reason.includes('ameaça'));

    // 4. Mensagem muito curta
    const r4 = AutonomousLearningController.shouldCollectData('oi', 'normal');
    assert.equal(r4.shouldCollect, false);
    assert.ok(r4.reason.includes('curto'));

    // 5. Comandos de sistema
    const r5 = AutonomousLearningController.shouldCollectData('!tiberio_status', 'normal');
    assert.equal(r5.shouldCollect, false);
    assert.ok(r5.reason.includes('Comandos'));
  },
);

test(
  'shouldBatchExamples avalia lotes de treinamento com precisão',
  () => {
    AutonomousLearningController.setPolicy({ maxBatchSize: 20 });

    const zero = AutonomousLearningController.shouldBatchExamples(0);
    assert.equal(zero.shouldBatch, false);

    const partial = AutonomousLearningController.shouldBatchExamples(10);
    assert.equal(partial.shouldBatch, false);
    assert.equal(partial.batchSize, 10);

    const full = AutonomousLearningController.shouldBatchExamples(25);
    assert.equal(full.shouldBatch, true);
    assert.equal(full.batchSize, 20);
  },
);

test(
  'shouldRequestReview respeita limiares e cooldown temporal',
  () => {
    AutonomousLearningController.setPolicy({
      minCandidatesForReviewRequest: 3,
      reviewRequestCooldownMs: 10 * 1000, // 10 segundos
    });

    const now = 1000000;

    // Menos candidatos que o limiar
    SemanticCandidateService.collect('p1', 'p2', 0.5, 'uncertain');
    assert.equal(
      AutonomousLearningController.shouldRequestReview(now).shouldRequest,
      false,
    );

    // Atinge limiar de candidatos (3)
    SemanticCandidateService.collect('p3', 'p4', 0.5, 'uncertain');
    SemanticCandidateService.collect('p5', 'p6', 0.5, 'uncertain');

    const review1 = AutonomousLearningController.shouldRequestReview(now);
    assert.equal(review1.shouldRequest, true);

    // Registra a solicitação
    AutonomousLearningController.recordReviewRequest(now);

    // Logo em seguida (cooldown ativo) -> não deve solicitar
    const review2 = AutonomousLearningController.shouldRequestReview(now + 2000);
    assert.equal(review2.shouldRequest, false);
    assert.ok(review2.reason.includes('cooldown'));

    // Após o cooldown expirar (11 segundos depois) -> deve solicitar novamente
    const review3 = AutonomousLearningController.shouldRequestReview(now + 11000);
    assert.equal(review3.shouldRequest, true);
  },
);

test(
  'hasSufficientFeedback avalia adequadamente a quantidade de dados',
  () => {
    AutonomousLearningController.setPolicy({ minFeedbackForTraining: 3 });

    assert.equal(
      AutonomousLearningController.hasSufficientFeedback().hasSufficient,
      false,
    );

    SemanticFeedbackService.add('A', 'B', 1, 'human');
    SemanticFeedbackService.add('C', 'D', 0, 'human');
    assert.equal(
      AutonomousLearningController.hasSufficientFeedback().hasSufficient,
      false,
    );

    SemanticFeedbackService.add('E', 'F', 1, 'human');
    assert.equal(
      AutonomousLearningController.hasSufficientFeedback().hasSufficient,
      true,
    );
  },
);

test(
  'evaluateTrainingReadiness bloqueia treinamento quando NÃO deve treinar',
  () => {
    AutonomousLearningController.setPolicy({
      minFeedbackForTraining: 4,
      trainingCooldownMs: 60 * 1000,
      maxClassImbalanceRatio: 0.80,
      forbiddenModesForTraining: ['threat', 'drunk'],
    });

    const now = 5000000;

    // 1. Bloqueio: feedback insuficiente
    const d1 = AutonomousLearningController.evaluateTrainingReadiness(now, 'normal');
    assert.equal(d1.canTrain, false);
    assert.ok(d1.blockingReasons.some(r => r.includes('Feedback insuficiente')));

    // Adiciona 4 feedbacks, mas TODOS positivos (desbalanceamento 100%)
    SemanticFeedbackService.add('f1', 'f2', 1, 'human');
    SemanticFeedbackService.add('f3', 'f4', 1, 'human');
    SemanticFeedbackService.add('f5', 'f6', 1, 'human');
    SemanticFeedbackService.add('f7', 'f8', 1, 'human');

    // 2. Bloqueio: desbalanceamento extremo de classes
    const d2 = AutonomousLearningController.evaluateTrainingReadiness(now, 'normal');
    assert.equal(d2.canTrain, false);
    assert.ok(d2.blockingReasons.some(r => r.includes('Desbalanceamento')));

    // Adiciona feedbacks negativos para equilibrar
    SemanticFeedbackService.add('f9', 'f10', 0, 'human');
    SemanticFeedbackService.add('f11', 'f12', 0, 'human');

    // 3. Bloqueio: modo operacional proibido
    const d3 = AutonomousLearningController.evaluateTrainingReadiness(now, 'threat');
    assert.equal(d3.canTrain, false);
    assert.ok(d3.blockingReasons.some(r => r.includes('Treinamento proibido no modo')));

    const d3b = AutonomousLearningController.evaluateTrainingReadiness(now, 'drunk');
    assert.equal(d3b.canTrain, false);

    // 4. Bloqueio: cooldown após treinamento recente
    AutonomousLearningController.recordTrainingExecution(now);

    const d4 = AutonomousLearningController.evaluateTrainingReadiness(now + 10000, 'normal');
    assert.equal(d4.canTrain, false);
    assert.ok(d4.blockingReasons.some(r => r.includes('cooldown')));

    // 5. Sucesso: após o cooldown expirar e todas as condições atendidas
    const d5 = AutonomousLearningController.evaluateTrainingReadiness(now + 70000, 'normal');
    assert.equal(d5.canTrain, true);
    assert.equal(d5.blockingReasons.length, 0);
    assert.ok(d5.reason.includes('satisfeitas'));
  },
);

test(
  'canTriggerAutoTraining respeita a flag autoTrainingEnabled',
  () => {
    AutonomousLearningController.setPolicy({
      minFeedbackForTraining: 2,
      autoTrainingEnabled: false,
    });

    SemanticFeedbackService.add('s1', 's2', 1, 'human');
    SemanticFeedbackService.add('s3', 's4', 0, 'human');

    // Mesmo com condições de treino satisfeitas, não dispara se autoTrainingEnabled for false
    assert.equal(AutonomousLearningController.canTriggerAutoTraining(), false);

    // Ativa autoTrainingEnabled
    AutonomousLearningController.setPolicy({ autoTrainingEnabled: true });
    assert.equal(AutonomousLearningController.canTriggerAutoTraining(), true);
  },
);
