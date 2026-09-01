import {
  EMOTION_BASELINE,
  EMOTION_MAX,
  EMOTION_MIN,
  EmotionName,
  EmotionState,
} from '../types/emotion';

/**
 * Live mutable emotion state.
 * All mutations must go through the helpers below to enforce clamping.
 */
export const emotionState: EmotionState = {
  ...EMOTION_BASELINE,
};

export function clamp(
  value: number,
  min = EMOTION_MIN,
  max = EMOTION_MAX
): number {
  return Math.max(min, Math.min(max, value));
}

export function modifyEmotion(
  name: EmotionName,
  delta: number
): void {
  emotionState[name] = clamp(
    emotionState[name] + delta
  );
}

export function setEmotion(
  name: EmotionName,
  value: number
): void {
  emotionState[name] = clamp(value);
}

/** Deep copy for persistence / display. */
export function snapshotEmotions(): EmotionState {
  return { ...emotionState };
}

/**
 * Restore from a persisted snapshot.
 * Extra or unknown keys are ignored; missing keys keep baseline.
 */
export function restoreEmotions(
  snapshot: Partial<EmotionState>
): void {
  for (const key of Object.keys(
    emotionState
  ) as EmotionName[]) {
    const stored = snapshot[key];

    if (typeof stored === 'number') {
      emotionState[key] = clamp(stored);
    }
  }
}

export function resetEmotions(): void {
  for (const key of Object.keys(
    emotionState
  ) as EmotionName[]) {
    emotionState[key] = EMOTION_BASELINE[key];
  }
}
