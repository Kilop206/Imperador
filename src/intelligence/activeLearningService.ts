import {
  IntentPrediction,
} from './intentClassifier';

import {
  IntentCandidateService,
} from './intentCandidateService';

export interface ActiveLearningScore {
  uncertainty: number;
  margin: number;
  novelty: number;
  score: number;
  shouldCollect: boolean;
}

const DEFAULT_MIN_SCORE = 0.45;

const KNOWN_SIMILARITY_THRESHOLD = 0.85;

function normalize(
  text: string
): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(
      /[\u0300-\u036f]/g,
      ''
    )
    .replace(
      /[^\p{L}\p{N}\s]/gu,
      ' '
    )
    .replace(
      /\s+/g,
      ' '
    )
    .trim();
}

function tokenize(
  text: string
): Set<string> {
  return new Set(
    normalize(text)
      .split(' ')
      .filter(
        token =>
          token.length > 1
      )
  );
}

function similarity(
  a: string,
  b: string
): number {
  const tokensA =
    tokenize(a);

  const tokensB =
    tokenize(b);

  if (
    tokensA.size === 0 ||
    tokensB.size === 0
  ) {
    return 0;
  }

  let intersection = 0;

  for (
    const token of tokensA
  ) {
    if (
      tokensB.has(token)
    ) {
      intersection += 1;
    }
  }

  const union =
    new Set([
      ...tokensA,
      ...tokensB,
    ]).size;

  return union === 0
    ? 0
    : intersection / union;
}

export class ActiveLearningService {
  static score(
    text: string,
    prediction: IntentPrediction
  ): ActiveLearningScore {
    const probabilities =
      Object.values(
        prediction.probabilities
      ).sort(
        (a, b) => b - a
      );

    const top =
      probabilities[0] ?? 0;

    const second =
      probabilities[1] ?? 0;

    /*
     * Quanto menor a confiança,
     * maior a incerteza.
     */
    const uncertainty =
      1 - top;

    /*
     * Pequena diferença entre as duas
     * classes mais prováveis indica
     * ambiguidade.
     */
    const margin =
      1 -
      Math.min(
        top - second,
        1
      );

    /*
     * Mensagens já coletadas ou muito
     * semelhantes a candidatos pendentes
     * possuem pouco valor incremental.
     */
    const novelty =
      this.calculateNovelty(
        text
      );

    /*
     * Pesos:
     * 45% incerteza
     * 30% ambiguidade
     * 25% novidade
     */
    const score =
      (
        uncertainty * 0.45
      ) +
      (
        margin * 0.30
      ) +
      (
        novelty * 0.25
      );

    return {
      uncertainty,
      margin,
      novelty,
      score,
      shouldCollect:
        score >=
        DEFAULT_MIN_SCORE,
    };
  }

  static consider(
    text: string,
    prediction: IntentPrediction,
    minimumScore =
      DEFAULT_MIN_SCORE
  ): ActiveLearningScore {
    const result =
      this.score(
        text,
        prediction
      );

    const shouldCollect =
      result.score >=
      minimumScore;

    if (
      shouldCollect
    ) {
      IntentCandidateService.collect(
        text,
        prediction,
        1
      );
    }

    return {
      ...result,
      shouldCollect,
    };
  }

  private static calculateNovelty(
    text: string
  ): number {
    const candidates =
      IntentCandidateService.getPending(
        100
      );

    if (
      candidates.length === 0
    ) {
      return 1;
    }

    let maxSimilarity = 0;

    for (
      const candidate of
        candidates
    ) {
      const current =
        similarity(
          text,
          candidate.text
        );

      if (
        current >
        maxSimilarity
      ) {
        maxSimilarity =
          current;
      }
    }

    if (
      maxSimilarity >=
      KNOWN_SIMILARITY_THRESHOLD
    ) {
      return 0;
    }

    return (
      1 -
      maxSimilarity
    );
  }
}