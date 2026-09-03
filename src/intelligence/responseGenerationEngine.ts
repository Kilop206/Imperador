import { config } from '../config/config';
import { PersonalityEngine } from './personalityEngine';
import type { EmotionState } from '../types/emotion';
import type { MessageIntent } from '../services/textAnalyzer';
import { ResponseValidator } from '../services/responseValidator';

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
}

type Token = string;
type TransitionMap = Map<Token, Map<Token, number>>;

const START = '<START>';
const END = '<END>';
const MAX_GENERATION_ATTEMPTS = 64;
const MIN_TOKENS = 5;
const MAX_TOKENS = 32;

const STOP_WORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'uns', 'umas',
  'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na',
  'nos', 'nas', 'por', 'para', 'com', 'sem', 'e', 'ou',
  'que', 'se', 'eu', 'você', 'vc', 'isso', 'isto',
  'aquilo', 'ele', 'ela', 'eles', 'elas', 'me', 'te', 'lhe',
  'já', 'não', 'sim', 'como', 'mais', 'muito',
]);

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

  public generate(
    context: ResponseGenerationContext,
  ): GeneratedResponse | null {
    this.initialize();

    const normalizedInput = this.normalize(context.content);
    const inputTokens = this.meaningfulTokens(normalizedInput);
    const seed = this.chooseSeed(inputTokens, context.intent);
    const generated: string[] = [];

    for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
      const candidate = this.generateSentence(seed);

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
      .map(text => this.score(text, context))
      .sort((a, b) => b.confidence - a.confidence);

    const best = scored[0];

    if (!best || best.confidence < 0.45) {
      return null;
    }

    return best;
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

  private generateSentence(seed: string | null): string | null {
    let current = START;
    const tokens: string[] = [];

    if (seed && this.transitions.has(seed)) {
      tokens.push(seed);
      current = seed;
    }

    while (tokens.length < MAX_TOKENS) {
      const next = this.sampleNext(current);

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

  private sampleNext(current: string): string | null {
    const nextMap = this.transitions.get(current);

    if (!nextMap || nextMap.size === 0) {
      return null;
    }

    let total = 0;

    for (const count of nextMap.values()) {
      total += count;
    }

    let target = Math.random() * total;

    for (const [token, count] of nextMap.entries()) {
      target -= count;

      if (target <= 0) {
        return token;
      }
    }

    return nextMap.keys().next().value ?? null;
  }

  private chooseSeed(
    inputTokens: string[],
    intent: MessageIntent,
  ): string | null {
    const candidates = inputTokens
      .filter(token => this.vocabulary.has(token))
      .filter(token => !STOP_WORDS.has(token));

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }

    const intentSeeds: Partial<Record<MessageIntent, string[]>> = {
      greeting: ['você', 'imperador', 'roma'],
      farewell: ['império', 'roma', 'você'],
      aggressive: ['você', 'não', 'interessante'],
      compliment: ['finalmente', 'você', 'bom'],
      humor: ['interessante', 'roma', 'diversão'],
      serious: ['há', 'império', 'roma'],
      nostalgic: ['passado', 'memórias', 'história'],
      philosophical: ['existência', 'verdade', 'poder'],
      roman: ['roma', 'império', 'senado'],
      question: ['você', 'tibério', 'imperador'],
      neutral: ['você', 'império', 'roma'],
    };

    const seeds = (intentSeeds[intent] ?? [])
      .filter(seed => this.vocabulary.has(seed));

    if (seeds.length === 0) {
      return null;
    }

    return seeds[Math.floor(Math.random() * seeds.length)];
  }

  private score(
    text: string,
    context: ResponseGenerationContext,
  ): GeneratedResponse {
    const normalizedText = this.normalize(text);
    const inputTokens = new Set(
      this.meaningfulTokens(this.normalize(context.content)),
    );
    const outputTokens = new Set(
      this.meaningfulTokens(normalizedText),
    );

    let overlap = 0;

    for (const token of inputTokens) {
      if (outputTokens.has(token)) {
        overlap += 1;
      }
    }

    const relevance = inputTokens.size === 0
      ? 0.45
      : Math.min(1, overlap / Math.max(1, Math.min(inputTokens.size, 4)));

    const novelty = this.calculateNovelty(normalizedText);
    const memoryBoost = context.relevantMemory ? 0.08 : 0;
    const semanticBoost = context.semanticContext ? 0.08 : 0;
    const emotionBoost = this.calculateEmotionBoost(context.emotion);

    const confidence = Math.max(
      0,
      Math.min(
        1,
        0.42 +
          relevance * 0.22 +
          novelty * 0.18 +
          memoryBoost +
          semanticBoost +
          emotionBoost,
      ),
    );

    return {
      text,
      confidence,
      novelty,
      relevance,
    };
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
      0.08,
      curiosity / 1000 + amusement / 2000 + hostility / 2500,
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
        return 0.05;
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
