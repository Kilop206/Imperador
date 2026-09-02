"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMOTION_DECAY_RATE = exports.EMOTION_MAX = exports.EMOTION_MIN = exports.EMOTION_BASELINE = void 0;
/**
 * Resting baseline each emotion decays toward.
 * Not zero: Tibério starts with baseline authority/respect.
 */
exports.EMOTION_BASELINE = {
    irritation: 10,
    respect: 50,
    trust: 40,
    nostalgia: 20,
    curiosity: 30,
    hostility: 5,
    amusement: 20,
};
exports.EMOTION_MIN = 0;
exports.EMOTION_MAX = 100;
/**
 * Steps per decay tick (toward baseline).
 * Higher = faster convergence.
 */
exports.EMOTION_DECAY_RATE = 2;
