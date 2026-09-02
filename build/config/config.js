"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateConfig = exports.config = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv_1.default.config();
const DEFAULT_MIN_INTERVAL = 60 * 60 * 1000; // 1 hora
const DEFAULT_MAX_INTERVAL = 2 * 60 * 60 * 1000; // 2 horas
const parsePositiveInteger = (value, fallback) => {
    if (!value) {
        return fallback;
    }
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return fallback;
    }
    return parsed;
};
const loadTiberiusResponses = () => {
    try {
        const responsesPath = path.join(__dirname, '../../tiberius_responses.json');
        const content = fs.readFileSync(responsesPath, 'utf-8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error('Erro ao ler arquivo tiberius_responses.json:', error);
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
exports.config = {
    token: process.env.DISCORD_TOKEN?.trim() || '',
    allowedChannels: (process.env.ALLOWED_CHANNELS || '')
        .split(',')
        .map(channel => channel.trim())
        .filter(Boolean),
    minInterval: parsePositiveInteger(process.env.MIN_INTERVAL, DEFAULT_MIN_INTERVAL),
    maxInterval: parsePositiveInteger(process.env.MAX_INTERVAL, DEFAULT_MAX_INTERVAL),
    tiberiusResponses: loadTiberiusResponses(),
};
const validateConfig = () => {
    if (!exports.config.token) {
        console.error('DISCORD_TOKEN não está definido no arquivo .env');
        return false;
    }
    if (exports.config.allowedChannels.length === 0) {
        console.error('ALLOWED_CHANNELS não está definido no arquivo .env');
        return false;
    }
    if (exports.config.minInterval >
        exports.config.maxInterval) {
        console.error('MIN_INTERVAL não pode ser maior que MAX_INTERVAL');
        return false;
    }
    if (!exports.config.tiberiusResponses ||
        Object.keys(exports.config.tiberiusResponses).length === 0) {
        console.error('Nenhuma resposta encontrada no arquivo tiberius_responses.json');
        return false;
    }
    const spontaneous = exports.config.tiberiusResponses.spontaneous;
    const hasImperialResponses = spontaneous.imperial.length > 0;
    const hasArrogantResponses = spontaneous.arrogant.length > 0;
    if (!hasImperialResponses &&
        !hasArrogantResponses) {
        console.error('Nenhuma frase espontânea encontrada no arquivo tiberius_responses.json');
        return false;
    }
    return true;
};
exports.validateConfig = validateConfig;
