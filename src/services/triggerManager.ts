import { config } from '../config/config';
import { ModeManager } from './modeManager';

export class TriggerManager {
  private static triggerCounts = new Map<string, number>();
  private static lastTriggerTime = new Map<string, number>();
  private static readonly COOLDOWN_MS = 300000; // 5 minutos de cooldown entre triggers
  private static readonly TRIGGER_THRESHOLD = 3; // Quantas menções para ativar (reduzido para facilitar testes)

  // Palavras que podem ativar modo bêbado
  private static drunkTriggers = ['festa', 'cerveja', 'álcool', 'bebida', 'drink', 'comemorar', 'celebrar', 'alegrar', 'felicidade', 'diversão', 'balada', 'noite', 'bar', 'pub', 'vinho', 'chopp', 'toast'];

  // Palavras que podem ativar modo humor
  private static humorTriggers = ['kkkk', 'hahaha', 'rsrs', 'piada', 'engraçado', 'rir', 'risada', 'humor', 'comédia', 'zueira', 'brincadeira', 'lol', 'lmao', 'haha', 'k'];

  // Palavras que podem ativar modo sério
  private static seriousTriggers = ['morte', 'morrer', 'guerra', 'batalha', 'sangue', 'destruição', 'sofrimento', 'dor', 'tristeza', 'chorei', 'chorar', 'lágrimas', 'funeral', 'enterro', 'cataclismo', 'desastre', 'tragédia'];

  // Palavras que podem ativar modo nostálgico
  private static nostalgicTriggers = ['passado', 'antigo', 'antiga', 'lembrar', 'lembrança', 'saudade', 'memória', 'memórias', 'antigamente', 'antes', 'infância', 'juventude', 'antigo', 'tempos', 'história', 'recordar'];

  // Palavras que podem ativar modo filosófico
  private static philosophicalTriggers = ['vida', 'morte', 'sentido', 'existência', 'propósito', 'destino', 'fado', 'universo', 'cosmos', 'eternidade', 'tempo', 'realidade', 'verdade', 'consciência', 'alma', 'espírito'];

  // Palavras que podem ativar modo romano
  private static romanTriggers = ['senado', 'senador', 'legião', 'legionário', 'romano', 'romana', 'cesar', 'júlio', 'augusto', 'império', 'imperador', 'coliseu', 'gladiador', 'águia', 'aquila', 'latim', 'roma'];

  static checkTriggers(content: string): void {
    const lowerContent = content.toLowerCase();
    const currentTime = Date.now();

    // Verifica cada categoria de trigger
    this.checkTriggerCategory(lowerContent, currentTime, 'drunk', this.drunkTriggers, 'drunk');
    this.checkTriggerCategory(lowerContent, currentTime, 'humor', this.humorTriggers, 'humor');
    this.checkTriggerCategory(lowerContent, currentTime, 'serious', this.seriousTriggers, 'serious');
    this.checkTriggerCategory(lowerContent, currentTime, 'nostalgic', this.nostalgicTriggers, 'nostalgic');
    this.checkTriggerCategory(lowerContent, currentTime, 'philosophical', this.philosophicalTriggers, 'philosophical');
    this.checkTriggerCategory(lowerContent, currentTime, 'roman', this.romanTriggers, 'roman');
  }

  private static checkTriggerCategory(
    content: string, 
    currentTime: number, 
    category: string, 
    triggers: string[], 
    mode: string
  ): void {
    // Verifica se alguma palavra trigger está presente
    const hasTrigger = triggers.some(trigger => content.includes(trigger));
    
    if (hasTrigger) {
      const currentCount = this.triggerCounts.get(category) || 0;
      const lastTime = this.lastTriggerTime.get(category) || 0;
      
      // Reseta contador se passou o cooldown
      if (currentTime - lastTime > this.COOLDOWN_MS) {
        this.triggerCounts.set(category, 0);
      }
      
      // Incrementa contador
      this.triggerCounts.set(category, currentCount + 1);
      this.lastTriggerTime.set(category, currentTime);
      
      console.log(`Trigger detectado: ${category} (${currentCount + 1}/${this.TRIGGER_THRESHOLD})`);
      
      // Ativa modo se atingiu o threshold
      if (currentCount + 1 >= this.TRIGGER_THRESHOLD) {
        this.activateMode(mode);
        this.triggerCounts.set(category, 0); // Reseta após ativar
      }
    }
  }

  private static activateMode(mode: string): void {
    switch (mode) {
      case 'drunk':
        ModeManager.setMode('drunk');
        console.log('Trigger automático: Modo bêbado ativado!');
        break;
      case 'humor':
        ModeManager.setMode('humor');
        console.log('Trigger automático: Modo humor ativado!');
        break;
      case 'serious':
        ModeManager.setMode('serious');
        console.log('Trigger automático: Modo sério ativado!');
        break;
      case 'nostalgic':
        ModeManager.setMode('nostalgic');
        console.log('Trigger automático: Modo nostálgico ativado!');
        break;
      case 'philosophical':
        ModeManager.setMode('philosophical');
        console.log('Trigger automático: Modo filosófico ativado!');
        break;
      case 'roman':
        ModeManager.setMode('roman');
        console.log('Trigger automático: Modo romano ativado!');
        break;
    }
  }

  static getTriggerStatus(): string {
    const status: string[] = [];
    
    this.triggerCounts.forEach((count, category) => {
      if (count > 0) {
        status.push(`${category}: ${count}/${this.TRIGGER_THRESHOLD}`);
      }
    });
    
    return status.length > 0 ? status.join(', ') : 'Nenhum trigger ativo';
  }

  static resetTriggers(): void {
    this.triggerCounts.clear();
    this.lastTriggerTime.clear();
    console.log('Triggers resetados');
  }
}