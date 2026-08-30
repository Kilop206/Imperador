import { config } from '../config/config';

export class ModeManager {
  private static modeTimeout: NodeJS.Timeout | null = null;
  private static readonly MODE_DURATIONS = {
    drunk: 10 * 60 * 1000,      // 10 minutos
    threat: 5 * 60 * 1000,     // 5 minutos
    humor: 15 * 60 * 1000,     // 15 minutos
    serious: 20 * 60 * 1000,   // 20 minutos
    nostalgic: 25 * 60 * 1000, // 25 minutos
    philosophical: 30 * 60 * 1000, // 30 minutos
    roman: 20 * 60 * 1000      // 20 minutos
  };

  static setMode(mode: 'normal' | 'drunk' | 'threat' | 'humor' | 'serious' | 'nostalgic' | 'philosophical' | 'roman'): void {
    // Limpa timeout anterior se existir
    if (this.modeTimeout) {
      clearTimeout(this.modeTimeout);
      this.modeTimeout = null;
    }

    config.currentMode = mode;
    console.log(`Modo do bot alterado para: ${mode}`);

    // Define timeout automático para modos especiais
    if (mode !== 'normal') {
      const duration = this.MODE_DURATIONS[mode as keyof typeof this.MODE_DURATIONS];
      if (duration) {
        this.modeTimeout = setTimeout(() => {
          console.log(`Timeout automático: Resetando modo ${mode} para normal`);
          this.resetToNormal();
        }, duration);
        
        console.log(`Modo ${mode} expirará em ${Math.round(duration / 60000)} minutos`);
      }
    }
  }

  static getMode(): string {
    return config.currentMode;
  }

  static isDrunkMode(): boolean {
    return config.currentMode === 'drunk';
  }

  static isThreatMode(): boolean {
    return config.currentMode === 'threat';
  }

  static isHumorMode(): boolean {
    return config.currentMode === 'humor';
  }

  static isSeriousMode(): boolean {
    return config.currentMode === 'serious';
  }

  static isNostalgicMode(): boolean {
    return config.currentMode === 'nostalgic';
  }

  static isPhilosophicalMode(): boolean {
    return config.currentMode === 'philosophical';
  }

  static isRomanMode(): boolean {
    return config.currentMode === 'roman';
  }

  static isNormalMode(): boolean {
    return config.currentMode === 'normal';
  }

  static getModeResponse(): string | null {
    const modeData = config.tiberiusResponses.modes;
    
    if (!modeData) return null;
    
    switch (config.currentMode) {
      case 'drunk':
        if (modeData.drunk && modeData.drunk.length > 0) {
          const responses = modeData.drunk as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
      case 'threat':
        if (modeData.threat && modeData.threat.length > 0) {
          const responses = modeData.threat as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
      case 'humor':
        if (modeData.humor && modeData.humor.length > 0) {
          const responses = modeData.humor as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
      case 'serious':
        if (modeData.serious && modeData.serious.length > 0) {
          const responses = modeData.serious as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
      case 'nostalgic':
        if (modeData.nostalgic && modeData.nostalgic.length > 0) {
          const responses = modeData.nostalgic as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
      case 'philosophical':
        if (modeData.philosophical && modeData.philosophical.length > 0) {
          const responses = modeData.philosophical as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
      case 'roman':
        if (modeData.roman && modeData.roman.length > 0) {
          const responses = modeData.roman as string[];
          return responses[Math.floor(Math.random() * responses.length)];
        }
        break;
    }
    
    return null;
  }

  static resetToNormal(): void {
    // Limpa timeout se existir
    if (this.modeTimeout) {
      clearTimeout(this.modeTimeout);
      this.modeTimeout = null;
    }
    
    config.currentMode = 'normal';
    console.log('Modo do bot resetado para normal');
  }
}