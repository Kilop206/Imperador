"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextAnalyzer = void 0;
const config_1 = require("../config/config");
const runtimeState_1 = require("../state/runtimeState");
const memoryService_1 = require("./memoryService");
const textAnalyzer_1 = require("./textAnalyzer");
class ContextAnalyzer {
    static isCombination(content) {
        const normalizedContent = textAnalyzer_1.TextAnalyzer.normalize(content);
        const contextData = config_1.config.tiberiusResponses.context;
        for (const [combinationKey, responses] of Object.entries(contextData)) {
            const combinationWords = combinationKey
                .split('_')
                .map(word => textAnalyzer_1.TextAnalyzer.normalize(word));
            const hasAllWords = combinationWords.every(word => normalizedContent
                .split(' ')
                .some(token => token === word ||
                token.includes(word)));
            if (hasAllWords &&
                responses.length > 0) {
                return responses[Math.floor(Math.random() *
                    responses.length)];
            }
        }
        return null;
    }
    static trackWordFrequency(word) {
        return memoryService_1.MemoryService.incrementWord(textAnalyzer_1.TextAnalyzer.normalize(word));
    }
    static getWordFrequency(word) {
        return memoryService_1.MemoryService.getWordCount(textAnalyzer_1.TextAnalyzer.normalize(word));
    }
    static getFrequencyBasedResponse(word) {
        const frequencyData = config_1.config.tiberiusResponses.frequency;
        const originalKey = Object.keys(frequencyData).find(key => textAnalyzer_1.TextAnalyzer.normalize(key) ===
            textAnalyzer_1.TextAnalyzer.normalize(word));
        if (!originalKey) {
            return null;
        }
        const count = this.getWordFrequency(originalKey);
        const frequencyOptions = frequencyData[originalKey];
        let appropriateResponses = [];
        let maxThreshold = 0;
        for (const [threshold, responses] of Object.entries(frequencyOptions)) {
            const thresholdNum = Number.parseInt(threshold, 10);
            if (count >= thresholdNum &&
                thresholdNum > maxThreshold) {
                maxThreshold =
                    thresholdNum;
                appropriateResponses =
                    responses;
            }
        }
        if (appropriateResponses.length === 0) {
            return null;
        }
        return appropriateResponses[Math.floor(Math.random() *
            appropriateResponses.length)];
    }
    static registerUser(userId, username) {
        return memoryService_1.MemoryService.upsertUser(userId, username);
    }
    static saveConversation(userId, topic, summary, importance = 1) {
        return memoryService_1.MemoryService.saveConversation(userId, topic, summary, importance);
    }
    static isAggressive(content) {
        return textAnalyzer_1.TextAnalyzer.isAggressive(content);
    }
    static isCompliment(content) {
        return textAnalyzer_1.TextAnalyzer.isCompliment(content);
    }
    static isQuestion(content) {
        return textAnalyzer_1.TextAnalyzer.isQuestion(content);
    }
    static detectIntent(content) {
        return textAnalyzer_1.TextAnalyzer.detectIntent(content);
    }
    static analyze(content) {
        return textAnalyzer_1.TextAnalyzer.analyze(content);
    }
    static incrementAggressiveCount() {
        runtimeState_1.runtimeState.aggressiveMessageCount++;
    }
    static resetAggressiveCount() {
        runtimeState_1.runtimeState.aggressiveMessageCount = 0;
    }
    static shouldTriggerThreatMode() {
        return (runtimeState_1.runtimeState.aggressiveMessageCount >=
            3);
    }
}
exports.ContextAnalyzer = ContextAnalyzer;
