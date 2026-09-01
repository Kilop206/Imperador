export interface SpeechStyle {
  /** 0 = terse/minimal  |  100 = verbose/elaborate */
  verbosity:  number;
  /** 0 = casual  |  100 = highly formal */
  formality:  number;
  /** 0 = indirect/diplomatic  |  100 = brutally direct */
  directness: number;
}

export interface PersonalityProfile {
  /** How much Tibério asserts authority and dominance (0-100) */
  authority:  number;
  /** How dismissive / condescending he is (0-100) */
  arrogance:  number;
  /** His dry/sarcastic humour capacity (0-100) */
  humor:      number;
  /** Interest in ideas and questions (0-100) */
  curiosity:  number;
  /** Low empathy = colder, dismissive; high = slightly warmer (0-100) */
  empathy:    number;

  /** Core values that define the character -- used for validation */
  values:      readonly string[];
  /** Topics / things he appreciates */
  preferences: readonly string[];
  /** Topics / behaviours that break character */
  taboos:      readonly string[];

  speechStyle: SpeechStyle;
}

/**
 * A word/phrase that is INCOMPATIBLE with Tibério's personality.
 * Responses containing these should be filtered or penalised.
 */
export interface PersonalityViolation {
  pattern: string;
  reason:  string;
}
