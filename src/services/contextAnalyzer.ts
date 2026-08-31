import { config } from '../config/config';

const aggressiveWords = ['matar', 'morrer', 'mata', 'morre', 'destruir', 'acabar', 'fude', 'fuder', 'caralho', 'porra', 'merda', 'idiota', 'burro', 'estúpido', 'retardado', 'imbecil', 'cabeça', 'boc', 'cu', 'caralho', 'desgraça', 'nojento', 'nojo', 'lixo', 'fraquinho', 'inútil', 'miserável', 'vergonha', 'patético', 'ridículo', 'estúpida', 'estúpidos', 'burros', 'burras', 'merdas', 'porras', 'caralhos', 'desgraças', 'lixos', 'inúteis', 'miseráveis', 'vergonhas', 'patéticos', 'ridículos'];
const complimentWords = ['obrigado', 'obrigada', 'excelente', 'incrível', 'amazing', 'melhor', 'ótimo', 'ótima', 'admirável', 'fantástico', 'fantástica', 'brilhante', 'genial', 'parabéns', 'congratulations', 'love', 'amo', 'adora', 'admirar', 'respeito', 'respeitar', 'grato', 'grata', 'agradecido', 'agradecida', 'maravilhoso', 'maravilhosa', 'perfeito', 'perfeita', 'incrível', 'espetacular', 'formidável', 'excepcional', 'extraordinário', 'extraordinária'];

export class ContextAnalyzer {
  static isCombination(content: string): string | null {
    const words = content.toLowerCase().split(/\s+/);
    const contextData = config.tiberiusResponses.context;
    
    for (const [combinationKey, responses] of Object.entries(contextData)) {
      const combinationWords = combinationKey.split('_');
      const hasAllWords = combinationWords.every(word => 
        words.some(w => w.includes(word))
      );
      
      if (hasAllWords && Array.isArray(responses) && responses.length > 0) {
        const responseArray = responses as string[];
        return responseArray[Math.floor(Math.random() * responseArray.length)];
      }
    }
    
    return null;
  }

  static trackWordFrequency(word: string): void {
    const currentCount = config.wordFrequency.get(word) || 0;
    config.wordFrequency.set(word, currentCount + 1);
  }

  static getFrequencyBasedResponse(word: string): string | null {
    const frequencyData = config.tiberiusResponses.frequency;
    if (!frequencyData[word]) return null;

    const count = config.wordFrequency.get(word) || 0;
    const frequencyOptions = frequencyData[word];

    // Encontra a resposta apropriada baseada na frequência
    let appropriateResponses: string[] = [];
    let maxThreshold = 0;

    for (const [threshold, responses] of Object.entries(frequencyOptions)) {
      const thresholdNum = parseInt(threshold);
      if (count >= thresholdNum && thresholdNum > maxThreshold) {
        maxThreshold = thresholdNum;
        appropriateResponses = responses as string[];
      }
    }

    if (appropriateResponses.length > 0) {
      return appropriateResponses[Math.floor(Math.random() * appropriateResponses.length)];
    }

    return null;
  }

  static isAggressive(content: string): boolean {
    const lowerContent = content.toLowerCase();
    const aggressiveCount = aggressiveWords.filter(word => 
      lowerContent.includes(word)
    ).length;
    
    // Verifica se tem palavras agressivas ou palavrões
    const hasAggressiveWords = aggressiveCount >= 1;
    
    // Verifica intensidade (mais palavras agressivas = mais agressivo)
    const isHighlyAggressive = aggressiveCount >= 2;
    
    return hasAggressiveWords;
  }

  static isCompliment(content: string): boolean {
    const lowerContent = content.toLowerCase();
    
    // Se for agressivo, não pode ser elogio
    if (this.isAggressive(content)) {
      return false;
    }
    
    // Verifica palavras de elogio
    const hasComplimentWords = complimentWords.some(word => lowerContent.includes(word));
    
    // Verifica indicadores de sarcasmo (ironia)
    const sarcasmIndicators = ['sarcasmo', 'ironia', 'ironic', 'sarcástico', 'sarcástica', 'sarcasticamente', 'ironicamente', '😏', '🙄', '🤔'];
    const hasSarcasm = sarcasmIndicators.some(indicator => lowerContent.includes(indicator));
    
    return hasComplimentWords && !hasSarcasm;
  }

  static incrementAggressiveCount(): void {
    config.aggressiveMessageCount++;
  }

  static resetAggressiveCount(): void {
    config.aggressiveMessageCount = 0;
  }

  static shouldTriggerThreatMode(): boolean {
    return config.aggressiveMessageCount >= 3; // 3 mensagens agressivas consecutivas
  }
}