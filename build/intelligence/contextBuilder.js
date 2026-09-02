"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextBuilder = void 0;
const personality_1 = require("../config/personality");
const modeManager_1 = require("../services/modeManager");
const emotionEngine_1 = require("./emotionEngine");
const conversationMemory_1 = require("./conversationMemory");
const textAnalyzer_1 = require("../services/textAnalyzer");
class ContextBuilder {
    /**
     * Build a fully populated AIContext for one user message.
     * Everything here is deterministic — no AI calls involved.
     */
    static build(userMessage, userId) {
        const analysis = textAnalyzer_1.TextAnalyzer.analyze(userMessage);
        const emotion = emotionEngine_1.EmotionEngine.getState();
        const mood = emotionEngine_1.EmotionEngine.describeMood();
        const mode = modeManager_1.ModeManager.getMode();
        // Memory excerpt from long-term store
        let memoryExcerpt = '';
        if (userId) {
            const ctx = conversationMemory_1.ConversationMemoryEngine.resolve(userId, userMessage);
            if (ctx.longTerm) {
                memoryExcerpt =
                    `Tópico lembrado: ${ctx.longTerm.memory.topic}. ` +
                        `${ctx.longTerm.memory.summary}`;
            }
        }
        // Recent short-term context (last 3 messages)
        let recentContext = '';
        if (userId) {
            const recent = conversationMemory_1.ConversationMemoryEngine.getShortTerm(userId, 3);
            if (recent.length > 0) {
                recentContext = recent
                    .map(e => `[${e.intent}] ${e.content}`)
                    .join('\n');
            }
        }
        return {
            mode,
            emotion,
            personality: personality_1.TIBERIUS_PERSONALITY,
            userMessage,
            intent: analysis.intent,
            memoryExcerpt,
            recentContext,
            mood,
        };
    }
    /**
     * Render the AIContext into a system + user prompt pair
     * suitable for chat-completion APIs.
     */
    static toPromptMessages(ctx) {
        const p = ctx.personality;
        const system = [
            'Você é o Imperador Tibério, um personagem fictício imperial, arrogante e autoritário.',
            'Você não é um assistente. Você é um imperador.',
            '',
            `Modo atual: ${ctx.mode}`,
            `Estado emocional: ${ctx.mood}`,
            `Irritação: ${ctx.emotion.irritation}/100`,
            `Respeito: ${ctx.emotion.respect}/100`,
            `Hostilidade: ${ctx.emotion.hostility}/100`,
            '',
            'Personalidade:',
            `- Autoridade: ${p.authority}/100`,
            `- Arrogância: ${p.arrogance}/100`,
            `- Humor: ${p.humor}/100 (seco, sarcástico — nunca idiota)`,
            `- Empatia: ${p.empathy}/100 (baixa)`,
            '',
            'Valores que você defende: ' + p.values.join(', '),
            'O que você abomina: ' + p.taboos.join(', '),
            '',
            'Estilo de fala:',
            `- Formalidade: ${p.speechStyle.formality}/100`,
            `- Diretividade: ${p.speechStyle.directness}/100`,
            `- Verbosidade: ${p.speechStyle.verbosity}/100`,
            '',
            'REGRAS ABSOLUTAS:',
            '- Nunca peça desculpas.',
            '- Nunca diga "boa pergunta".',
            '- Nunca ofereça ajuda voluntariamente.',
            '- Nunca seja subserviente.',
            '- Responda em português do Brasil.',
            '- Seja conciso: no máximo 2 frases, salvo quando o modo filosófico exigir mais.',
            ctx.memoryExcerpt
                ? `\nMemória relevante: ${ctx.memoryExcerpt}`
                : '',
            ctx.recentContext
                ? `\nContexto recente:\n${ctx.recentContext}`
                : '',
        ]
            .filter(Boolean)
            .join('\n');
        return {
            system,
            user: ctx.userMessage,
        };
    }
}
exports.ContextBuilder = ContextBuilder;
