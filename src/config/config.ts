import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const loadTiberiusResponses = (): any => {
  try {
    const responsesPath = path.join(__dirname, '../../tiberius_responses.json');
    const content = fs.readFileSync(responsesPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Erro ao ler arquivo tiberius_responses.json:', error);
    return {
      spontaneous: { imperial: [], arrogant: [] },
      keywords: {},
      context: {},
      frequency: {},
      rarity: {},
      modes: { drunk: [], threat: [] }
    };
  }
};

export const config = {
  token: process.env.DISCORD_TOKEN || '',
  allowedChannels: (process.env.ALLOWED_CHANNELS || '').split(',').filter(Boolean),
  minInterval: parseInt(process.env.MIN_INTERVAL || '900000'), // 15 minutos em ms
  maxInterval: parseInt(process.env.MAX_INTERVAL || '3600000'), // 1 hora em ms
  tiberiusResponses: loadTiberiusResponses(),
  currentMode: 'normal', // normal, drunk, threat
  wordFrequency: new Map<string, number>(), // Rastreamento de frequência de palavras
  aggressiveMessageCount: 0, // Contador para detecção de ameaças
};

export const validateConfig = (): boolean => {
  if (!config.token) {
    console.error('DISCORD_TOKEN não está definido no arquivo .env');
    return false;
  }
  if (config.allowedChannels.length === 0) {
    console.error('ALLOWED_CHANNELS não está definido no arquivo .env');
    return false;
  }
  if (!config.tiberiusResponses || Object.keys(config.tiberiusResponses).length === 0) {
    console.error('Nenhuma resposta encontrada no arquivo tiberius_responses.json');
    return false;
  }
  if (!config.tiberiusResponses.spontaneous || 
      (!config.tiberiusResponses.spontaneous.imperial || config.tiberiusResponses.spontaneous.imperial.length === 0) &&
      (!config.tiberiusResponses.spontaneous.arrogant || config.tiberiusResponses.spontaneous.arrogant.length === 0)) {
    console.error('Nenhuma frase espontânea encontrada no arquivo tiberius_responses.json');
    return false;
  }
  return true;
};
