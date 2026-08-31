import { ModeManager } from './modeManager';
import { runtimeState } from '../state/runtimeState';

type TriggerMode =
  | 'drunk'
  | 'humor'
  | 'serious'
  | 'nostalgic'
  | 'philosophical'
  | 'roman';

type TriggerCategory =
  | 'drunk'
  | 'humor'
  | 'serious'
  | 'nostalgic'
  | 'philosophical'
  | 'roman';

export class TriggerManager {
  private static readonly COOLDOWN_MS =
    5 * 60 * 1000;

  private static readonly TRIGGER_THRESHOLD = 3;

  private static readonly drunkTriggers =
    [
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
      'noite',
      'bar',
      'pub',
      'vinho',
      'chopp',
      'toast',
    ] as const;

  private static readonly humorTriggers =
    [
      'kkkk',
      'hahaha',
      'rsrs',
      'piada',
      'engraçado',
      'rir',
      'risada',
      'humor',
      'comédia',
      'zueira',
      'brincadeira',
      'lol',
      'lmao',
      'haha',
      'k ',
    ] as const;

  private static readonly seriousTriggers =
    [
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
    ] as const;

  private static readonly nostalgicTriggers =
    [
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
    ] as const;

  private static readonly philosophicalTriggers =
    [
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
    ] as const;

  private static readonly romanTriggers =
    [
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
    ] as const;

  static checkTriggers(
    content: string,
    currentTime = Date.now()
  ): void {
    const lowerContent =
      content.toLowerCase();

    this.checkTriggerCategory(
      lowerContent,
      currentTime,
      'drunk',
      this.drunkTriggers,
      'drunk'
    );

    this.checkTriggerCategory(
      lowerContent,
      currentTime,
      'humor',
      this.humorTriggers,
      'humor'
    );

    this.checkTriggerCategory(
      lowerContent,
      currentTime,
      'serious',
      this.seriousTriggers,
      'serious'
    );

    this.checkTriggerCategory(
      lowerContent,
      currentTime,
      'nostalgic',
      this.nostalgicTriggers,
      'nostalgic'
    );

    this.checkTriggerCategory(
      lowerContent,
      currentTime,
      'philosophical',
      this.philosophicalTriggers,
      'philosophical'
    );

    this.checkTriggerCategory(
      lowerContent,
      currentTime,
      'roman',
      this.romanTriggers,
      'roman'
    );
  }

  private static checkTriggerCategory(
    content: string,
    currentTime: number,
    category: TriggerCategory,
    triggers: readonly string[],
    mode: TriggerMode
  ): void {
    const hasTrigger =
      triggers.some(trigger =>
        content.includes(trigger)
      );

    if (!hasTrigger) {
      return;
    }

    const lastTime =
      runtimeState.lastTriggerTime.get(
        category
      ) || 0;

    let currentCount =
      runtimeState.triggerCounts.get(
        category
      ) || 0;

    if (
      currentTime - lastTime >=
      this.COOLDOWN_MS
    ) {
      currentCount = 0;
    }

    currentCount++;

    runtimeState.triggerCounts.set(
      category,
      currentCount
    );

    runtimeState.lastTriggerTime.set(
      category,
      currentTime
    );

    console.log(
      `Trigger detectado: ${category} (${currentCount}/${this.TRIGGER_THRESHOLD})`
    );

    if (
      currentCount >=
      this.TRIGGER_THRESHOLD
    ) {
      this.activateMode(mode);

      runtimeState.triggerCounts.set(
        category,
        0
      );
    }
  }

  private static activateMode(
    mode: TriggerMode
  ): void {
    ModeManager.setMode(mode);

    console.log(
      `Trigger automático: modo ${mode} ativado!`
    );
  }

  static getTriggerStatus(): string {
    const status: string[] = [];

    runtimeState.triggerCounts.forEach(
      (count, category) => {
        if (count > 0) {
          status.push(
            `${category}: ${count}/${this.TRIGGER_THRESHOLD}`
          );
        }
      }
    );

    return status.length > 0
      ? status.join(', ')
      : 'Nenhum trigger ativo';
  }

  static resetTriggers(): void {
    runtimeState.triggerCounts.clear();

    runtimeState.lastTriggerTime.clear();

    console.log(
      'Triggers resetados'
    );
  }
}