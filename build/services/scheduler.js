"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SchedulerService = void 0;
const config_1 = require("../config/config");
const modeManager_1 = require("./modeManager");
const rarityManager_1 = require("./rarityManager");
class SchedulerService {
    constructor(client) {
        this.scheduledTimeout = null;
        this.client = client;
    }
    getRandomInterval() {
        const { minInterval, maxInterval, } = config_1.config;
        return (Math.floor(Math.random() *
            (maxInterval - minInterval + 1)) + minInterval);
    }
    getRandomMessage() {
        const spontaneousData = config_1.config.tiberiusResponses.spontaneous;
        if (!modeManager_1.ModeManager.isNormalMode() &&
            Math.random() < 0.3) {
            const modeResponse = modeManager_1.ModeManager.getModeResponse();
            if (modeResponse) {
                return modeResponse;
            }
        }
        if (Math.random() < 0.1) {
            const rareResponse = rarityManager_1.RarityManager.getRandomRareResponse();
            if (rareResponse) {
                return rareResponse;
            }
        }
        const categories = [
            'imperial',
            'arrogant',
        ];
        const category = categories[Math.floor(Math.random() *
            categories.length)];
        const messages = spontaneousData[category];
        if (messages.length > 0) {
            return messages[Math.floor(Math.random() *
                messages.length)];
        }
        return 'O Império observa.';
    }
    getRandomChannel() {
        const allowedChannels = config_1.config.allowedChannels;
        if (allowedChannels.length === 0) {
            return null;
        }
        const channelId = allowedChannels[Math.floor(Math.random() *
            allowedChannels.length)];
        const channel = this.client.channels.cache.get(channelId);
        if (channel &&
            channel.isTextBased()) {
            return channel;
        }
        return null;
    }
    async sendRandomMessage() {
        try {
            const channel = this.getRandomChannel();
            if (!channel) {
                console.error('Canal não encontrado ou não é baseado em texto');
                this.scheduleNextMessage();
                return;
            }
            const message = this.getRandomMessage();
            await channel.send(message);
            console.log(`Mensagem enviada para o canal ${channel.name}: ${message}`);
        }
        catch (error) {
            console.error('Erro ao enviar mensagem:', error);
        }
        finally {
            this.scheduleNextMessage();
        }
    }
    scheduleNextMessage() {
        if (this.scheduledTimeout) {
            clearTimeout(this.scheduledTimeout);
        }
        const interval = this.getRandomInterval();
        console.log(`Próxima mensagem agendada para ${Math.round(interval / 60000)} minutos`);
        this.scheduledTimeout =
            setTimeout(() => {
                void this.sendRandomMessage();
            }, interval);
    }
    start() {
        console.log('Iniciando scheduler de mensagens aleatórias...');
        this.scheduleNextMessage();
    }
    stop() {
        if (this.scheduledTimeout) {
            clearTimeout(this.scheduledTimeout);
            this.scheduledTimeout = null;
        }
        console.log('Scheduler parado');
    }
}
exports.SchedulerService = SchedulerService;
