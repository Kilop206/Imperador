import { config } from '../config/config';

const aggressiveWords = ['matar', 'morrer', 'mata', 'morre', 'destruir', 'destruir', 'acabar', 'acaba', 'fude', 'fuder', 'caralho', 'porra', 'merda', 'idiota', 'burro', 'estúpido'];
const complimentWords = ['obrigado', 'obrigada', 'excelente', 'incrível', 'amazing', 'melhor', 'ótimo', 'ótima', 'admirável', 'fantástico', 'fantástica', 'brilhante', 'genial'];

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
    
    return aggressiveCount >= 2; // Múltiplas palavras agressivas
  }

  static isCompliment(content: string): boolean {
    const lowerContent = content.toLowerCase();
    return complimentWords.some(word => lowerContent.includes(word));
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