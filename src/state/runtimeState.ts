import { TiberiusMode } from '../types/tiberius';

export const runtimeState = {
  currentMode: 'normal' as TiberiusMode,

  wordFrequency: new Map<string, number>(),

  aggressiveMessageCount: 0,

  triggerCounts: new Map<string, number>(),

  lastTriggerTime: new Map<string, number>(),
};

export function resetRuntimeState(): void {
  runtimeState.currentMode = 'normal';

  runtimeState.wordFrequency.clear();

  runtimeState.aggressiveMessageCount = 0;

  runtimeState.triggerCounts.clear();

  runtimeState.lastTriggerTime.clear();
}