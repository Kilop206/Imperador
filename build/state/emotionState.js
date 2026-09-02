"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emotionState = void 0;
exports.clamp = clamp;
exports.modifyEmotion = modifyEmotion;
exports.setEmotion = setEmotion;
exports.snapshotEmotions = snapshotEmotions;
exports.restoreEmotions = restoreEmotions;
exports.resetEmotions = resetEmotions;
const emotion_1 = require("../types/emotion");
/**
 * Live mutable emotion state.
 * All mutations must go through the helpers below to enforce clamping.
 */
exports.emotionState = {
    ...emotion_1.EMOTION_BASELINE,
};
function clamp(value, min = emotion_1.EMOTION_MIN, max = emotion_1.EMOTION_MAX) {
    return Math.max(min, Math.min(max, value));
}
function modifyEmotion(name, delta) {
    exports.emotionState[name] = clamp(exports.emotionState[name] + delta);
}
function setEmotion(name, value) {
    exports.emotionState[name] = clamp(value);
}
/** Deep copy for persistence / display. */
function snapshotEmotions() {
    return { ...exports.emotionState };
}
/**
 * Restore from a persisted snapshot.
 * Extra or unknown keys are ignored; missing keys keep baseline.
 */
function restoreEmotions(snapshot) {
    for (const key of Object.keys(exports.emotionState)) {
        const stored = snapshot[key];
        if (typeof stored === 'number') {
            exports.emotionState[key] = clamp(stored);
        }
    }
}
function resetEmotions() {
    for (const key of Object.keys(exports.emotionState)) {
        exports.emotionState[key] = emotion_1.EMOTION_BASELINE[key];
    }
}
