import { config } from '../config/config';
import { ContextAnalyzer } from './contextAnalyzer';
import { ModeManager } from './modeManager';
import { RarityManager } from './rarityManager';
import {
  MessageIntent,
  TextAnalyzer,
} from './textAnalyzer';
import {
  ResponseValidator,
} from './responseValidator';
import {
  MemoryContextService,
} from './memoryContext';

export type ResponseSource =
  | 'memory'
  | 'context'
  | 'aggressive'
  | 'compliment'
  | 'mode'
  | 'keyword'
  | 'intent'
  | 'rare';

export interface ResponseCandidate {
  text: string;
  source: ResponseSource;
  score: number;
}

export class ResponseEngine {
  static generateCandidates(
    content: string,
    userId?: string
  ): ResponseCandidate[] {
    const candidates:
      ResponseCandidate[] = [];

    const analysis =
      TextAnalyzer.analyze(content);

    if (userId) {
      this.addMemoryCandidates(
        userId,
        content,
        candidates
      );
    }

    const contextResponse =
      ContextAnalyzer.isCombination(
        content
      );

    if (contextResponse) {
      candidates.push({
        text: contextResponse,
        source: 'context',
        score: 100,
      });
    }

    if (analysis.isAggressive) {
      this.addAggressiveCandidates(
        content,
        candidates
      );
    }

    if (analysis.isCompliment) {
      this.addComplimentCandidates(
        candidates
      );
    }

    if (
      !ModeManager.isNormalMode()
    ) {
      const modeResponse =
        ModeManager.getModeResponse();

      if (modeResponse) {
        candidates.push({
          text: modeResponse,
          source: 'mode',
          score:
            analysis.intent ===
            'aggressive'
              ? 45
              : 60,
        });
      }
    }

    this.addKeywordCandidates(
      content,
      analysis,
      candidates
    );

    this.addIntentCandidates(
      content,
      analysis.intent,
      candidates
    );

    const rareResponse =
      RarityManager.getRareResponse();

    if (rareResponse) {
      candidates.push({
        text: rareResponse,
        source: 'rare',
        score: 10,
      });
    }

    return candidates;
  }

  static selectResponse(
    content: string,
    userId?: string
  ): string | null {
    const candidates =
      this.generateCandidates(
        content,
        userId
      );

    if (candidates.length === 0) {
      return null;
    }

    const filtered =
      this.filterCandidates(
        candidates,
        content
      );

    if (filtered.length === 0) {
      return null;
    }

    const sorted =
      [...filtered].sort(
        (a, b) =>
          b.score - a.score
      );

    const bestScore =
      sorted[0].score;

    const bestCandidates =
      sorted.filter(
        candidate =>
          candidate.score ===
          bestScore
      );

    return this.randomItem(
      bestCandidates
    ).text;
  }

  private static addMemoryCandidates(
    userId: string,
    content: string,
    candidates: ResponseCandidate[]
  ): void {
    const memoryResponse =
      MemoryContextService.buildMemoryResponse(
        userId,
        content
      );

    if (!memoryResponse) {
      return;
    }

    candidates.push({
      text: memoryResponse,
      source: 'memory',
      score: 85,
    });
  }

  private static addAggressiveCandidates(
    content: string,
    candidates: ResponseCandidate[]
  ): void {
    const normalized =
      TextAnalyzer.normalize(
        content
      );

    const keywords =
      config.tiberiusResponses
        .keywords;

    for (
      const [keyword, responses]
      of Object.entries(keywords)
    ) {
      const normalizedKeyword =
        TextAnalyzer.normalize(
          keyword
        );

      if (
        !normalized.includes(
          normalizedKeyword
        )
      ) {
        continue;
      }

      const response =
        this.resolveResponse(
          responses,
          true,
          false
        );

      if (response) {
        candidates.push({
          text: response,
          source: 'aggressive',
          score: 90,
        });

        break;
      }
    }
  }

  private static addComplimentCandidates(
    candidates: ResponseCandidate[]
  ): void {
    const responses =
      config.tiberiusResponses
        .compliments;

    for (
      const response of responses
    ) {
      if (
        ResponseValidator.isResponseAppropriate(
          response,
          false,
          true
        )
      ) {
        candidates.push({
          text: response,
          source: 'compliment',
          score: 80,
        });
      }
    }
  }

  private static addKeywordCandidates(
    content: string,
    analysis: {
      isAggressive: boolean;
      isCompliment: boolean;
      intent: MessageIntent;
    },
    candidates: ResponseCandidate[]
  ): void {
    const normalized =
      TextAnalyzer.normalize(
        content
      );

    const keywords =
      config.tiberiusResponses
        .keywords;

    for (
      const [keyword, responses]
      of Object.entries(keywords)
    ) {
      const normalizedKeyword =
        TextAnalyzer.normalize(
          keyword
        );

      if (
        !normalized.includes(
          normalizedKeyword
        )
      ) {
        continue;
      }

      const response =
        this.resolveResponse(
          responses,
          analysis.isAggressive,
          analysis.isCompliment
        );

      if (response) {
        candidates.push({
          text: response,
          source: 'keyword',
          score: 65,
        });
      }
    }
  }

  private static addIntentCandidates(
    content: string,
    intent: MessageIntent,
    candidates: ResponseCandidate[]
  ): void {
    const keywords =
      config.tiberiusResponses
        .keywords;

    const intentKeywords:
      Partial<Record<
        MessageIntent,
        string[]
      >> = {
      greeting: [
        'oi',
        'ola',
        'olá',
        'bom dia',
        'boa tarde',
        'boa noite',
      ],

      farewell: [
        'tchau',
        'adeus',
        'até mais',
        'ate mais',
      ],

      humor: [
        'kkkk',
        'hahaha',
        'haha',
        'rsrs',
      ],

      serious: [
        'morte',
        'guerra',
      ],

      nostalgic: [
        'passado',
        'saudade',
      ],

      philosophical: [
        'vida',
        'existência',
        'sentido',
      ],

      roman: [
        'roma',
        'romano',
        'império',
      ],
    };

    const possibleKeywords =
      intentKeywords[intent] || [];

    const normalized =
      TextAnalyzer.normalize(
        content
      );

    for (
      const keyword
      of possibleKeywords
    ) {
      if (
        !normalized.includes(
          TextAnalyzer.normalize(
            keyword
          )
        )
      ) {
        continue;
      }

      const response =
        keywords[keyword];

      if (!response) {
        continue;
      }

      const resolved =
        this.resolveResponse(
          response,
          false,
          false
        );

      if (resolved) {
        candidates.push({
          text: resolved,
          source: 'intent',
          score: 55,
        });

        break;
      }
    }
  }

  private static filterCandidates(
    candidates: ResponseCandidate[],
    content: string
  ): ResponseCandidate[] {
    const analysis =
      TextAnalyzer.analyze(content);

    return candidates.filter(
      candidate =>
        ResponseValidator.isResponseAppropriate(
          candidate.text,
          analysis.isAggressive,
          analysis.isCompliment
        )
    );
  }

  private static resolveResponse(
    response:
      | string
      | string[],
    isAggressive: boolean,
    isCompliment: boolean
  ): string | null {
    if (Array.isArray(response)) {
      const valid =
        ResponseValidator
          .filterAppropriateResponses(
            response,
            isAggressive,
            isCompliment
          );

      return valid.length > 0
        ? this.randomItem(valid)
        : null;
    }

    return ResponseValidator
      .isResponseAppropriate(
        response,
        isAggressive,
        isCompliment
      )
      ? response
      : null;
  }

  private static randomItem<T>(
    items: T[]
  ): T {
    return items[
      Math.floor(
        Math.random() * items.length
      )
    ];
  }
}