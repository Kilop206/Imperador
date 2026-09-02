"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerManager = void 0;
const modeManager_1 = require("./modeManager");
const runtimeState_1 = require("../state/runtimeState");
class TriggerManager {
    static checkTriggers(content, currentTime = Date.now()) {
        const lowerContent = content.toLowerCase();
        Object.entries(this.triggers).forEach(([category, triggers]) => {
            this.checkTriggerCategory(lowerContent, currentTime, category, triggers, category);
        });
    }
    static checkTriggerCategory(content, currentTime, category, triggers, mode) {
        const hasTrigger = triggers.some(trigger => content.includes(trigger));
        if (!hasTrigger) {
            return;
        }
        const lastTime = runtimeState_1.runtimeState.lastTriggerTime.get(category) || 0;
        let currentCount = runtimeState_1.runtimeState.triggerCounts.get(category) || 0;
        if (currentTime - lastTime >=
            this.COOLDOWN_MS) {
            currentCount = 0;
        }
        currentCount++;
        runtimeState_1.runtimeState.triggerCounts.set(category, currentCount);
        runtimeState_1.runtimeState.lastTriggerTime.set(category, currentTime);
        console.log(`Trigger detectado: ${category} (${currentCount}/${this.TRIGGER_THRESHOLD})`);
        if (currentCount >=
            this.TRIGGER_THRESHOLD) {
            modeManager_1.ModeManager.setMode(mode);
            runtimeState_1.runtimeState.triggerCounts.set(category, 0);
        }
    }
    static getTriggerStatus() {
        const status = [];
        runtimeState_1.runtimeState.triggerCounts.forEach((count, category) => {
            if (count > 0) {
                status.push(`${category}: ${count}/${this.TRIGGER_THRESHOLD}`);
            }
        });
        return status.length > 0
            ? status.join(', ')
            : 'Nenhum trigger ativo';
    }
    static resetTriggers() {
        runtimeState_1.runtimeState.triggerCounts.clear();
        runtimeState_1.runtimeState.lastTriggerTime.clear();
        console.log('Triggers resetados');
    }
}
exports.TriggerManager = TriggerManager;
TriggerManager.COOLDOWN_MS = 5 * 60 * 1000;
TriggerManager.TRIGGER_THRESHOLD = 3;
TriggerManager.triggers = {
    drunk: [
        'festa',
        'cerveja',
        'álcool',
        'bebida',
        'drink',
        'comemorar',
        'celebrar',
        'alegrar',
        'felicidade',
        'diversão',
        'balada',
        'noite',
        'bar',
        'pub',
        'vinho',
        'chopp',
        'toast',
    ],
    humor: [
        'kkkk',
        'hahaha',
        'rsrs',
        'piada',
        'engraçado',
        'rir',
        'risada',
        'humor',
        'comédia',
        'zueira',
        'brincadeira',
        'lol',
        'lmao',
        'haha',
        'k ',
    ],
    serious: [
        'morte',
        'morrer',
        'guerra',
        'batalha',
        'sangue',
        'destruição',
        'sofrimento',
        'dor',
        'tristeza',
        'chorei',
        'chorar',
        'lágrimas',
        'funeral',
        'enterro',
        'cataclismo',
        'desastre',
        'tragédia',
    ],
    nostalgic: [
        'passado',
        'antigo',
        'antiga',
        'lembrar',
        'lembrança',
        'saudade',
        'memória',
        'memórias',
        'antigamente',
        'antes',
        'infância',
        'juventude',
        'tempos',
        'história',
        'recordar',
    ],
    philosophical: [
        'vida',
        'morte',
        'sentido',
        'existência',
        'propósito',
        'destino',
        'fado',
        'universo',
        'cosmos',
        'eternidade',
        'tempo',
        'realidade',
        'verdade',
        'consciência',
        'alma',
        'espírito',
    ],
    roman: [
        'senado',
        'senador',
        'legião',
        'legionário',
        'romano',
        'romana',
        'cesar',
        'júlio',
        'augusto',
        'império',
        'imperador',
        'coliseu',
        'gladiador',
        'águia',
        'aquila',
        'latim',
        'roma',
    ],
};
