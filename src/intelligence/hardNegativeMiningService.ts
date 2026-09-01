import type {
  SemanticSentencePair,
} from "./semanticSentenceDataset";

import {
  type SemanticPrediction,
  getHardestErrors,
} from "./semanticErrorAnalysis";

export interface HardNegativeExample
  extends SemanticSentencePair {
  source: "model-error";
  score: number;
  createdAt: number;
}

export interface HardNegativeMiningOptions {
  maxExamples?: number;
  minimumScore?: number;
}

export class HardNegativeMiningService {
  private examples: HardNegativeExample[] = [];

  public mine(
    predictions: SemanticPrediction[],
    options: HardNegativeMiningOptions = {},
  ): HardNegativeExample[] {
    if (!Array.isArray(predictions)) {
      throw new TypeError(
        "predictions deve ser um array.",
      );
    }

    const maxExamples = Math.max(
      1,
      Math.floor(
        options.maxExamples ?? 20,
      ),
    );

    const minimumScore = Math.max(
      0,
      Math.min(
        1,
        options.minimumScore ?? 0.5,
      ),
    );

    const analysis = {
      total: predictions.length,
      correct: 0,
      incorrect: 0,
      falsePositive: predictions.filter(
        (prediction) =>
          prediction.expected === 0 &&
          prediction.predicted === 1,
      ),
      falseNegative: predictions.filter(
        (prediction) =>
          prediction.expected === 1 &&
          prediction.predicted === 0,
      ),
      predictions,
    };

    const candidates =
      getHardestErrors(
        analysis,
        maxExamples * 3,
      ).filter(
        (prediction) =>
          prediction.errorType ===
            "false-positive" &&
          prediction.score >=
            minimumScore,
      );

    const mined: HardNegativeExample[] = [];

    for (const candidate of candidates) {
      if (
        this.exists(
          candidate.first,
          candidate.second,
        )
      ) {
        continue;
      }

      const example: HardNegativeExample = {
        first: candidate.first,
        second: candidate.second,
        label: 0,
        source: "model-error",
        score: candidate.score,
        createdAt: Date.now(),
      };

      this.examples.push(example);
      mined.push(example);

      if (
        mined.length >= maxExamples
      ) {
        break;
      }
    }

    return mined;
  }

  public mineFromAnalysis(
    analysis: {
      predictions: SemanticPrediction[];
    },
    options: HardNegativeMiningOptions = {},
  ): HardNegativeExample[] {
    return this.mine(
      analysis.predictions,
      options,
    );
  }

  public getExamples(): HardNegativeExample[] {
    return this.examples.map(
      (example) => ({
        ...example,
      }),
    );
  }

  public getExampleCount(): number {
    return this.examples.length;
  }

  public toTrainingExamples():
    SemanticSentencePair[] {
    return this.examples.map(
      (example) => ({
        first: example.first,
        second: example.second,
        label: 0,
      }),
    );
  }

  public remove(
    first: string,
    second: string,
  ): boolean {
    const before =
      this.examples.length;

    this.examples = this.examples.filter(
      (example) =>
        !samePair(
          example.first,
          example.second,
          first,
          second,
        ),
    );

    return (
      this.examples.length !== before
    );
  }

  public clear(): void {
    this.examples = [];
  }

  public exportData():
    HardNegativeExample[] {
    return this.getExamples();
  }

  public importData(
    examples: HardNegativeExample[],
  ): this {
    if (!Array.isArray(examples)) {
      throw new TypeError(
        "examples deve ser um array.",
      );
    }

    for (const example of examples) {
      if (
        typeof example?.first !== "string" ||
        typeof example?.second !== "string" ||
        example.first.trim().length === 0 ||
        example.second.trim().length === 0 ||
        example.label !== 0 ||
        example.source !==
          "model-error" ||
        typeof example.score !==
          "number" ||
        typeof example.createdAt !==
          "number"
      ) {
        throw new TypeError(
          "Hard negative inválido.",
        );
      }
    }

    this.examples = [];

    for (const example of examples) {
      if (
        !this.exists(
          example.first,
          example.second,
        )
      ) {
        this.examples.push({
          first: example.first,
          second: example.second,
          label: 0,
          source: "model-error",
          score: example.score,
          createdAt: example.createdAt,
        });
      }
    }

    return this;
  }

  private exists(
    first: string,
    second: string,
  ): boolean {
    return this.examples.some(
      (example) =>
        samePair(
          example.first,
          example.second,
          first,
          second,
        ),
    );
  }
}

function normalize(
  text: string,
): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function samePair(
  firstA: string,
  secondA: string,
  firstB: string,
  secondB: string,
): boolean {
  const a1 = normalize(firstA);
  const a2 = normalize(secondA);
  const b1 = normalize(firstB);
  const b2 = normalize(secondB);

  return (
    (a1 === b1 && a2 === b2) ||
    (a1 === b2 && a2 === b1)
  );
}