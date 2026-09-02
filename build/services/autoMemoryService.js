"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoMemoryService = void 0;
const textAnalyzer_1 = require("./textAnalyzer");
const memoryService_1 = require("./memoryService");
const config_1 = require("../config/config");
const IGNORED_KEYWORDS = new Set([
    'oi',
    'ola',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'online',
    'obrigado',
    'obrigada',
    'kkkk',
    'tudo bem',
    'matar',
    'mata',
    'morre',
    'morrer',
    'destruir',
    'acabar',
    'caralho',
    'porra',
    'merda',
    'idiota',
    'burro',
    'estúpido',
    'imbecil',
    'cu',
    'desgraça',
    'nojento',
    'nojo',
    'lixo',
    'inútil',
    'miserável',
    'patético',
    'ridículo',
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
    'bar',
    'pub',
    'vinho',
    'chopp',
    'toast',
]);
const GENERIC_CONTEXT_WORDS = new Set([
    'v',
    'm',
    'a',
    'o',
    'e',
    'de',
    'do',
    'da',
    'em',
    'no',
    'na',
    'para',
    'por',
    'com',
    'sem',
]);
const IMPORTANT_TOPIC_WORDS = new Set([
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
    'passado',
    'antigo',
    'antiga',
    'lembrar',
    'lembrança',
    'saudade',
    'memória',
    'memórias',
    'antigamente',
    'infância',
    'juventude',
    'tempos',
    'história',
    'recordar',
    'guerra',
    'batalha',
    'sangue',
    'sofrimento',
    'dor',
    'tristeza',
    'funeral',
    'enterro',
    'cataclismo',
    'desastre',
    'tragédia',
]);
class AutoMemoryService {
    static processMessage(userId, username, content) {
        const analysis = textAnalyzer_1.TextAnalyzer.analyze(content);
        memoryService_1.MemoryService.upsertUser(userId, username);
        memoryService_1.MemoryService.saveEvent(userId, this.getEventType(analysis.intent), content, this.calculateEventImportance(analysis.intent, content));
        const candidate = this.extractCandidate(content);
        if (candidate) {
            memoryService_1.MemoryService.saveConversation(userId, candidate.topic, candidate.summary, candidate.importance);
            this.saveTopicEvent(userId, candidate);
        }
    }
    static getEventType(intent) {
        switch (intent) {
            case 'question':
                return 'question';
            case 'compliment':
                return 'compliment';
            case 'aggressive':
                return 'insult';
            case 'roman':
                return 'roman';
            case 'philosophical':
                return 'philosophical';
            case 'serious':
                return 'serious';
            case 'nostalgic':
                return 'nostalgic';
            case 'humor':
                return 'humor';
            default:
                return 'message';
        }
    }
    static saveTopicEvent(userId, candidate) {
        memoryService_1.MemoryService.saveEvent(userId, 'topic', `Tópico detectado: ${candidate.topic}`, candidate.importance);
    }
    static calculateEventImportance(intent, content) {
        let importance = 1;
        if (intent === 'question') {
            importance += 1;
        }
        if (intent === 'compliment') {
            importance += 1;
        }
        if (intent === 'aggressive') {
            importance += 2;
        }
        if (intent === 'serious' ||
            intent === 'philosophical') {
            importance += 2;
        }
        if (intent === 'nostalgic') {
            importance += 1;
        }
        if (content.includes('?')) {
            importance += 1;
        }
        if (content.length > 120) {
            importance += 1;
        }
        return Math.min(importance, 10);
    }
    static extractCandidate(content) {
        const analysis = textAnalyzer_1.TextAnalyzer.analyze(content);
        const topic = this.detectTopic(content, analysis.intent);
        if (!topic) {
            return null;
        }
        const importance = this.calculateImportance(analysis.intent, content, topic);
        return {
            topic,
            summary: this.createSummary(content, analysis.intent),
            importance,
        };
    }
    static detectTopic(content, intent) {
        const normalized = textAnalyzer_1.TextAnalyzer.normalize(content);
        const tokens = normalized.split(' ');
        const topics = this.getDynamicTopics();
        const candidates = [];
        for (const topic of topics) {
            let score = topic.score;
            for (const trigger of topic.triggers) {
                const isPhrase = trigger.includes(' ');
                if (isPhrase) {
                    if (normalized.includes(trigger)) {
                        score += 4;
                    }
                    continue;
                }
                if (tokens.includes(trigger)) {
                    score += 5;
                }
            }
            if (score > topic.score) {
                candidates.push({
                    topic,
                    score,
                });
            }
        }
        if (candidates.length > 0) {
            candidates.sort((a, b) => b.score - a.score);
            return candidates[0]
                .topic
                .name;
        }
        return this.getIntentTopic(intent, tokens);
    }
    static getIntentTopic(intent, tokens) {
        const fallbackTopics = {
            philosophical: [
                'vida',
                'morte',
                'sentido',
                'existência',
                'propósito',
                'destino',
                'universo',
                'realidade',
                'verdade',
                'consciência',
                'alma',
                'espírito',
            ],
            serious: [
                'morte',
                'guerra',
                'batalha',
                'sangue',
                'sofrimento',
                'dor',
                'tristeza',
                'funeral',
                'tragédia',
            ],
            nostalgic: [
                'passado',
                'antigo',
                'lembrar',
                'saudade',
                'memória',
                'história',
            ],
        };
        const candidates = fallbackTopics[intent];
        if (!candidates) {
            return null;
        }
        for (const candidate of candidates) {
            const normalizedCandidate = textAnalyzer_1.TextAnalyzer.normalize(candidate);
            if (tokens.includes(normalizedCandidate)) {
                return normalizedCandidate;
            }
        }
        return null;
    }
    static getDynamicTopics() {
        const topics = new Map();
        const addTopic = (name, trigger, score) => {
            const normalizedName = textAnalyzer_1.TextAnalyzer.normalize(name);
            const normalizedTrigger = textAnalyzer_1.TextAnalyzer.normalize(trigger);
            if (normalizedName.length < 2 ||
                normalizedTrigger.length < 2) {
                return;
            }
            if (GENERIC_CONTEXT_WORDS.has(normalizedName) ||
                GENERIC_CONTEXT_WORDS.has(normalizedTrigger)) {
                return;
            }
            if (IGNORED_KEYWORDS.has(normalizedName) ||
                IGNORED_KEYWORDS.has(normalizedTrigger)) {
                return;
            }
            const existing = topics.get(normalizedName);
            if (existing) {
                if (!existing.triggers.includes(normalizedTrigger)) {
                    existing.triggers.push(normalizedTrigger);
                }
                existing.score =
                    Math.max(existing.score, score);
                return;
            }
            topics.set(normalizedName, {
                name: normalizedName,
                triggers: [
                    normalizedTrigger,
                ],
                score,
            });
        };
        const keywords = config_1.config.tiberiusResponses
            .keywords;
        for (const keyword of Object.keys(keywords)) {
            const normalized = textAnalyzer_1.TextAnalyzer.normalize(keyword);
            if (normalized.length < 2 ||
                IGNORED_KEYWORDS.has(normalized)) {
                continue;
            }
            addTopic(normalized, normalized, IMPORTANT_TOPIC_WORDS.has(normalized)
                ? 18
                : 10);
        }
        const context = config_1.config.tiberiusResponses
            .context;
        for (const combination of Object.keys(context)) {
            const parts = combination
                .split('_')
                .map(part => textAnalyzer_1.TextAnalyzer.normalize(part))
                .filter(part => part.length >= 2 &&
                !GENERIC_CONTEXT_WORDS.has(part) &&
                !IGNORED_KEYWORDS.has(part));
            for (const part of parts) {
                addTopic(part, part, IMPORTANT_TOPIC_WORDS.has(part)
                    ? 18
                    : 15);
            }
        }
        return Array.from(topics.values());
    }
    static calculateImportance(intent, content, topic) {
        let importance = 1;
        if (intent === 'philosophical') {
            importance += 3;
        }
        if (intent === 'serious') {
            importance += 2;
        }
        if (intent === 'nostalgic') {
            importance += 1;
        }
        if (intent === 'question') {
            importance += 1;
        }
        if (content.includes('?')) {
            importance += 1;
        }
        if (content.length > 120) {
            importance += 1;
        }
        if (IMPORTANT_TOPIC_WORDS.has(textAnalyzer_1.TextAnalyzer.normalize(topic))) {
            importance += 1;
        }
        return Math.min(importance, 10);
    }
    static createSummary(content, intent) {
        const cleanContent = content
            .replace(/\s+/g, ' ')
            .trim();
        const maxLength = 180;
        const summary = cleanContent.length > maxLength
            ? `${cleanContent.slice(0, maxLength)}...`
            : cleanContent;
        return `Mensagem classificada como ${intent}: ${summary}`;
    }
    static getMemorySummary(userId) {
        const user = memoryService_1.MemoryService.getUser(userId);
        const conversations = memoryService_1.MemoryService.getUserConversations(userId, 5);
        const events = memoryService_1.MemoryService.getImportantUserEvents(userId, 4, 5);
        if (!user &&
            conversations.length === 0 &&
            events.length === 0) {
            return '';
        }
        const lines = [];
        if (user) {
            lines.push(`Usuário: ${user.username}`);
            lines.push(`Mensagens registradas: ${user.messageCount}`);
        }
        if (conversations.length > 0) {
            lines.push('Memórias relevantes:');
            for (const conversation of conversations) {
                lines.push(`- ${conversation.topic}: ${conversation.summary}`);
            }
        }
        if (events.length > 0) {
            lines.push('Eventos importantes:');
            for (const event of events) {
                lines.push(`- [${event.type}] ${event.content}`);
            }
        }
        return lines.join('\n');
    }
}
exports.AutoMemoryService = AutoMemoryService;
