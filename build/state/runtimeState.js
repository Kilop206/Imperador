"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runtimeState = void 0;
exports.resetRuntimeState = resetRuntimeState;
exports.runtimeState = {
    currentMode: 'normal',
    aggressiveMessageCount: 0,
    triggerCounts: new Map(),
    lastTriggerTime: new Map(),
};
function resetRuntimeState() {
    exports.runtimeState.currentMode =
        'normal';
    exports.runtimeState.aggressiveMessageCount =
        0;
    exports.runtimeState.triggerCounts.clear();
    exports.runtimeState.lastTriggerTime.clear();
}
