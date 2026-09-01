import {
  MessageIntent,
} from '../services/textAnalyzer';

import {
  IntentLearningService,
} from './intentLearningService';

import {
  IntentCandidateService,
} from './intentCandidateService';

export class IntentFeedbackService {
  static approve(
    candidateId: number,
    intent: MessageIntent
  ): boolean {
    const candidate =
      IntentCandidateService.getById(
        candidateId
      );

    if (!candidate) {
      return false;
    }

    IntentLearningService.learn(
      candidate.text,
      intent
    );

    IntentCandidateService.markReviewed(
      candidateId
    );

    return true;
  }

  static reject(
    candidateId: number
  ): boolean {
    return IntentCandidateService.markReviewed(
      candidateId
    );
  }

  static getPending(
    limit = 10
  ) {
    return IntentCandidateService.getPending(
      limit
    );
  }

  static getPendingCount(): number {
    return IntentCandidateService.getPendingCount();
  }
}