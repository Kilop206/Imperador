import {
  TiberiusMode,
} from '../types/tiberius';

import {
  EmotionState,
} from '../types/emotion';

import {
  PersonalityEngine,
} from './personalityEngine';

import {
  EmotionEngine,
} from './emotionEngine';

import {
  ModeManager,
} from '../services/modeManager';

import {
  TextAnalyzer,
} from '../services/textAnalyzer';

import {
  ModelManager,
} from './modelManager';

export interface SelfEvaluationMetrics {
  /**
   * Relevância semântica/lexical entre input do usuário e resposta [0, 1].
   * Justificativa: Garante que a resposta trate do mesmo domínio ou reação à fala do usuário.
   */
  relevance: number;

  /**
   * Aderência ao contexto conversacional, intenção detectada e modo [0, 1].
   * Justificativa: Garante coerência situacional (ex: reagir com autoridade a insultos).
   */
  contextAdherence: number;

  /**
   * Consistência com o perfil imperial e ausência de violações de persona [0, 1].
   * Justificativa: Protege a integridade da identidade do Imperador (violação zera a métrica).
   */
  personalityConsistency: number;

  /**
   * Alinhamento entre o tom da resposta e o estado emocional interno [0, 1].
   * Justificativa: Expressa o estado emocional interno (irritação, desdém, respeito).
   */
  emotionAlignment: number;

  /**
   * Score de confiança na resposta selecionada [0, 1].
   * Justificativa: Mede a segurança do pipeline na formulação da resposta.
   */
  confidence: number;

  /**
   * Penalidade de repetição / novidade [0, 1] (1 = sem repetição, 0 = repetição exata).
   * Justificativa: Evita loops conversacionais repetitivos e monotonia.
   */
  novelty: number;

  /**
   * Indicador de falha na resposta (vazia, nula ou violação crítica).
   * Justificativa: Permite calcular taxa de falha contínua do agente.
   */
  isFailure: boolean;

  /**
   * Score sintético ponderado de qualidade percebida global [0, 1].
   * Justificativa: Fornece um índice único balanceado para monitoramento contínuo.
   */
  overallQuality: number;
}

export interface SelfEvaluationResult {
  id: string;
  timestamp: number;
  userMessage: string;
  responseText: string;
  mode: TiberiusMode;
  metrics: SelfEvaluationMetrics;
  diagnostics: string[];
}

export interface AggregateQualityMetrics {
  totalEvaluations: number;
  averageQuality: number;
  averageRelevance: number;
  averagePersonalityConsistency: number;
  averageNovelty: number;
  averageEmotionAlignment: number;
  failureRate: number;
  stabilityScore: number;
}

const MAX_HISTORY_SIZE = 100;
const RECENT_RESPONSES_WINDOW = 15;

/**
 * Self-Evaluation Engine
 *
 * Motor de avaliação contínua e autônoma das respostas geradas pelo Imperador.
 * Calcula métricas fundamentadas arquiteturalmente para cada resposta emitida,
 * rastreando qualidade percebida, repetição, consistência com a persona e estabilidade.
 */
export class SelfEvaluationEngine {
  private static evaluationHistory: SelfEvaluationResult[] = [];
  private static recentResponses: string[] = [];

  /**
   * Avalia uma resposta emitida para uma dada mensagem do usuário.
   */
  public static evaluate(
    userMessage: string,
    responseText: string,
    options: {
      confidence?: number;
      mode?: TiberiusMode;
      emotionState?: EmotionState;
    } = {},
  ): SelfEvaluationResult {
    const timestamp = Date.now();
    const id = `eval_${timestamp}_${Math.floor(Math.random() * 10000)}`;
    const mode = options.mode ?? ModeManager.getMode();
    const emotion = options.emotionState ?? EmotionEngine.getState();
    const diagnostics: string[] = [];

    const trimmedUser = userMessage?.trim() ?? '';
    const trimmedResponse = responseText?.trim() ?? '';

    // 1. Verificação de falha básica
    if (!trimmedResponse) {
      const failureMetrics: SelfEvaluationMetrics = {
        relevance: 0,
        contextAdherence: 0,
        personalityConsistency: 0,
        emotionAlignment: 0,
        confidence: 0,
        novelty: 0,
        isFailure: true,
        overallQuality: 0,
      };

      const failureResult: SelfEvaluationResult = {
        id,
        timestamp,
        userMessage: trimmedUser,
        responseText: '',
        mode,
        metrics: failureMetrics,
        diagnostics: ['Falha: Resposta nula ou vazia.'],
      };

      this.recordEvaluation(failureResult);
      return failureResult;
    }

    // 2. Consistência de Personalidade (PersonalityEngine)
    const violation = PersonalityEngine.checkViolation(trimmedResponse);
    const personalityConsistency = violation ? 0 : 1;

    if (violation) {
      diagnostics.push(`Violação de personalidade detectada: ${violation}`);
    }

    // 3. Relevância semântica / lexical
    const relevance = this.calculateRelevance(trimmedUser, trimmedResponse);

    // 4. Aderência ao contexto e intenção
    const contextAdherence = this.calculateContextAdherence(
      trimmedUser,
      trimmedResponse,
      mode,
    );

    // 5. Alinhamento emocional
    const emotionAlignment = this.calculateEmotionAlignment(
      trimmedResponse,
      emotion,
    );

    // 6. Novidade e penalidade de repetição
    const novelty = this.calculateNovelty(trimmedResponse);
    if (novelty < 0.3) {
      diagnostics.push('Alerta: Resposta com alto índice de repetição recente.');
    }

    // 7. Confiança
    const confidence = options.confidence ?? 0.75;

    // 8. Falha lógica
    const isFailure = personalityConsistency === 0;

    // 9. Qualidade geral ponderada
    let overallQuality = 0;
    if (!isFailure) {
      overallQuality =
        relevance * 0.25 +
        personalityConsistency * 0.30 +
        contextAdherence * 0.15 +
        novelty * 0.15 +
        emotionAlignment * 0.15;

      // Clamping [0, 1]
      overallQuality = Math.max(0, Math.min(1, overallQuality));
    }

    const metrics: SelfEvaluationMetrics = {
      relevance: Number(relevance.toFixed(3)),
      contextAdherence: Number(contextAdherence.toFixed(3)),
      personalityConsistency: Number(personalityConsistency.toFixed(3)),
      emotionAlignment: Number(emotionAlignment.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      novelty: Number(novelty.toFixed(3)),
      isFailure,
      overallQuality: Number(overallQuality.toFixed(3)),
    };

    const result: SelfEvaluationResult = {
      id,
      timestamp,
      userMessage: trimmedUser,
      responseText: trimmedResponse,
      mode,
      metrics,
      diagnostics,
    };

    this.recordEvaluation(result);
    this.recordRecentResponse(trimmedResponse);

    return result;
  }

  /**
   * Calcula relevância entre o input do usuário e a resposta.
   * Utiliza proximidade vetorial se os modelos estiverem disponíveis,
   * complementado por sobreposição de tokens de TextAnalyzer.
   */
  private static calculateRelevance(
    userMessage: string,
    responseText: string,
  ): number {
    if (!userMessage) {
      return 0.5; // Mensagem espontânea
    }

    let neuralSim = 0;
    if (ModelManager.isInitialized()) {
      try {
        neuralSim = ModelManager.getSentenceModel().similarity(
          ModelManager.getWordEmbeddingModel(),
          userMessage,
          responseText,
        );
      } catch {
        neuralSim = 0;
      }
    }

    const userTokens = new Set(TextAnalyzer.tokenize(userMessage));
    const responseTokens = new Set(TextAnalyzer.tokenize(responseText));

    let intersectionCount = 0;
    for (const token of userTokens) {
      if (responseTokens.has(token)) {
        intersectionCount++;
      }
    }

    const unionCount = new Set([...userTokens, ...responseTokens]).size;
    const jaccard = unionCount > 0 ? intersectionCount / unionCount : 0;

    // Respostas têm relevância base natural de diálogo (mesmo que discordem nas palavras)
    const baseRelevance = 0.35;
    const combined = baseRelevance + jaccard * 0.35 + Math.max(0, neuralSim) * 0.30;

    return Math.max(0, Math.min(1, combined));
  }

  /**
   * Avalia a coerência da resposta frente ao modo e à intenção detectada.
   */
  private static calculateContextAdherence(
    userMessage: string,
    responseText: string,
    mode: TiberiusMode,
  ): number {
    let score = 0.70; // Patamar neutro padrão

    if (userMessage) {
      const analysis = TextAnalyzer.analyze(userMessage);

      // Respostas em contexto agressivo devem manter tom imperial firme
      if (analysis.isAggressive) {
        if (
          responseText.toLowerCase().includes('insolência') ||
          responseText.toLowerCase().includes('império') ||
          responseText.toLowerCase().includes('roma') ||
          responseText.toLowerCase().includes('silêncio')
        ) {
          score += 0.25;
        }
      }

      // Perguntas respondidas com autoridade
      if (analysis.isQuestion) {
        score += 0.15;
      }
    }

    // Aderência ao modo atual
    if (mode === 'drunk') {
      if (
        responseText.toLowerCase().includes('vinho') ||
        responseText.toLowerCase().includes('taça') ||
        responseText.toLowerCase().includes('brinde')
      ) {
        score += 0.15;
      }
    } else if (mode === 'roman') {
      if (
        responseText.toLowerCase().includes('roma') ||
        responseText.toLowerCase().includes('senado') ||
        responseText.toLowerCase().includes('legião') ||
        responseText.toLowerCase().includes('spqr')
      ) {
        score += 0.15;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Avalia compatibilidade entre a resposta e o estado emocional.
   */
  private static calculateEmotionAlignment(
    responseText: string,
    emotion: EmotionState,
  ): number {
    let score = 0.80;
    const lower = responseText.toLowerCase();

    // Alta irritação ou hostilidade exige tom severo
    if (emotion.irritation > 60 || emotion.hostility > 40) {
      if (lower.includes('por favor') || lower.includes('obrigado')) {
        score -= 0.40;
      } else {
        score += 0.15;
      }
    }

    // Alta diversão/amusement favorece humor
    if (emotion.amusement > 60) {
      score += 0.10;
    }

    return Math.max(0, Math.min(1, score));
  }

  /**
   * Avalia repetição contra o histórico recente de respostas emitidas.
   */
  private static calculateNovelty(responseText: string): number {
    if (this.recentResponses.length === 0) {
      return 1.0;
    }

    const normalizedCurrent = TextAnalyzer.normalize(responseText);

    let maxSimilarity = 0;
    for (const recent of this.recentResponses) {
      const normalizedRecent = TextAnalyzer.normalize(recent);

      if (normalizedCurrent === normalizedRecent) {
        return 0.0; // Repetição exata
      }

      const tokensA = new Set(TextAnalyzer.tokenize(normalizedCurrent));
      const tokensB = new Set(TextAnalyzer.tokenize(normalizedRecent));

      let common = 0;
      for (const t of tokensA) {
        if (tokensB.has(t)) {
          common++;
        }
      }

      const union = new Set([...tokensA, ...tokensB]).size;
      const sim = union > 0 ? common / union : 0;
      if (sim > maxSimilarity) {
        maxSimilarity = sim;
      }
    }

    // Novelty é o complemento da maior similaridade com o histórico recente
    return Math.max(0, Math.min(1, 1 - maxSimilarity));
  }

  private static recordEvaluation(result: SelfEvaluationResult): void {
    this.evaluationHistory.push(result);
    if (this.evaluationHistory.length > MAX_HISTORY_SIZE) {
      this.evaluationHistory.shift();
    }
  }

  private static recordRecentResponse(responseText: string): void {
    this.recentResponses.push(responseText);
    if (this.recentResponses.length > RECENT_RESPONSES_WINDOW) {
      this.recentResponses.shift();
    }
  }

  /**
   * Retorna as métricas agregadas do histórico de avaliações.
   */
  public static getAggregateMetrics(): AggregateQualityMetrics {
    const total = this.evaluationHistory.length;
    if (total === 0) {
      return {
        totalEvaluations: 0,
        averageQuality: 0,
        averageRelevance: 0,
        averagePersonalityConsistency: 0,
        averageNovelty: 0,
        averageEmotionAlignment: 0,
        failureRate: 0,
        stabilityScore: 1,
      };
    }

    let sumQuality = 0;
    let sumRelevance = 0;
    let sumPersonality = 0;
    let sumNovelty = 0;
    let sumEmotion = 0;
    let failures = 0;

    for (const entry of this.evaluationHistory) {
      sumQuality += entry.metrics.overallQuality;
      sumRelevance += entry.metrics.relevance;
      sumPersonality += entry.metrics.personalityConsistency;
      sumNovelty += entry.metrics.novelty;
      sumEmotion += entry.metrics.emotionAlignment;
      if (entry.metrics.isFailure) {
        failures++;
      }
    }

    const avgQuality = sumQuality / total;

    // Cálculo da estabilidade (1 - desvio padrão das avaliações de qualidade)
    let varianceSum = 0;
    for (const entry of this.evaluationHistory) {
      varianceSum += Math.pow(entry.metrics.overallQuality - avgQuality, 2);
    }
    const standardDeviation = Math.sqrt(varianceSum / total);
    const stabilityScore = Math.max(0, Math.min(1, 1 - standardDeviation * 2));

    return {
      totalEvaluations: total,
      averageQuality: Number(avgQuality.toFixed(3)),
      averageRelevance: Number((sumRelevance / total).toFixed(3)),
      averagePersonalityConsistency: Number((sumPersonality / total).toFixed(3)),
      averageNovelty: Number((sumNovelty / total).toFixed(3)),
      averageEmotionAlignment: Number((sumEmotion / total).toFixed(3)),
      failureRate: Number((failures / total).toFixed(3)),
      stabilityScore: Number(stabilityScore.toFixed(3)),
    };
  }

  /**
   * Retorna a avaliação mais recente, se existir.
   */
  public static getLastEvaluation(): SelfEvaluationResult | null {
    if (this.evaluationHistory.length === 0) {
      return null;
    }
    return this.evaluationHistory[this.evaluationHistory.length - 1];
  }

  /**
   * Limpa o histórico de avaliações e respostas recentes (para testes).
   */
  public static reset(): void {
    this.evaluationHistory = [];
    this.recentResponses = [];
  }
}
