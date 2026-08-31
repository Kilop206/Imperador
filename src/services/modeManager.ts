import { config } from '../config/config';
import { runtimeState } from '../state/runtimeState';
import { TiberiusMode } from '../types/tiberius';

export class ModeManager {
  private static modeTimeout:
    NodeJS.Timeout | null = null;

  private static readonly MODE_DURATIONS: Record<
    Exclude<TiberiusMode, 'normal'>,
    number
  > = {
    drunk: 10 * 60 * 1000,
    threat: 5 * 60 * 1000,
    humor: 15 * 60 * 1000,
    serious: 20 * 60 * 1000,
    nostalgic: 25 * 60 * 1000,
    philosophical: 30 * 60 * 1000,
    roman: 20 * 60 * 1000,
  };

  static setMode(
    mode: TiberiusMode
  ): void {
    this.clearModeTimeout();

    runtimeState.currentMode = mode;

    console.log(
      `Modo do bot alterado para: ${mode}`
    );

    if (mode === 'normal') {
      return;
    }

    const duration =
      this.MODE_DURATIONS[mode];

    this.modeTimeout =
      setTimeout(() => {
        console.log(
          `Timeout automático: resetando modo ${mode} para normal`
        );

        this.resetToNormal();
      }, duration);

    this.modeTimeout.unref?.();

    console.log(
      `Modo ${mode} expirará em ${Math.round(
        duration / 60000
      )} minutos`
    );
  }

  static getMode(): TiberiusMode {
    return runtimeState.currentMode;
  }

  static isDrunkMode(): boolean {
    return (
      runtimeState.currentMode ===
      'drunk'
    );
  }

  static isThreatMode(): boolean {
    return (
      runtimeState.currentMode ===
      'threat'
    );
  }

  static isHumorMode(): boolean {
    return (
      runtimeState.currentMode ===
      'humor'
    );
  }

  static isSeriousMode(): boolean {
    return (
      runtimeState.currentMode ===
      'serious'
    );
  }

  static isNostalgicMode(): boolean {
    return (
      runtimeState.currentMode ===
      'nostalgic'
    );
  }

  static isPhilosophicalMode(): boolean {
    return (
      runtimeState.currentMode ===
      'philosophical'
    );
  }

  static isRomanMode(): boolean {
    return (
      runtimeState.currentMode ===
      'roman'
    );
  }

  static isNormalMode(): boolean {
    return (
      runtimeState.currentMode ===
      'normal'
    );
  }

  static getModeResponse(): string | null {
    const mode =
      runtimeState.currentMode;

    if (mode === 'normal') {
      return null;
    }

    const responses =
      config.tiberiusResponses.modes[
        mode
      ];

    if (
      !responses ||
      responses.length === 0
    ) {
      return null;
    }

    return responses[
      Math.floor(
        Math.random() *
          responses.length
      )
    ];
  }

  static resetToNormal(): void {
    this.clearModeTimeout();

    runtimeState.currentMode =
      'normal';

    console.log(
      'Modo do bot resetado para normal'
    );
  }

  private static clearModeTimeout(): void {
    if (this.modeTimeout) {
      clearTimeout(
        this.modeTimeout
      );

      this.modeTimeout = null;
    }
  }
}