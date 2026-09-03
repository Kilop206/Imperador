import { config } from '../config/config';
import { PersonalityEngine } from './personalityEngine';
import type { EmotionState } from '../types/emotion';
import type { MessageIntent } from '../services/textAnalyzer';
import { ResponseValidator } from '../services/responseValidator';
import { GeneratedResponseFeedbackService } from './generatedResponseFeedbackService';

export interface ResponseGenerationContext {
  content: string;
  intent: MessageIntent;
  emotion: EmotionState;
  relevantMemory?: string | null;
  semanticContext?: string | null;
}

export interface GeneratedResponse {
  text: string;
  confidence: number;
  novelty: number;
  relevance: number;
  contextRelevance: number;
  intentAlignment: number;
  feedbackId?: string;
}

export interface ResponseGenerationContextProfile {
  inputTokens: string[];
  memoryTokens: string[];
  semanticTokens: string[];
  priorityTokens: Set<string>;
  styleTokens: Set<string>;
}

type Token = string;
type TransitionMap = Map<Token, Map<Token, number>>;

const START = '<START>';
const END = '<END>';
const MAX_GENERATION_ATTEMPTS = 64;
const MIN_TOKENS = 5;
const MAX_TOKENS = 32;
const CONTEXT_TOKEN_MULTIPLIER = 2.2;
const STYLE_TOKEN_MULTIPLIER = 1.35;
const REPEAT_TOKEN_PENALTY = 0.18;

const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
  'nos', 'nas', 'por', 'para', 'com', 'sem', 'e', 'ou',
  'que', 'se', 'eu', 'voce', 'vc', 'isso', 'isto',
  'aquilo', 'ele', 'ela', 'eles', 'elas', 'me', 'te', 'lhe',
  'ja', 'nao', 'sim', 'como', 'mais', 'muito',
]);

const INTENT_SEEDS: Partial<Record<MessageIntent, string[]>> = {
  greeting: ['voce', 'imperador', 'roma'],
  farewell: ['imperio', 'roma', 'voce'],
  aggressive: ['voce', 'nao', 'interessante'],
  compliment: ['finalmente', 'voce', 'bom'],
  humor: ['interessante', 'roma', 'diversao'],
  serious: ['ha', 'imperio', 'roma'],
  nostalgic: ['passado', 'memorias', 'historia'],
  philosophical: ['existencia', 'verdade', 'poder'],
  roman: ['roma', 'imperio', 'senado'],
  question: ['voce', 'tiberio', 'imperador'],
  neutral: ['voce', 'imperio', 'roma'],
};

const EMOTION_STYLE_TOKENS: Array<{
  source: keyof EmotionState;
  threshold: number;
  tokens: string[];
}> = [
  {
    source: 'hostility',
    threshold: 55,
    tokens: ['nao', 'poder', 'ordem', 'inferior', 'insolente'],
  },
  {
    source: 'amusement',
    threshold: 55,
    tokens: ['hahaha', 'interessante', 'diversao', 'ridiculo', 'curioso'],
  },
  {
    source: 'nostalgia',
    threshold: 55,
    tokens: ['passado', 'memorias', 'roma', 'historia', 'outrora'],
  },
  {
    source: 'curiosity',
    threshold: 55,
    tokens: ['curioso', 'interessante', 'verdade', 'descobrir', 'explicar'],
  },
  {
    source: 'respect',
    threshold: 70,
    tokens: ['respeito', 'imperio', 'honra', 'digno', 'grande'],
  },
];

export class ResponseGenerationEngine {
  private readonly transitions: TransitionMap = new Map();
  private readonly trainingSentences: string[] = [];
  private readonly vocabulary = new Set<string>();
  private initialized = false;

  public initialize(): void {
    if (this.initialized) {
      return;
    }

    for (const sentence of this.collectTrainingSentences()) {
      this.trainSentence(sentence);
    }

    this.initialized = true;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public getTrainingSentenceCount(): number {
    return this.trainingSentences.length;
  }

  public getVocabularySize(): number {
    return this.vocabulary.size;
  }

  /**
   * Adiciona uma resposta aprovada ao corpus de aprendizado incremental.
   * A chamada é idempotente por texto normalizado.
   */
  public learnApprovedResponse(text: string): boolean {
    this.initialize();

    const normalized = text.trim();

    if (!normalized || !this.isUsable(normalized)) {
      return false;
    }

    if (this.trainingSentences.some(
      sentence => this.normalize(sentence) === this.normalize(normalized),
    )) {
      return false;
    }

    this.trainSentence(normalized);
    return true;
  }

  public inspectContext(
    context: ResponseGenerationContext,
  ): ResponseGenerationContextProfile {
    this.initialize();

    return this.buildContextProfile(context);
  }

  public generate(
    context: ResponseGenerationContext,
  ): GeneratedResponse | null {
    this.initialize();

    const profile = this.buildContextProfile(context);
    const seed = this.chooseSeed(profile, context.intent);
    const generated: string[] = [];

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = this.generateSentence(seed, profile);

      if (!candidate || generated.includes(candidate)) {
        continue;
      }

      if (!this.isUsable(candidate)) {
        continue;
      }

      if (this.isExactTrainingSentence(candidate)) {
        continue;
      }

      if (!ResponseValidator.isResponseAppropriate(
        candidate,
        context.intent === 'aggressive',
        context.intent === 'compliment',
      )) {
        continue;
      }

      if (!PersonalityEngine.isConsistent(candidate)) {
        continue;
      }

      generated.push(candidate);
    }

    if (generated.length === 0) {
      return null;
    }

    const scored = generated
      .map(text => this.score(text, context, profile))
      .sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];

    if (!best || best.confidence < 0.45) {
      return null;
    }

    const feedbackId =
      GeneratedResponseFeedbackService.register({
        content: context.content,
        intent: context.intent,
        emotion: context.emotion,
        relevantMemory: context.relevantMemory,
        semanticContext: context.semanticContext,
        generated: best,
      });

    return {
      ...best,
      feedbackId,
    };
  }

  private buildContextProfile(
    context: ResponseGenerationContext,
  ): ResponseGenerationContextProfile {
    const inputTokens = this.meaningfulTokens(
      this.normalize(context.content),
    );

    const memoryTokens = context.relevantMemory
      ? this.meaningfulTokens(this.normalize(context.relevantMemory))
      : [];

    const semanticTokens = context.semanticContext
      ? this.meaningfulTokens(this.normalize(context.semanticContext))
      : [];

    const priorityTokens = new Set<string>();

    for (const token of inputTokens) {
      if (this.vocabulary.has(token)) {
        priorityTokens.add(token);
      }
    }

    for (const token of memoryTokens) {
      if (this.vocabulary.has(token)) {
        priorityTokens.add(token);
      }
    }

    for (const token of semanticTokens) {
      if (this.vocabulary.has(token)) {
        priorityTokens.add(token);
      }
    }

    const styleTokens = new Set<string>();

    for (const token of INTENT_SEEDS[context.intent] ?? []) {
      const normalized = this.normalize(token);

      if (this.vocabulary.has(normalized)) {
        styleTokens.add(normalized);
      }
    }

    for (const group of EMOTION_STYLE_TOKENS) {
      const value = Math.max(
        0,
        Math.min(100, context.emotion[group.source]),
      );

      if (value < group.threshold) {
        continue;
      }

      for (const token of group.tokens) {
        const normalized = this.normalize(token);

        if (this.vocabulary.has(normalized)) {
          styleTokens.add(normalized);
        }
      }
    }

    return {
      inputTokens,
      memoryTokens,
      semanticTokens,
      priorityTokens,
      styleTokens,
    };
  }

  private collectTrainingSentences(): string[] {
    const result: string[] = [];

    const add = (value: string | string[]): void => {
      const values = Array.isArray(value) ? value : [value];

      for (const text of values) {
        const normalized = text.trim();

        if (normalized && !result.includes(normalized)) {
          result.push(normalized);
        }
      }
    };

    for (const responses of Object.values(config.tiberiusResponses.spontaneous)) {
      add(responses);
    }

    for (const responses of Object.values(config.tiberiusResponses.keywords)) {
      add(responses);
    }

    for (const responses of Object.values(config.tiberiusResponses.context)) {
      add(responses);
    }

    for (const frequency of Object.values(config.tiberiusResponses.frequency)) {
      for (const responses of Object.values(frequency)) {
        add(responses);
      }
    }

    add(config.tiberiusResponses.rarity.very_rare);

    for (const responses of Object.values(config.tiberiusResponses.modes)) {
      if (responses) {
        add(responses);
      }
    }

    add(config.tiberiusResponses.compliments);

    return result;
  }

  private trainSentence(sentence: string): void {
    const tokens = this.tokenize(sentence);

    if (tokens.length < 2) {
      return;
    }

    this.trainingSentences.push(sentence);

    const sequence = [START, ...tokens, END];

    for (let index = 0; index < sequence.length - 1; index += 1) {
      const current = sequence[index];
      const next = sequence[index + 1];
      let nextMap = this.transitions.get(current);

      this.vocabulary.add(next);

      if (!nextMap) {
        nextMap = new Map();
        this.transitions.set(current, nextMap);
      }

      nextMap.set(next, (nextMap.get(next) ?? 0) + 1);
    }

    for (const token of tokens) {
      this.vocabulary.add(token);
    }
  }

  private generateSentence(
    seed: string | null,
    profile: ResponseGenerationContextProfile,
  ): string | null {
    let current = START;
    const tokens: string[] = [];

    if (seed && this.transitions.has(seed)) {
      tokens.push(seed);
      current = seed;
    }

    while (tokens.length < MAX_TOKENS) {
      const next = this.sampleNext(
        current,
        profile,
        tokens,
      );

      if (!next || next === END) {
        break;
      }

      tokens.push(next);
      current = next;

      if (/[.!?]$/.test(next) && tokens.length >= MIN_TOKENS) {
        break;
      }
    }

    if (tokens.length < MIN_TOKENS) {
      return null;
    }

    return this.detokenize(tokens);
  }

  private sampleNext(
    current: string,
    profile: ResponseGenerationContextProfile,
    existingTokens: string[],
  ): string | null {
    const nextMap = this.transitions.get(current);

    if (!nextMap || nextMap.size === 0) {
      return null;
    }

    const existingTokenCounts = new Map<string, number>();

    for (const token of existingTokens) {
      existingTokenCounts.set(
        token,
        (existingTokenCounts.get(token) ?? 0) + 1,
      );
    }

    const weightedCandidates: Array<{
      token: string;
      weight: number;
    }> = [];

    let total = 0;

    for (const [token, count] of nextMap.entries()) {
      let weight = count;

      if (profile.priorityTokens.has(token)) {
        weight *= CONTEXT_TOKEN_MULTIPLIER;
      }

      if (profile.styleTokens.has(token)) {
        weight *= STYLE_TOKEN_MULTIPLIER;
      }

      const repetitions = existingTokenCounts.get(token) ?? 0;

      if (repetitions > 0) {
        weight *= Math.pow(REPEAT_TOKEN_PENALTY, repetitions);
      }

      if (weight <= 0) {
        continue;
      }

      weightedCandidates.push({ token, weight });
      total += weight;
    }

    if (weightedCandidates.length === 0 || total <= 0) {
      return null;
    }

    let target = Math.random() * total;

    for (const candidate of weightedCandidates) {
      target -= candidate.weight;

      if (target <= 0) {
        return candidate.token;
      }
    }

    return weightedCandidates[weightedCandidates.length - 1]?.token ?? null;
  }

  private chooseSeed(
    profile: ResponseGenerationContextProfile,
    intent: MessageIntent,
  ): string | null {
    const ranked: Array<{ token: string; weight: number }> = [];

    for (const token of profile.inputTokens) {
      if (this.vocabulary.has(token) && !STOP_WORDS.has(token)) {
        ranked.push({ token, weight: 4 });
      }
    }

    for (const token of profile.memoryTokens) {
      if (this.vocabulary.has(token) && !STOP_WORDS.has(token)) {
        ranked.push({ token, weight: 3 });
      }
    }

    for (const token of profile.semanticTokens) {
      if (this.vocabulary.has(token) && !STOP_WORDS.has(token)) {
        ranked.push({ token, weight: 2.5 });
      }
    }

    const intentSeeds = INTENT_SEEDS[intent] ?? [];

    for (const seed of intentSeeds) {
      const normalized = this.normalize(seed);

      if (this.vocabulary.has(normalized) && !STOP_WORDS.has(normalized)) {
        ranked.push({ token: normalized, weight: 2 });
      }
    }

    if (ranked.length === 0) {
      return null;
    }

    const deduplicated = new Map<string, number>();

    for (const candidate of ranked) {
      deduplicated.set(
        candidate.token,
        Math.max(
          deduplicated.get(candidate.token) ?? 0,
          candidate.weight,
        ),
      );
    }

    let total = 0;

    for (const weight of deduplicated.values()) {
      total += weight;
    }

    let target = Math.random() * total;

    for (const [token, weight] of deduplicated.entries()) {
      target -= weight;

      if (target <= 0) {
        return token;
      }
    }

    return deduplicated.keys().next().value ?? null;
  }

  private score(
    text: string,
    context: ResponseGenerationContext,
    profile: ResponseGenerationContextProfile,
  ): GeneratedResponse {
    const normalizedText = this.normalize(text);
    const outputTokens = new Set(
      this.meaningfulTokens(normalizedText),
    );

    const inputTokens = new Set(profile.inputTokens);

    let inputOverlap = 0;

    for (const token of inputTokens) {
      if (outputTokens.has(token)) {
        inputOverlap += 1;
      }
    }

    const relevance = inputTokens.size === 0
      ? 0.45
      : Math.min(
          1,
          inputOverlap / Math.max(1, Math.min(inputTokens.size, 4)),
        );

    const contextTokens = new Set([
      ...profile.memoryTokens,
      ...profile.semanticTokens,
    ]);

    let contextOverlap = 0;

    for (const token of contextTokens) {
      if (outputTokens.has(token)) {
        contextOverlap += 1;
      }
    }

    const contextRelevance = contextTokens.size === 0
      ? 0
      : Math.min(
          1,
          contextOverlap / Math.max(1, Math.min(contextTokens.size, 4)),
        );

    const intentAlignment = this.calculateIntentAlignment(
      outputTokens,
      context.intent,
    );

    const novelty = this.calculateNovelty(normalizedText);
    const memoryBoost = context.relevantMemory ? 0.04 : 0;
    const semanticBoost = context.semanticContext ? 0.04 : 0;
    const emotionBoost = this.calculateEmotionBoost(context.emotion);
    const intentBoost = this.calculateIntentBoost(context.intent);

    const confidence = Math.max(
      0,
      Math.min(
        1,
        0.39 +
          relevance * 0.17 +
          contextRelevance * 0.14 +
          intentAlignment * 0.08 +
          novelty * 0.14 +
          memoryBoost +
          semanticBoost +
          emotionBoost +
          intentBoost,
      ),
    );

    return {
      text,
      confidence,
      novelty,
      relevance,
      contextRelevance,
      intentAlignment,
    };
  }

  private calculateIntentAlignment(
    outputTokens: Set<string>,
    intent: MessageIntent,
  ): number {
    const seeds = (INTENT_SEEDS[intent] ?? [])
      .map(seed => this.normalize(seed))
      .filter(seed => this.vocabulary.has(seed));

    if (seeds.length === 0) {
      return 0;
    }

    let matches = 0;

    for (const seed of seeds) {
      if (outputTokens.has(seed)) {
        matches += 1;
      }
    }

    return Math.min(1, matches / Math.min(2, seeds.length));
  }

  private calculateNovelty(normalizedText: string): number {
    let maximumSimilarity = 0;

    for (const sentence of this.trainingSentences) {
      const similarity = this.tokenJaccard(
        this.meaningfulTokens(normalizedText),
        this.meaningfulTokens(this.normalize(sentence)),
      );

      if (similarity > maximumSimilarity) {
        maximumSimilarity = similarity;
      }

      if (maximumSimilarity >= 0.98) {
        break;
      }
    }

    return 1 - maximumSimilarity;
  }

  private calculateEmotionBoost(emotion: EmotionState): number {
    const curiosity = Math.max(0, Math.min(100, emotion.curiosity));
    const amusement = Math.max(0, Math.min(100, emotion.amusement));
    const hostility = Math.max(0, Math.min(100, emotion.hostility));

    return Math.min(
      0.06,
      curiosity / 1300 + amusement / 2500 + hostility / 3200,
    );
  }

  private calculateIntentBoost(intent: MessageIntent): number {
    switch (intent) {
      case 'question':
      case 'greeting':
      case 'farewell':
      case 'humor':
      case 'serious':
      case 'nostalgic':
      case 'philosophical':
      case 'roman':
        return 0.04;
      default:
        return 0.02;
    }
  }

  private isExactTrainingSentence(text: string): boolean {
    const normalized = this.normalize(text);

    return this.trainingSentences.some(
      sentence => this.normalize(sentence) === normalized,
    );
  }

  private tokenJaccard(first: string[], second: string[]): number {
    const a = new Set(first);
    const b = new Set(second);

    if (a.size === 0 && b.size === 0) {
      return 1;
    }

    if (a.size === 0 || b.size === 0) {
      return 0;
    }

    let intersection = 0;

    for (const token of a) {
      if (b.has(token)) {
        intersection += 1;
      }
    }

    const union = new Set([...a, ...b]).size;

    return union === 0 ? 0 : intersection / union;
  }

  private meaningfulTokens(text: string): string[] {
    return this.tokenize(text).filter(token =>
      token.length >= 3 &&
      !STOP_WORDS.has(token) &&
      !/^[.!,?;:]+$/.test(token),
    );
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/([^\p{L}\p{N}])+/gu, ' $1 ')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
  }

  private detokenize(tokens: string[]): string {
    return tokens
      .join(' ')
      .replace(/\s+([,.!?;:])/g, '$1')
      .replace(/([([{])\s+/g, '$1')
      .replace(/\s+([)\]}])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  private normalize(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private isUsable(text: string): boolean {
    const trimmed = text.trim();

    if (trimmed.length < 12 || trimmed.length > 240) {
      return false;
    }

    if (!/[a-záàâãéêíóôõúç]/i.test(trimmed)) {
      return false;
    }

    const words = trimmed.split(/\s+/).filter(Boolean);

    return words.length >= MIN_TOKENS && words.length <= MAX_TOKENS;
  }
}
