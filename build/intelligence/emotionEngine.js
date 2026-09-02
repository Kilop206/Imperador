"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmotionEngine = void 0;
const emotion_1 = require("../types/emotion");
const emotionState_1 = require("../state/emotionState");
const INTERACTION_DELTAS = {
    compliment: {
        respect: 2,
        trust: 1,
        hostility: -1,
        irritation: -1,
    },
    insult: {
        irritation: 3,
        hostility: 3,
        trust: -2,
        respect: -1,
    },
    question: {
        curiosity: 2,
        trust: 1,
    },
    humor: {
        amusement: 3,
        irritation: -1,
    },
    nostalgic: {
        nostalgia: 3,
        trust: 1,
    },
    philosophical: {
        curiosity: 2,
        nostalgia: 1,
    },
    roman: {
        respect: 1,
        curiosity: 1,
    },
    serious: {
        irritation: 1,
        amusement: -1,
    },
    greeting: {
        trust: 1,
    },
    farewell: {
        nostalgia: 1,
    },
};
class EmotionEngine {
    /**
     * Update emotions based on a fully analyzed message.
     * Maps AnalyzedMessage.intent to the deltas table.
     */
    static processMessage(analysis) {
        // Explicit aggressive check takes priority over intent mapping
        if (analysis.isAggressive) {
            this.applyDeltas(INTERACTION_DELTAS['insult']);
            return;
        }
        if (analysis.isCompliment) {
            this.applyDeltas(INTERACTION_DELTAS['compliment']);
            return;
        }
        const deltas = INTERACTION_DELTAS[analysis.intent];
        if (deltas) {
            this.applyDeltas(deltas);
        }
    }
    /**
     * Apply a map of emotion deltas to the live state.
     */
    static applyDeltas(deltas) {
        for (const [name, delta] of Object.entries(deltas)) {
            (0, emotionState_1.modifyEmotion)(name, delta);
        }
    }
    /**
     * Decay all emotions one step toward their baselines.
     * Call this on a timer (e.g., every 5–10 minutes).
     */
    static decay() {
        for (const key of Object.keys(emotionState_1.emotionState)) {
            const baseline = emotion_1.EMOTION_BASELINE[key];
            const current = emotionState_1.emotionState[key];
            const diff = baseline - current;
            if (diff === 0) {
                continue;
            }
            // Move toward baseline by DECAY_RATE, never overshoot
            const step = Math.min(Math.abs(diff), emotion_1.EMOTION_DECAY_RATE);
            emotionState_1.emotionState[key] = (0, emotionState_1.clamp)(current + (diff > 0 ? step : -step));
        }
    }
    /**
     * Run N decay ticks at once (useful for time-based simulation in tests).
     */
    static decayTicks(ticks) {
        for (let i = 0; i < ticks; i++) {
            this.decay();
        }
    }
    /**
     * Return a read-only snapshot of the current emotion state.
     */
    static getState() {
        return (0, emotionState_1.snapshotEmotions)();
    }
    /**
     * Human-readable mood summary for logging / prompts.
     */
    static describeMood() {
        const s = emotionState_1.emotionState;
        const parts = [];
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
exports.EmotionEngine = EmotionEngine;
