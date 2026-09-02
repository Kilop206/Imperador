"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RarityManager = void 0;
const config_1 = require("../config/config");
class RarityManager {
    static getRareResponse() {
        const rarityData = config_1.config.tiberiusResponses.rarity;
        if (!rarityData.very_rare ||
            rarityData.very_rare.length === 0) {
            return null;
        }
        if (Math.random() >= 0.05) {
            return null;
        }
        const rareResponses = rarityData.very_rare;
        return rareResponses[Math.floor(Math.random() *
            rareResponses.length)];
    }
    static getRandomRareResponse() {
        const rarityData = config_1.config.tiberiusResponses.rarity;
        if (!rarityData.very_rare ||
            rarityData.very_rare.length === 0) {
            return null;
        }
        const rareResponses = rarityData.very_rare;
        return rareResponses[Math.floor(Math.random() *
            rareResponses.length)];
    }
}
exports.RarityManager = RarityManager;
