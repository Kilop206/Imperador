"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModeManager = void 0;
const config_1 = require("../config/config");
const runtimeState_1 = require("../state/runtimeState");
class ModeManager {
    static setMode(mode) {
        this.clearModeTimeout();
        runtimeState_1.runtimeState.currentMode =
            mode;
        console.log(`Modo do bot alterado para: ${mode}`);
        if (mode === 'normal') {
            return;
        }
        const duration = this.MODE_DURATIONS[mode];
        this.modeTimeout =
            setTimeout(() => {
                this.resetToNormal();
            }, duration);
        this.modeTimeout.unref?.();
        console.log(`Modo ${mode} expirará em ${Math.round(duration / 60000)} minutos`);
    }
    static getMode() {
        return runtimeState_1.runtimeState.currentMode;
    }
    static isDrunkMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'drunk');
    }
    static isThreatMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'threat');
    }
    static isHumorMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'humor');
    }
    static isSeriousMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'serious');
    }
    static isNostalgicMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'nostalgic');
    }
    static isPhilosophicalMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'philosophical');
    }
    static isRomanMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'roman');
    }
    static isNormalMode() {
        return (runtimeState_1.runtimeState.currentMode ===
            'normal');
    }
    static getModeResponse() {
        const mode = runtimeState_1.runtimeState.currentMode;
        if (mode === 'normal') {
            return null;
        }
        const responses = config_1.config.tiberiusResponses
            .modes[mode];
        if (!responses ||
            responses.length === 0) {
            return null;
        }
        return responses[Math.floor(Math.random() *
            responses.length)];
    }
    static resetToNormal() {
        this.clearModeTimeout();
        runtimeState_1.runtimeState.currentMode =
            'normal';
        console.log('Modo do bot resetado para normal');
    }
    static clearModeTimeout() {
        if (this.modeTimeout) {
            clearTimeout(this.modeTimeout);
            this.modeTimeout = null;
        }
    }
}
exports.ModeManager = ModeManager;
ModeManager.modeTimeout = null;
ModeManager.MODE_DURATIONS = {
    drunk: 10 * 60 * 1000,
    threat: 5 * 60 * 1000,
    humor: 15 * 60 * 1000,
    serious: 20 * 60 * 1000,
    nostalgic: 25 * 60 * 1000,
    philosophical: 30 * 60 * 1000,
    roman: 20 * 60 * 1000,
};
