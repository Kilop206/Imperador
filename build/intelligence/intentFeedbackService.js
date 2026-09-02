"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentFeedbackService = void 0;
const intentLearningService_1 = require("./intentLearningService");
const intentCandidateService_1 = require("./intentCandidateService");
class IntentFeedbackService {
    static approve(candidateId, intent) {
        const candidate = intentCandidateService_1.IntentCandidateService.getById(candidateId);
        if (!candidate) {
            return false;
        }
        intentLearningService_1.IntentLearningService.learn(candidate.text, intent);
        intentCandidateService_1.IntentCandidateService.markReviewed(candidateId);
        return true;
    }
    static reject(candidateId) {
        return intentCandidateService_1.IntentCandidateService.markReviewed(candidateId);
    }
    static getPending(limit = 10) {
        return intentCandidateService_1.IntentCandidateService.getPending(limit);
    }
    static getPendingCount() {
        return intentCandidateService_1.IntentCandidateService.getPendingCount();
    }
}
exports.IntentFeedbackService = IntentFeedbackService;
