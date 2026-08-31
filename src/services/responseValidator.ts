export class ResponseValidator {
  // Verifica se a resposta é apropriada para o contexto
  static isResponseAppropriate(response: string, isAggressive: boolean, isCompliment: boolean): boolean {
    const lowerResponse = response.toLowerCase();
    
    // Se a mensagem é agressiva, resposta não deve ser de elogio
    if (isAggressive) {
      const positiveWords = ['obrigado', 'excelente', 'incrível', 'fantástico', 'brilhante', 'genial', 'parabéns', 'continua', 'bom senso', 'gosto', 'favorito'];
      const hasPositiveWords = positiveWords.some(word => lowerResponse.includes(word));
      if (hasPositiveWords) {
        return false;
      }
    }
    
    // Se a mensagem é elogio, resposta não deve ser agressiva
    if (isCompliment) {
      const negativeWords = ['ameaça', 'crime', 'supervisão', 'insolência', 'compilando', 'testemunha', 'colaboração', 'inferior', 'insignificante', 'desperdiçar'];
      const hasNegativeWords = negativeWords.some(word => lowerResponse.includes(word));
      if (hasNegativeWords) {
        return false;
      }
    }
    
    return true;
  }
  
  // Filtra respostas inapropriadas de um array
  static filterAppropriateResponses(responses: string[], isAggressive: boolean, isCompliment: boolean): string[] {
    return responses.filter(response => 
      this.isResponseAppropriate(response, isAggressive, isCompliment)
    );
  }
}