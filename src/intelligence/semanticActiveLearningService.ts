import {
  SemanticCandidateService,
  type SemanticCandidate,
  type SemanticCandidateReason,
} from './semanticCandidateService';

import {
  SemanticFeedbackService,
} from './semanticFeedbackService';

export interface SemanticActiveLearningInput {
  first: string;
  second: string;

  /**
   * Similaridade produzida pelo modelo semântico principal.
   * Esperado no intervalo [0, 1].
   */
  semanticScore: number;

  /**
   * Similaridade lexical/TF-IDF entre os textos.
   * Opcional porque nem todo pipeline terá esse sinal disponível.
   */
  tfidfScore?: number;

  /**
   * Similaridade por palavras-chave.
   * Opcional.
   */
  keywordScore?: number;

  /**
   * Score final produzido pelo retrieval híbrido.
   * Opcional.
   */
  retrievalScore?: number;

  /**
   * Score de novidade do par.
   * 0 = já muito representado no conjunto conhecido.
   * 1 = completamente novo.
   */
  noveltyScore?: number;
}

export interface SemanticActiveLearningOptions {
  /**
   * Faixa considerada incerta em torno de 0.5.
   */
  uncertaintyLowerBound?: number;
  uncertaintyUpperBound?: number;

  /**
   * Um semanticScore acima deste valor pode ser considerado
   * hard negative quando existe forte conflito lexical.
   */
  hardNegativeSemanticThreshold?: number;

  /**
   * Diferença mínima entre sinais semânticos e lexicais
   * para considerar conflito.
   */
  retrievalConflictThreshold?: number;

  /**
   * Novelty mínima para considerar um par realmente novo.
   */
  noveltyThreshold?: number;

  /**
   * Score mínimo para permitir a coleta.
   *
   * O collectionScore representa a maior evidência
   * individual de utilidade:
   *
   * max(uncertainty, disagreement, novelty)
   */
  minimumCollectionScore?: number;
}

export interface SemanticActiveLearningScore {
  /**
   * Utilidade baseada em incerteza.
   * 0 = certeza alta
   * 1 = máxima incerteza
   */
  uncertainty: number;

  /**
   * Utilidade baseada em novidade.
   */
  novelty: number;

  /**
   * Discordância entre os diferentes sinais.
   */
  disagreement: number;

  /**
   * Maior evidência individual de utilidade do exemplo.
   */
  collectionScore: number;

  shouldCollect: boolean;

  reason:
    | SemanticCandidateReason
    | null;
}

const DEFAULT_OPTIONS:
  Required<SemanticActiveLearningOptions> = {
    uncertaintyLowerBound: 0.35,
    uncertaintyUpperBound: 0.65,
    hardNegativeSemanticThreshold: 0.75,
    retrievalConflictThreshold: 0.30,
    noveltyThreshold: 0.75,
    minimumCollectionScore: 0.45,
  };

export class SemanticActiveLearningService {
  static score(
    input: SemanticActiveLearningInput,
    options: SemanticActiveLearningOptions = {},
  ): SemanticActiveLearningScore {
    const config =
      this.resolveOptions(options);

    const semanticScore =
      this.clamp(
        input.semanticScore,
      );

    const tfidfScore =
      this.clamp(
        input.tfidfScore ??
        semanticScore,
      );

    const keywordScore =
      this.clamp(
        input.keywordScore ??
        semanticScore,
      );

    const retrievalScore =
      input.retrievalScore ===
      undefined
        ? semanticScore
        : this.clamp(
            input.retrievalScore,
          );

    const novelty =
      this.clamp(
        input.noveltyScore ??
        1,
      );

    const uncertainty =
      this.computeUncertainty(
        semanticScore,
        config,
      );

    const disagreement =
      this.computeDisagreement(
        semanticScore,
        tfidfScore,
        keywordScore,
        retrievalScore,
      );

    const hardNegative =
      semanticScore >=
        config.hardNegativeSemanticThreshold &&
      (
        tfidfScore <
          semanticScore -
            config.retrievalConflictThreshold ||
        keywordScore <
          semanticScore -
            config.retrievalConflictThreshold
      );

    const retrievalConflict =
      input.retrievalScore !==
        undefined &&
      Math.abs(
        semanticScore -
          retrievalScore,
      ) >=
        config.retrievalConflictThreshold;

    let reason:
      | SemanticCandidateReason
      | null = null;

    /*
     * Determina primeiro se existe um motivo
     * concreto para coletar o exemplo.
     *
     * Prioridade:
     *
     * 1. hard-negative
     * 2. retrieval-conflict
     * 3. uncertain
     * 4. novel
     */
    if (hardNegative) {
      reason =
        'hard-negative';
    } else if (retrievalConflict) {
      reason =
        'retrieval-conflict';
    } else if (
      uncertainty > 0 &&
      semanticScore >=
        config.uncertaintyLowerBound &&
      semanticScore <=
        config.uncertaintyUpperBound
    ) {
      reason =
        'uncertain';
    } else if (
      novelty >=
      config.noveltyThreshold
    ) {
      reason =
        'novel';
    }

    /*
     * Para Active Learning, evidências fortes não devem
     * ser diluídas por sinais independentes.
     *
     * Exemplo:
     *
     * novelty = 0.95
     * uncertainty = 0
     * disagreement = 0
     *
     * O exemplo continua sendo altamente relevante.
     *
     * Da mesma forma, uma discordância forte entre modelos
     * deve ser suficiente para justificar revisão.
     */
    const collectionScore =
      Math.max(
        uncertainty,
        disagreement,
        novelty,
      );

    const shouldCollect =
      reason !== null &&
      collectionScore >=
        config.minimumCollectionScore;

    return {
      uncertainty,
      novelty,
      disagreement,
      collectionScore,
      shouldCollect,
      reason:
        shouldCollect
          ? reason
          : null,
    };
  }

  static consider(
    input: SemanticActiveLearningInput,
    options: SemanticActiveLearningOptions = {},
  ): SemanticCandidate | null {
    const score =
      this.score(
        input,
        options,
      );

    if (
      !score.shouldCollect ||
      !score.reason
    ) {
      return null;
    }

    const normalizedFirst =
      input.first.trim();

    const normalizedSecond =
      input.second.trim();

    if (
      !normalizedFirst ||
      !normalizedSecond
    ) {
      return null;
    }

    /*
     * Não coletar algo que já foi transformado
     * em dado supervisionado.
     */
    if (
      SemanticFeedbackService.hasPair(
        normalizedFirst,
        normalizedSecond,
      )
    ) {
      return null;
    }

    /*
     * A CandidateService também protege contra
     * duplicatas pendentes.
     */
    return SemanticCandidateService.collect(
      normalizedFirst,
      normalizedSecond,
      input.semanticScore,
      score.reason,
    );
  }

  static getPendingCount(): number {
    return SemanticCandidateService
      .getPendingCount();
  }

  static getPending(
    limit = 20,
  ): SemanticCandidate[] {
    return SemanticCandidateService
      .getPending(
        limit,
      );
  }

  static getCandidateScore(
    input: SemanticActiveLearningInput,
    options: SemanticActiveLearningOptions = {},
  ): number {
    return this.score(
      input,
      options,
    ).collectionScore;
  }

  private static computeUncertainty(
    semanticScore: number,
    options:
      Required<SemanticActiveLearningOptions>,
  ): number {
    const lower =
      options.uncertaintyLowerBound;

    const upper =
      options.uncertaintyUpperBound;

    if (
      semanticScore < lower ||
      semanticScore > upper
    ) {
      return 0;
    }

    /*
     * Quanto mais próximo de 0.5,
     * maior a incerteza.
     */
    const distance =
      Math.abs(
        semanticScore - 0.5,
      );

    const maxDistance =
      Math.max(
        Math.abs(
          lower - 0.5,
        ),
        Math.abs(
          upper - 0.5,
        ),
      );

    if (
      maxDistance === 0
    ) {
      return 1;
    }

    return this.clamp(
      1 -
        distance /
          maxDistance,
    );
  }

  private static computeDisagreement(
    semanticScore: number,
    tfidfScore: number,
    keywordScore: number,
    retrievalScore: number,
  ): number {
    const tfidfDisagreement =
      Math.abs(
        semanticScore -
          tfidfScore,
      );

    const keywordDisagreement =
      Math.abs(
        semanticScore -
          keywordScore,
      );

    const retrievalDisagreement =
      Math.abs(
        semanticScore -
          retrievalScore,
      );

    return this.clamp(
      Math.max(
        tfidfDisagreement,
        keywordDisagreement,
        retrievalDisagreement,
      ),
    );
  }

  private static resolveOptions(
    options: SemanticActiveLearningOptions,
  ): Required<SemanticActiveLearningOptions> {
    const resolved = {
      uncertaintyLowerBound:
        options.uncertaintyLowerBound ??
        DEFAULT_OPTIONS
          .uncertaintyLowerBound,

      uncertaintyUpperBound:
        options.uncertaintyUpperBound ??
        DEFAULT_OPTIONS
          .uncertaintyUpperBound,

      hardNegativeSemanticThreshold:
        options.hardNegativeSemanticThreshold ??
        DEFAULT_OPTIONS
          .hardNegativeSemanticThreshold,

      retrievalConflictThreshold:
        options.retrievalConflictThreshold ??
        DEFAULT_OPTIONS
          .retrievalConflictThreshold,

      noveltyThreshold:
        options.noveltyThreshold ??
        DEFAULT_OPTIONS
          .noveltyThreshold,

      minimumCollectionScore:
        options.minimumCollectionScore ??
        DEFAULT_OPTIONS
          .minimumCollectionScore,
    };

    resolved.uncertaintyLowerBound =
      this.clamp(
        resolved.uncertaintyLowerBound,
      );

    resolved.uncertaintyUpperBound =
      this.clamp(
        resolved.uncertaintyUpperBound,
      );

    resolved.hardNegativeSemanticThreshold =
      this.clamp(
        resolved.hardNegativeSemanticThreshold,
      );

    resolved.retrievalConflictThreshold =
      this.clamp(
        resolved.retrievalConflictThreshold,
      );

    resolved.noveltyThreshold =
      this.clamp(
        resolved.noveltyThreshold,
      );

    resolved.minimumCollectionScore =
      this.clamp(
        resolved.minimumCollectionScore,
      );

    if (
      resolved.uncertaintyLowerBound >
      resolved.uncertaintyUpperBound
    ) {
      const temporary =
        resolved.uncertaintyLowerBound;

      resolved.uncertaintyLowerBound =
        resolved.uncertaintyUpperBound;

      resolved.uncertaintyUpperBound =
        temporary;
    }

    return resolved;
  }

  private static clamp(
    value: number,
  ): number {
    if (
      !Number.isFinite(value)
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(
        1,
        value,
      ),
    );
  }
}