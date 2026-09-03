import { GeneratedResponseFeedbackService } from './generatedResponseFeedbackService';
import { ResponseGenerationEngine } from './responseGenerationEngine';

export interface GeneratedResponseLearningResult {
  scanned: number;
  applied: number;
  skipped: number;
  appliedFeedbackIds: string[];
}

export class GeneratedResponseLearningService {
  private static readonly appliedIds = new Set<string>();

  public static applyEligible(
    engine: ResponseGenerationEngine,
    limit = 50,
  ): GeneratedResponseLearningResult {
    if (!engine) {
      throw new TypeError('ResponseGenerationEngine é obrigatório.');
    }

    const entries = GeneratedResponseFeedbackService.listTrainingEligible(limit);
    const result: GeneratedResponseLearningResult = {
      scanned: entries.length,
      applied: 0,
      skipped: 0,
      appliedFeedbackIds: [],
    };

    for (const entry of entries) {
      if (this.appliedIds.has(entry.id)) {
        result.skipped += 1;
        continue;
      }

      if (!entry.feedback || entry.feedback.label !== 'positive') {
        result.skipped += 1;
        continue;
      }

      const learned = engine.learnApprovedResponse(entry.responseText);

      this.appliedIds.add(entry.id);

      if (learned) {
        result.applied += 1;
        result.appliedFeedbackIds.push(entry.id);
      } else {
        result.skipped += 1;
      }
    }

    return result;
  }

  public static hasApplied(feedbackId: string): boolean {
    return this.appliedIds.has(feedbackId);
  }

  public static reset(): void {
    this.appliedIds.clear();
  }
}
