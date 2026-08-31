export class ResponseValidator {
  static isResponseAppropriate(
    response: string,
    isAggressive: boolean,
    isCompliment: boolean
  ): boolean {
    const lowerResponse =
      response.toLowerCase();

    if (isAggressive) {
      const positiveWords = [
        'obrigado',
        'obrigada',
        'excelente',
        'incrível',
        'fantástico',
        'brilhante',
        'genial',
        'parabéns',
        'continua',
        'bom senso',
        'gosto',
        'favorito',
      ];

      const hasPositiveWords =
        positiveWords.some(word =>
          lowerResponse.includes(word)
        );

      if (hasPositiveWords) {
        return false;
      }
    }

    if (isCompliment) {
      const negativeWords = [
        'ameaça',
        'crime',
        'supervisão',
        'insolência',
        'compilando',
        'testemunha',
        'colaboração',
        'inferior',
        'insignificante',
        'desperdiçar',
      ];

      const hasNegativeWords =
        negativeWords.some(word =>
          lowerResponse.includes(word)
        );

      if (hasNegativeWords) {
        return false;
      }
    }

    return true;
  }

  static filterAppropriateResponses(
    responses: string[],
    isAggressive: boolean,
    isCompliment: boolean
  ): string[] {
    return responses.filter(
      response =>
        this.isResponseAppropriate(
          response,
          isAggressive,
          isCompliment
        )
    );
  }
}