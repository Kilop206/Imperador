"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TextAnalyzer = void 0;
const intentLearningService_1 = require("../intelligence/intentLearningService");
const intentClassifier_1 = require("../intelligence/intentClassifier");
const activeLearningService_1 = require("../intelligence/activeLearningService");
const aggressiveWords = [
    'matar',
    'morre',
    'morrer',
    'mata',
    'destruir',
    'acabar',
    'fude',
    'fuder',
    'caralho',
    'porra',
    'merda',
    'idiota',
    'burro',
    'estúpido',
    'retardado',
    'imbecil',
    'cu',
    'desgraça',
    'nojento',
    'nojo',
    'lixo',
    'fraquinho',
    'inútil',
    'miserável',
    'vergonha',
    'patético',
    'ridículo',
    'estúpida',
    'estúpidos',
    'burros',
    'burras',
    'merdas',
    'porras',
    'caralhos',
    'desgraças',
    'lixos',
    'inúteis',
    'miseráveis',
    'vergonhas',
    'patéticos',
    'ridículos',
];
const complimentWords = [
    'obrigado',
    'obrigada',
    'excelente',
    'incrível',
    'amazing',
    'melhor',
    'ótimo',
    'ótima',
    'admirável',
    'fantástico',
    'fantástica',
    'brilhante',
    'genial',
    'parabéns',
    'congratulations',
    'love',
    'amo',
    'adora',
    'admirar',
    'respeito',
    'respeitar',
    'grato',
    'grata',
    'agradecido',
    'agradecida',
    'maravilhoso',
    'maravilhosa',
    'perfeito',
    'perfeita',
    'espetacular',
    'formidável',
    'excepcional',
    'extraordinário',
    'extraordinária',
];
const sarcasmIndicators = [
    'sarcasmo',
    'ironia',
    'irônico',
    'irônica',
    'ironic',
    'sarcástico',
    'sarcástica',
    'sarcasticamente',
    'ironicamente',
    '😏',
    '🙄',
];
const humorWords = [
    'kkkk',
    'hahaha',
    'rsrs',
    'haha',
    'piada',
    'engraçado',
    'engraçada',
    'rir',
    'risada',
    'humor',
    'comédia',
    'zueira',
    'brincadeira',
    'lol',
    'lmao',
];
const seriousWords = [
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
];
const nostalgicWords = [
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
];
const philosophicalWords = [
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
];
const romanWords = [
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
];
const greetingPatterns = [
    'oi',
    'ola',
    'olá',
    'bom dia',
    'boa tarde',
    'boa noite',
    'eae',
    'e aí',
    'eai',
    'salve',
];
const farewellPatterns = [
    'tchau',
    'adeus',
    'até mais',
    'ate mais',
    'até logo',
    'ate logo',
    'falou',
    'flw',
    'fui',
];
class TextAnalyzer {
    static normalize(content) {
        return content
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^\p{L}\p{N}\s!?]/gu, ' ')
            .replace(/[!?]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }
    static tokenize(content) {
        const normalized = this.normalize(content);
        return normalized.length > 0
            ? normalized.split(' ')
            : [];
    }
    static containsAny(content, values) {
        const normalizedContent = this.normalize(content);
        return values.some(value => {
            const normalizedValue = this.normalize(value);
            if (normalizedValue.includes(' ')) {
                return normalizedContent.includes(normalizedValue);
            }
            return normalizedContent
                .split(' ')
                .some(token => token ===
                normalizedValue);
        });
    }
    static isQuestion(content) {
        const normalized = this.normalize(content);
        return (content.includes('?') ||
            normalized.startsWith('como ') ||
            normalized.startsWith('por que ') ||
            normalized.startsWith('porque ') ||
            normalized.startsWith('quando ') ||
            normalized.startsWith('onde ') ||
            normalized.startsWith('quem ') ||
            normalized.startsWith('qual ') ||
            normalized.startsWith('quais ') ||
            normalized.startsWith('quanto ') ||
            normalized.startsWith('quantos ') ||
            normalized.startsWith('quantas '));
    }
    static isAggressive(content) {
        return this.containsAny(content, aggressiveWords);
    }
    static isCompliment(content) {
        if (this.isAggressive(content)) {
            return false;
        }
        if (this.hasSarcasm(content)) {
            return false;
        }
        return this.containsAny(content, complimentWords);
    }
    static hasSarcasm(content) {
        return this.containsAny(content, sarcasmIndicators);
    }
    static detectIntent(content) {
        if (this.isAggressive(content)) {
            return 'aggressive';
        }
        if (this.isCompliment(content)) {
            return 'compliment';
        }
        const normalized = this.normalize(content);
        if (this.containsAny(normalized, philosophicalWords)) {
            return 'philosophical';
        }
        if (this.containsAny(normalized, seriousWords)) {
            return 'serious';
        }
        if (this.containsAny(normalized, nostalgicWords)) {
            return 'nostalgic';
        }
        if (this.containsAny(normalized, romanWords)) {
            return 'roman';
        }
        if (this.containsAny(normalized, humorWords)) {
            return 'humor';
        }
        if (this.isQuestion(content)) {
            return 'question';
        }
        if (this.containsAny(normalized, greetingPatterns)) {
            return 'greeting';
        }
        if (this.containsAny(normalized, farewellPatterns)) {
            return 'farewell';
        }
        intentLearningService_1.IntentLearningService.ensureInitialized();
        if (!intentClassifier_1.IntentClassifier.isTrained()) {
            return 'neutral';
        }
        const prediction = intentClassifier_1.IntentClassifier.predict(content);
        activeLearningService_1.ActiveLearningService.consider(content, prediction);
        if (prediction.confidence >=
            0.65) {
            return prediction.intent;
        }
        return 'neutral';
    }
    static analyze(content) {
        return {
            original: content,
            normalized: this.normalize(content),
            tokens: this.tokenize(content),
            intent: this.detectIntent(content),
            isAggressive: this.isAggressive(content),
            isCompliment: this.isCompliment(content),
            isQuestion: this.isQuestion(content),
            hasSarcasm: this.hasSarcasm(content),
        };
    }
}
exports.TextAnalyzer = TextAnalyzer;
