import { AnalyzedMessage } from '../services/textAnalyzer';
import {
  EMOTION_BASELINE,
  EMOTION_DECAY_RATE,
  EmotionName,
  EmotionState,
} from '../types/emotion';
import {
  clamp,
  emotionState,
  modifyEmotion,
  snapshotEmotions,
} from '../state/emotionState';

/**
 * Delta applied to each emotion per interaction type.
 * Only non-zero entries need to appear.
 */
interface EmotionDeltas {
  readonly [key: string]: Partial<Record<EmotionName, number>>;
}

const INTERACTION_DELTAS: EmotionDeltas = {
  compliment: {
    respect:    2,
    trust:      1,
    hostility: -1,
    irritation: -1,
  },
  insult: {
    irritation:  3,
    hostility:   3,
    trust:      -2,
    respect:    -1,
  },
  question: {
    curiosity:  2,
    trust:      1,
  },
  humor: {
    amusement:  3,
    irritation: -1,
  },
  nostalgic: {
    nostalgia:  3,
    trust:      1,
  },
  philosophical: {
    curiosity:  2,
    nostalgia:  1,
  },
  roman: {
    respect:    1,
    curiosity:  1,
  },
  serious: {
    irritation: 1,
    amusement: -1,
  },
  greeting: {
    trust:      1,
  },
  farewell: {
    nostalgia:  1,
  },
};

export class EmotionEngine {
  /**
   * Update emotions based on a fully analyzed message.
   * Maps AnalyzedMessage.intent to the deltas table.
   */
  static processMessage(
    analysis: AnalyzedMessage
  ): void {
    // Explicit aggressive check takes priority over intent mapping
    if (analysis.isAggressive) {
      this.applyDeltas(
        INTERACTION_DELTAS['insult']
      );
      return;
    }

    if (analysis.isCompliment) {
      this.applyDeltas(
        INTERACTION_DELTAS['compliment']
      );
      return;
    }

    const deltas =
      INTERACTION_DELTAS[analysis.intent];

    if (deltas) {
      this.applyDeltas(deltas);
    }
  }

  /**
   * Apply a map of emotion deltas to the live state.
   */
  static applyDeltas(
    deltas: Partial<Record<EmotionName, number>>
  ): void {
    for (const [name, delta] of Object.entries(
      deltas
    ) as [EmotionName, number][]) {
      modifyEmotion(name, delta);
    }
  }

  /**
   * Decay all emotions one step toward their baselines.
   * Call this on a timer (e.g., every 5–10 minutes).
   */
  static decay(): void {
    for (const key of Object.keys(
      emotionState
    ) as EmotionName[]) {
      const baseline = EMOTION_BASELINE[key];
      const current  = emotionState[key];
      const diff     = baseline - current;

      if (diff === 0) {
        continue;
      }

      // Move toward baseline by DECAY_RATE, never overshoot
      const step = Math.min(
        Math.abs(diff),
        EMOTION_DECAY_RATE
      );

      emotionState[key] = clamp(
        current + (diff > 0 ? step : -step)
      );
    }
  }

  /**
   * Run N decay ticks at once (useful for time-based simulation in tests).
   */
  static decayTicks(ticks: number): void {
    for (let i = 0; i < ticks; i++) {
      this.decay();
    }
  }

  /**
   * Return a read-only snapshot of the current emotion state.
   */
  static getState(): EmotionState {
    return snapshotEmotions();
  }

  /**
   * Human-readable mood summary for logging / prompts.
   */
  static describeMood(): string {
    const s = emotionState;

    const parts: string[] = [];

    if (s.irritation > 60) {
      parts.push('irritado');
    }

    if (s.hostility > 50) {
      parts.push('hostil');
    }

    if (s.respect > 70) {
      parts.push('respeitoso');
    }

    if (s.nostalgia > 60) {
      parts.push('nostálgico');
    }

    if (s.curiosity > 60) {
      parts.push('curioso');
    }

    if (s.amusement > 60) {
      parts.push('divertido');
    }

    if (s.trust > 70) {
      parts.push('confiante');
    }

    return parts.length > 0
      ? parts.join(', ')
      : 'neutro';
  }
}
