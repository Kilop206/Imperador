import {
  PERSONALITY_VIOLATIONS,
  TIBERIUS_PERSONALITY,
} from '../config/personality';
import { EmotionState } from '../types/emotion';
import { PersonalityProfile } from '../types/personality';
import { TextAnalyzer } from '../services/textAnalyzer';

export interface PersonalityScoreModifiers {
  /**
   * Added to the raw score of any 'aggressive' candidate when hostility is high.
   * Positive = Tibério leans into the conflict more readily.
   */
  aggressiveBoost:    number;
  /**
   * Added to the raw score of any 'compliment' candidate when respect is high.
   * Negative = he deflects compliments more when he is irritated.
   */
  complimentModifier: number;
  /**
   * Added to the raw score of any 'mode' candidate for nostalgic/philosophical modes.
   * Positive = he is more reflective when those emotions are elevated.
   */
  reflectiveBoost:    number;
  /**
   * Added to any 'keyword'/'intent' candidate when curiosity is high.
   */
  curiosityBoost:     number;
}

export class PersonalityEngine {
  /**
   * Check whether a response text violates Tibério's personality.
   * Returns null if clean, or the first violation found.
   */
  static checkViolation(
    responseText: string
  ): string | null {
    const normalized =
      TextAnalyzer.normalize(responseText);

    for (const violation of PERSONALITY_VIOLATIONS) {
      const normalizedPattern =
        TextAnalyzer.normalize(violation.pattern);

      if (normalized.includes(normalizedPattern)) {
        return violation.reason;
      }
    }

    return null;
  }

  /**
   * Returns true when the response is personality-consistent.
   */
  static isConsistent(
    responseText: string
  ): boolean {
    return this.checkViolation(responseText) === null;
  }

  /**
   * Filter a list of response strings to those that pass personality validation.
   */
  static filterConsistent(
    responses: string[]
  ): string[] {
    return responses.filter(
      response => this.isConsistent(response)
    );
  }

  /**
   * Derive score modifiers based on the current emotion state.
   * These are added on top of the ResponseEngine's base scores.
   *
   * Design principle: emotions shift EMPHASIS, not identity.
   * The modifiers are bounded to avoid dominating the base score hierarchy.
   */
  static getScoreModifiers(
    emotion: EmotionState
  ): PersonalityScoreModifiers {
    // hostility drives more aggressive responses (max +15)
    const aggressiveBoost = Math.round(
      ((emotion.hostility - 5) / 95) * 15
    );

    // when irritated, compliments land worse (range: -8 to +5)
    // when trust is high, Tibério tolerates them a bit more
    const complimentModifier = Math.round(
      ((emotion.trust - 40) / 60) * 5 -
      ((emotion.irritation - 10) / 90) * 8
    );

    // nostalgia + curiosity unlock more reflective/philosophical responses
    const reflectiveBoost = Math.round(
      ((emotion.nostalgia - 20) / 80) * 8 +
      ((emotion.curiosity - 30) / 70) * 5
    );

    // high curiosity favours keyword/intent hits
    const curiosityBoost = Math.round(
      ((emotion.curiosity - 30) / 70) * 7
    );

    return {
      aggressiveBoost:    Math.max(-5,  Math.min(15, aggressiveBoost)),
      complimentModifier: Math.max(-8,  Math.min(5,  complimentModifier)),
      reflectiveBoost:    Math.max(-3,  Math.min(13, reflectiveBoost)),
      curiosityBoost:     Math.max(0,   Math.min(7,  curiosityBoost)),
    };
  }

  /**
   * Return a plain-text description of the current personality profile
   * suitable for use in an AI prompt context.
   */
  static describeProfile(
    profile: PersonalityProfile = TIBERIUS_PERSONALITY
  ): string {
    const lines: string[] = [
      `Autoridade: ${profile.authority}/100`,
      `Arrogância: ${profile.arrogance}/100`,
      `Humor: ${profile.humor}/100`,
      `Curiosidade: ${profile.curiosity}/100`,
      `Empatia: ${profile.empathy}/100`,
      `Estilo: verbosidade=${profile.speechStyle.verbosity}, formalidade=${profile.speechStyle.formality}, diretividade=${profile.speechStyle.directness}`,
      `Valores: ${profile.values.join(', ')}`,
      `Preferências: ${profile.preferences.join(', ')}`,
      `Tabus: ${profile.taboos.join(', ')}`,
    ];

    return lines.join('\n');
  }

  /**
   * Return the immutable canonical profile for Tibério.
   */
  static getProfile(): Readonly<PersonalityProfile> {
    return TIBERIUS_PERSONALITY;
  }
}
