import { config } from '../config/config';

export class RarityManager {
  static getRareResponse(): string | null {
    const rarityData = config.tiberiusResponses.rarity;
    if (!rarityData.very_rare || rarityData.very_rare.length === 0) {
      return null;
    }

    // 5% de chance de aparecer uma frase rara
    if (Math.random() < 0.05) {
      const rareResponses = rarityData.very_rare as string[];
      return rareResponses[Math.floor(Math.random() * rareResponses.length)];
    }

    return null;
  }

  static getRandomRareResponse(): string | null {
    const rarityData = config.tiberiusResponses.rarity;
    if (!rarityData.very_rare || rarityData.very_rare.length === 0) {
      return null;
    }

    const rareResponses = rarityData.very_rare as string[];
    return rareResponses[Math.floor(Math.random() * rareResponses.length)];
  }
}