import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

import { TiberiusResponses } from '../types/tiberius';

dotenv.config();

const DEFAULT_MIN_INTERVAL = 60 * 60 * 1000; // 1 hora
const DEFAULT_MAX_INTERVAL = 2 * 60 * 60 * 1000; // 2 horas

const parsePositiveInteger = (
  value: string | undefined,
  fallback: number
): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
};

const loadTiberiusResponses = (): TiberiusResponses => {
  try {
    const responsesPath = path.join(
      __dirname,
      '../../tiberius_responses.json'
    );

    const content = fs.readFileSync(
      responsesPath,
      'utf-8'
    );

    return JSON.parse(
      content
    ) as TiberiusResponses;
  } catch (error) {
    console.error(
      'Erro ao ler arquivo tiberius_responses.json:',
      error
    );

    return {
      spontaneous: {
        imperial: [],
        arrogant: [],
      },

      keywords: {},

      context: {},

      frequency: {},

      rarity: {
        very_rare: [],
      },

      modes: {},

      compliments: [],
    };
  }
};

export const config = {
  token:
    process.env.DISCORD_TOKEN?.trim() || '',

  allowedChannels:
    (process.env.ALLOWED_CHANNELS || '')
      .split(',')
      .map(channel => channel.trim())
      .filter(Boolean),

  minInterval:
    parsePositiveInteger(
      process.env.MIN_INTERVAL,
      DEFAULT_MIN_INTERVAL
    ),

  maxInterval:
    parsePositiveInteger(
      process.env.MAX_INTERVAL,
      DEFAULT_MAX_INTERVAL
    ),

  tiberiusResponses:
    loadTiberiusResponses(),
};

export const validateConfig = (): boolean => {
  if (!config.token) {
    console.error(
      'DISCORD_TOKEN não está definido no arquivo .env'
    );

    return false;
  }

  if (
    config.allowedChannels.length === 0
  ) {
    console.error(
      'ALLOWED_CHANNELS não está definido no arquivo .env'
    );

    return false;
  }

  if (
    config.minInterval >
    config.maxInterval
  ) {
    console.error(
      'MIN_INTERVAL não pode ser maior que MAX_INTERVAL'
    );

    return false;
  }

  if (
    !config.tiberiusResponses ||
    Object.keys(
      config.tiberiusResponses
    ).length === 0
  ) {
    console.error(
      'Nenhuma resposta encontrada no arquivo tiberius_responses.json'
    );

    return false;
  }

  const spontaneous =
    config.tiberiusResponses.spontaneous;

  const hasImperialResponses =
    spontaneous.imperial.length > 0;

  const hasArrogantResponses =
    spontaneous.arrogant.length > 0;

  if (
    !hasImperialResponses &&
    !hasArrogantResponses
  ) {
    console.error(
      'Nenhuma frase espontânea encontrada no arquivo tiberius_responses.json'
    );

    return false;
  }

  return true;
};