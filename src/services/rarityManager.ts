import { config } from '../config/config';

export class RarityManager {
  static getRareResponse(): string | null {
    const rarityData =
      config.tiberiusResponses.rarity;

    if (
      !rarityData.very_rare ||
      rarityData.very_rare.length === 0
    ) {
      return null;
    }

    if (Math.random() >= 0.05) {
      return null;
    }

    const rareResponses =
      rarityData.very_rare;

    return rareResponses[
      Math.floor(
        Math.random() *
          rareResponses.length
      )
    ];
  }

  static getRandomRareResponse():
    string | null {
    const rarityData =
      config.tiberiusResponses.rarity;

    if (
      !rarityData.very_rare ||
      rarityData.very_rare.length === 0
    ) {
      return null;
    }

    const rareResponses =
      rarityData.very_rare;

    return rareResponses[
      Math.floor(
        Math.random() *
          rareResponses.length
      )
    ];
  }
}