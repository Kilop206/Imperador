export type EmotionName =
  | 'irritation'
  | 'respect'
  | 'trust'
  | 'nostalgia'
  | 'curiosity'
  | 'hostility'
  | 'amusement';

export interface EmotionState {
  irritation: number;
  respect:    number;
  trust:      number;
  nostalgia:  number;
  curiosity:  number;
  hostility:  number;
  amusement:  number;
}

/**
 * Resting baseline each emotion decays toward.
 * Not zero: Tibério starts with baseline authority/respect.
 */
export const EMOTION_BASELINE: Readonly<EmotionState> = {
  irritation: 10,
  respect:    50,
  trust:      40,
  nostalgia:  20,
  curiosity:  30,
  hostility:   5,
  amusement:  20,
};

export const EMOTION_MIN = 0;
export const EMOTION_MAX = 100;

/**
 * Steps per decay tick (toward baseline).
 * Higher = faster convergence.
 */
export const EMOTION_DECAY_RATE = 2;
