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
  MemoryService,
} from '../src/services/memoryService';

import {
  AutonomousMemoryConsolidationService,
  DEFAULT_CONSOLIDATION_POLICY,
} from '../src/services/autonomousMemoryConsolidationService';

const temporaryDirectories: string[] = [];

function createTemporaryDb(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'imperador-consolidation-'),
  );
  temporaryDirectories.push(directory);
  return path.join(directory, 'memory.db');
}

beforeEach(() => {
  AutonomousMemoryConsolidationService.resetPolicy();
  const dbPath = createTemporaryDb();
  MemoryService.close();
  MemoryService.initialize(dbPath);
  MemoryService.clear();
});

afterEach(() => {
  AutonomousMemoryConsolidationService.resetPolicy();
  MemoryService.close();

  while (temporaryDirectories.length > 0) {
    const dir = temporaryDirectories.pop();
    if (dir && fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {
        // Ignora erros temporários no Windows
      }
    }
  }
});

test(
  'AutonomousMemoryConsolidationService gerencia políticas configuráveis',
  () => {
    const policy = AutonomousMemoryConsolidationService.getPolicy();
    assert.equal(
      policy.protectedMinImportance,
      DEFAULT_CONSOLIDATION_POLICY.protectedMinImportance,
    );

    AutonomousMemoryConsolidationService.setPolicy({
      decayAgeDays: 7,
      protectedMinImportance: 6,
    });

    const updated = AutonomousMemoryConsolidationService.getPolicy();
    assert.equal(updated.decayAgeDays, 7);
    assert.equal(updated.protectedMinImportance, 6);

    AutonomousMemoryConsolidationService.resetPolicy();
    assert.equal(
      AutonomousMemoryConsolidationService.getPolicy().decayAgeDays,
      DEFAULT_CONSOLIDATION_POLICY.decayAgeDays,
    );
  },
);

test(
  'detecta e resolve duplicatas unificando importâncias',
  () => {
    const now = 1000000;

    // Duas conversas com o mesmo tópico e alta sobreposição
    MemoryService.saveConversation(
      'user_1',
      'historia_romana',
      'As legiões marchavam organizadas sob o comando do cônsul',
      2,
    );

    // Forçamos a inserção de duplicata direta com tópico relacionado
    MemoryService.saveConversation(
      'user_1',
      'historia_romana_duplicada',
      'As legiões marchavam organizadas sob o comando do cônsul com armaduras',
      4,
    );

    const report = AutonomousMemoryConsolidationService.consolidate(
      { duplicateSimilarityThreshold: 0.60 },
      now,
    );

    assert.ok(report.duplicatesResolved >= 1);

    const remaining = MemoryService.getUserConversations('user_1');
    assert.equal(remaining.length, 1);
    // Deve preservar a maior importância entre as duas (4 ou promovida para 5)
    assert.ok(remaining[0].importance >= 4);
  },
);

test(
  'detecta memórias contraditórias e sintetiza perspectiva divergente',
  () => {
    const now = 2000000;

    // Memória 1: usuário é amigo do imperador
    MemoryService.saveConversation(
      'user_2',
      'relacao_politica_defesa',
      'O cidadão afirma que é amigo do imperador e defende Roma',
      3,
    );

    // Memória 2: usuário declara ser inimigo
    MemoryService.saveConversation(
      'user_2',
      'relacao_politica_ataque',
      'O cidadão declara que é inimigo do imperador e odeia Roma',
      3,
    );

    const report = AutonomousMemoryConsolidationService.consolidate(
      {},
      now,
    );

    assert.ok(report.contradictionsDetected >= 1);

    const remaining = MemoryService.getUserConversations('user_2');
    assert.ok(remaining.length >= 1);
    // A contradição eleva a importância para proteção e documenta a divergência
    assert.ok(remaining[0].importance >= 5);
    assert.ok(remaining[0].summary.includes('Perspectiva divergente'));
  },
);

test(
  'promove memórias nobres ou relevantes de tópicos imperiais',
  () => {
    const now = 3000000;

    MemoryService.saveConversation(
      'user_3',
      'filosofia_romana',
      'Discussão profunda sobre a virtude estoica e o império',
      3,
    );

    const report = AutonomousMemoryConsolidationService.consolidate(
      {},
      now,
    );

    assert.ok(report.memoriesPromoted >= 1);

    const updated = MemoryService.getUserConversations('user_3');
    assert.ok(updated[0].importance > 3);
  },
);

test(
  'reduz peso (decay) de memórias antigas sem acesso',
  () => {
    const now = Date.now();
    const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;

    const conv = MemoryService.saveConversation(
      'user_4',
      'tempo_antigo',
      'Uma conversa trivial sobre a colheita',
      3,
    );

    // Simula que a memória foi acessada há 15 dias
    MemoryService.updateConversation(conv.id, {
      lastSeen: fifteenDaysAgo,
    });

    const report = AutonomousMemoryConsolidationService.consolidate(
      { decayAgeDays: 14 },
      now,
    );

    assert.ok(report.memoriesDecayed >= 1);

    const updated = MemoryService.getUserConversations('user_4');
    assert.equal(updated[0].importance, 2);
  },
);

test(
  'elimina lixo sem violar a política de proteção explícita',
  () => {
    const now = Date.now();
    const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;

    // 1. Memória LIXO (importância 1, antiga > 30 dias) -> deve ser podada
    const garbage = MemoryService.saveConversation(
      'user_5',
      'fofoca_mercado',
      'Preço do pão subiu hoje no fórum',
      1,
    );
    MemoryService.updateConversation(garbage.id, {
      lastSeen: fortyDaysAgo,
    });

    // 2. Memória PROTEGIDA (importância 7, antiga > 40 dias) -> NUNCA PODE SER APAGADA
    const protectedMem = MemoryService.saveConversation(
      'user_5',
      'pacto_lealdade',
      'Juramento de fidelidade perpétua ao Imperador Tibério',
      7,
    );
    MemoryService.updateConversation(protectedMem.id, {
      lastSeen: fortyDaysAgo,
    });

    const report = AutonomousMemoryConsolidationService.consolidate(
      {
        garbageAgeDays: 30,
        garbageMaxImportance: 1,
        protectedMinImportance: 5,
      },
      now,
    );

    assert.equal(report.garbagePruned, 1);

    const conversations = MemoryService.getUserConversations('user_5');
    // Apenas a protegida deve ter sobrevivido
    assert.equal(conversations.length, 1);
    assert.equal(conversations[0].topic, 'pacto_lealdade');
    assert.ok(conversations[0].importance >= 7);
  },
);

test(
  'constrói associações entre memórias que compartilham termos temáticos',
  () => {
    const now = Date.now();

    MemoryService.saveConversation(
      'user_6',
      'legiao_augusta',
      'Os legionarios receberam gladios de ferro forjado em Roma',
      3,
    );

    MemoryService.saveConversation(
      'user_7',
      'senado_romano',
      'O senado debateu os legionarios e os tributos de Roma',
      3,
    );

    const report = AutonomousMemoryConsolidationService.consolidate(
      {},
      now,
    );

    assert.ok(report.associations.length >= 1);
    assert.ok(
      report.associations.some(
        a =>
          (a.sourceTopic === 'legiao_augusta' && a.targetTopic === 'senado_romano') ||
          (a.sourceTopic === 'senado_romano' && a.targetTopic === 'legiao_augusta'),
      ),
    );
  },
);
