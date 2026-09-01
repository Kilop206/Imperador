import {
  INTENT_DATASET,
} from './intentDataset';

import {
  evaluateIntentClassifier,
  formatEvaluationReport,
  splitDataset,
} from './intentEvaluation';

export interface IntentTrainingReport {
  trainingExamples: number;
  testExamples: number;
  accuracy: number;
  report: string;
}

export function trainAndEvaluateIntentModel(
  testRatio = 0.2,
  seed = 42
): IntentTrainingReport {
  const {
    train,
    test,
  } = splitDataset(
    INTENT_DATASET,
    testRatio,
    seed
  );

  const result =
    evaluateIntentClassifier(
      train,
      test
    );

  return {
    trainingExamples:
      train.length,
    testExamples:
      test.length,
    accuracy:
      result.accuracy,
    report:
      formatEvaluationReport(
        result
      ),
  };
}