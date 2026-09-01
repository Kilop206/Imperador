import type {
  SemanticSentencePair,
} from "./semanticSentenceDataset";

export interface SemanticAugmentationOptions {
  includeReversedPairs?: boolean;
  includePunctuationVariants?: boolean;
  includeCaseVariants?: boolean;
  maxAugmentedPerExample?: number;
  maxTotalExamples?: number;
}

export interface SemanticAugmentationResult {
  originalCount: number;
  augmentedCount: number;
  totalCount: number;
  examples: SemanticSentencePair[];
}

export class SemanticDataAugmentationService {
  public augment(
    dataset: SemanticSentencePair[],
    options: SemanticAugmentationOptions = {},
  ): SemanticAugmentationResult {
    if (!Array.isArray(dataset)) {
      throw new TypeError(
        "dataset deve ser um array.",
      );
    }

    const includeReversed =
      options.includeReversedPairs ?? true;

    const includePunctuation =
      options.includePunctuationVariants ?? true;

    const includeCase =
      options.includeCaseVariants ?? true;

    const maxAugmentedPerExample =
      Math.max(
        0,
        Math.floor(
          options.maxAugmentedPerExample ?? 4,
        ),
      );

    const validExamples =
      dataset.filter(
        (example) =>
          this.isValidExample(example),
      );

    const maxTotalExamples =
      Math.max(
        validExamples.length,
        Math.floor(
          options.maxTotalExamples ??
            validExamples.length * 3,
        ),
      );

    const result: SemanticSentencePair[] =
      [];

    const originalKeys = new Set<string>();

    for (const example of validExamples) {
      originalKeys.add(
        this.createExactKey(example),
      );
    }

    const seenExact = new Set<string>();

    for (const example of validExamples) {
      if (
        result.length >=
        maxTotalExamples
      ) {
        break;
      }

      this.addExactUnique(
        result,
        seenExact,
        example,
      );
    }

    const originalCount = result.length;

    if (
      maxAugmentedPerExample === 0 ||
      result.length >= maxTotalExamples
    ) {
      return {
        originalCount,
        augmentedCount: 0,
        totalCount: result.length,
        examples: result,
      };
    }

    for (const example of validExamples) {
      if (
        result.length >=
        maxTotalExamples
      ) {
        break;
      }

      let generated = 0;

      const candidates: Array<{
        example: SemanticSentencePair;
        type:
          | "reverse"
          | "punctuation"
          | "case";
      }> = [];

      if (includeReversed) {
        candidates.push({
          example: {
            first: example.second,
            second: example.first,
            label: example.label,
          },
          type: "reverse",
        });
      }

      if (includePunctuation) {
        candidates.push({
          example: {
            first:
              this.togglePunctuation(
                example.first,
              ),
            second:
              this.togglePunctuation(
                example.second,
              ),
            label: example.label,
          },
          type: "punctuation",
        });
      }

      if (includeCase) {
        candidates.push({
          example: {
            first:
              this.toggleCase(
                example.first,
              ),
            second:
              this.toggleCase(
                example.second,
              ),
            label: example.label,
          },
          type: "case",
        });
      }

      if (includePunctuation) {
        candidates.push({
          example: {
            first:
              this.removeTerminalPunctuation(
                example.first,
              ),
            second:
              this.removeTerminalPunctuation(
                example.second,
              ),
            label: example.label,
          },
          type: "punctuation",
        });
      }

      for (const candidate of candidates) {
        if (
          generated >=
          maxAugmentedPerExample
        ) {
          break;
        }

        if (
          result.length >=
          maxTotalExamples
        ) {
          break;
        }

        const candidateKey =
          this.createExactKey(
            candidate.example,
          );

        if (
          originalKeys.has(
            candidateKey,
          )
        ) {
          continue;
        }

        if (
          this.addExactUnique(
            result,
            seenExact,
            candidate.example,
          )
        ) {
          generated += 1;
        }
      }
    }

    return {
      originalCount,
      augmentedCount:
        result.length - originalCount,
      totalCount: result.length,
      examples: result,
    };
  }

  public deduplicate(
    dataset: SemanticSentencePair[],
  ): SemanticSentencePair[] {
    if (!Array.isArray(dataset)) {
      throw new TypeError(
        "dataset deve ser um array.",
      );
    }

    const result: SemanticSentencePair[] =
      [];

    const seen = new Set<string>();

    for (const example of dataset) {
      if (!this.isValidExample(example)) {
        continue;
      }

      const key =
        this.createSemanticKey(example);

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);

      result.push({
        first: example.first,
        second: example.second,
        label: example.label,
      });
    }

    return result;
  }

  public isValidExample(
    example: SemanticSentencePair,
  ): boolean {
    return (
      typeof example?.first === "string" &&
      example.first.trim().length > 0 &&
      typeof example?.second === "string" &&
      example.second.trim().length > 0 &&
      (example.label === 0 ||
        example.label === 1)
    );
  }

  private addExactUnique(
    result: SemanticSentencePair[],
    seen: Set<string>,
    example: SemanticSentencePair,
  ): boolean {
    const key =
      this.createExactKey(example);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    result.push({
      first: example.first,
      second: example.second,
      label: example.label,
    });

    return true;
  }

  private createExactKey(
    example: SemanticSentencePair,
  ): string {
    return [
      example.label,
      example.first.trim(),
      example.second.trim(),
    ].join("|||");
  }

  private createSemanticKey(
    example: SemanticSentencePair,
  ): string {
    const first =
      normalizeForComparison(
        example.first,
      );

    const second =
      normalizeForComparison(
        example.second,
      );

    const ordered =
      first <= second
        ? `${first}|||${second}`
        : `${second}|||${first}`;

    return [
      example.label,
      ordered,
    ].join("|||");
  }

  private togglePunctuation(
    text: string,
  ): string {
    const trimmed = text.trim();

    if (!trimmed) {
      return trimmed;
    }

    const last = trimmed.charAt(-1);

    if (
      last === "." ||
      last === "!" ||
      last === "?"
    ) {
      return trimmed.slice(0, -1);
    }

    return `${trimmed}.`;
  }

  private removeTerminalPunctuation(
    text: string,
  ): string {
    return text
      .trim()
      .replace(/[.!?]+$/u, "");
  }

  private toggleCase(
    text: string,
  ): string {
    const trimmed = text.trim();

    if (!trimmed) {
      return trimmed;
    }

    const isUpper =
      trimmed ===
      trimmed.toUpperCase();

    if (isUpper) {
      return trimmed.toLowerCase();
    }

    return trimmed.toUpperCase();
  }
}

function normalizeForComparison(
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