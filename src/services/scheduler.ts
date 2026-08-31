import { Client, TextChannel } from 'discord.js';
import { config } from '../config/config';
import { ModeManager } from './modeManager';
import { RarityManager } from './rarityManager';

export class SchedulerService {
  private client: Client;
  private scheduledTimeout: NodeJS.Timeout | null = null;

  constructor(client: Client) {
    this.client = client;
  }

  getRandomInterval(): number {
    const { minInterval, maxInterval } = config;
    return Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
  }

  getRandomMessage(): string {
    const spontaneousData = config.tiberiusResponses.spontaneous;
    
    // Verifica se está em modo especial (30% de chance de usar resposta do modo)
    if (!ModeManager.isNormalMode() && Math.random() < 0.3) {
      const modeResponse = ModeManager.getModeResponse();
      if (modeResponse) {
        return modeResponse;
      }
    }

    // Chance de frase rara (10%)
    if (Math.random() < 0.1) {
      const rareResponse = RarityManager.getRandomRareResponse();
      if (rareResponse) {
        return rareResponse;
      }
    }

    // Escolhe entre categorias imperial e arrogant
    const categories = ['imperial', 'arrogant'];
    const category = categories[Math.floor(Math.random() * categories.length)];
    
    const messages = spontaneousData[category] as string[];
    if (messages.length > 0) {
      return messages[Math.floor(Math.random() * messages.length)];
    }

    return "O Império observa.";
  }

  getRandomChannel(): TextChannel | null {
    const allowedChannels = config.allowedChannels;
    const channelId = allowedChannels[Math.floor(Math.random() * allowedChannels.length)];
    
    const channel = this.client.channels.cache.get(channelId);
    if (channel && channel.isTextBased()) {
      return channel as TextChannel;
    }
    return null;
  }

  async sendRandomMessage(): Promise<void> {
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
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      this.scheduleNextMessage();
    }
  }

  scheduleNextMessage(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
    }

    const interval = this.getRandomInterval();
    console.log(`Próxima mensagem agendada para ${Math.round(interval / 60000)} minutos`);
    
    this.scheduledTimeout = setTimeout(() => {
      this.sendRandomMessage();
    }, interval);
  }

  start(): void {
    console.log('Iniciando scheduler de mensagens aleatórias...');
    this.scheduleNextMessage();
  }

  stop(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    console.log('Scheduler parado');
  }
}
