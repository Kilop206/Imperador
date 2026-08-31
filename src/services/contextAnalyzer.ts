import { config } from '../config/config';
import { runtimeState } from '../state/runtimeState';
import { TextAnalyzer } from './textAnalyzer';

export class ContextAnalyzer {
  static isCombination(
    content: string
  ): string | null {
    const normalizedContent =
      TextAnalyzer.normalize(content);

    const contextData =
      config.tiberiusResponses.context;

    for (
      const [combinationKey, responses]
      of Object.entries(contextData)
    ) {
      const combinationWords =
        combinationKey
          .split('_')
          .map(word =>
            TextAnalyzer.normalize(word)
          );

      const hasAllWords =
        combinationWords.every(word =>
          normalizedContent
            .split(' ')
            .some(token =>
              token === word ||
              token.includes(word)
            )
        );

      if (
        hasAllWords &&
        responses.length > 0
      ) {
        return responses[
          Math.floor(
            Math.random() *
              responses.length
          )
        ];
      }
    }

    return null;
  }

  static trackWordFrequency(
    word: string
  ): void {
    const normalizedWord =
      TextAnalyzer.normalize(word);

    const currentCount =
      runtimeState.wordFrequency.get(
        normalizedWord
      ) || 0;

    runtimeState.wordFrequency.set(
      normalizedWord,
      currentCount + 1
    );
  }

  static getFrequencyBasedResponse(
    word: string
  ): string | null {
    const frequencyData =
      config.tiberiusResponses.frequency;

    const originalKey =
      Object.keys(frequencyData).find(
        key =>
          TextAnalyzer.normalize(key) ===
          TextAnalyzer.normalize(word)
      );

    if (!originalKey) {
      return null;
    }

    const count =
      runtimeState.wordFrequency.get(
        TextAnalyzer.normalize(originalKey)
      ) || 0;

    const frequencyOptions =
      frequencyData[originalKey];

    let appropriateResponses: string[] = [];
    let maxThreshold = 0;

    for (
      const [threshold, responses]
      of Object.entries(frequencyOptions)
    ) {
      const thresholdNum =
        Number.parseInt(
          threshold,
          10
        );

      if (
        count >= thresholdNum &&
        thresholdNum > maxThreshold
      ) {
        maxThreshold = thresholdNum;
        appropriateResponses = responses;
      }
    }

    if (
      appropriateResponses.length === 0
    ) {
      return null;
    }

    return appropriateResponses[
      Math.floor(
        Math.random() *
          appropriateResponses.length
      )
    ];
  }

  static isAggressive(
    content: string
  ): boolean {
    return TextAnalyzer.isAggressive(content);
  }

  static isCompliment(
    content: string
  ): boolean {
    return TextAnalyzer.isCompliment(content);
  }

  static isQuestion(
    content: string
  ): boolean {
    return TextAnalyzer.isQuestion(content);
  }

  static detectIntent(
    content: string
  ) {
    return TextAnalyzer.detectIntent(content);
  }

  static analyze(content: string) {
    return TextAnalyzer.analyze(content);
  }

  static incrementAggressiveCount(): void {
    runtimeState.aggressiveMessageCount++;
  }

  static resetAggressiveCount(): void {
    runtimeState.aggressiveMessageCount = 0;
  }

  static shouldTriggerThreatMode(): boolean {
    return (
      runtimeState.aggressiveMessageCount >= 3
    );
  }
}