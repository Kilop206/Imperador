export type MessageIntent =
  | 'aggressive'
  | 'compliment'
  | 'question'
  | 'greeting'
  | 'farewell'
  | 'humor'
  | 'serious'
  | 'nostalgic'
  | 'philosophical'
  | 'roman'
  | 'neutral';

export interface AnalyzedMessage {
  original: string;
  normalized: string;
  tokens: string[];
  intent: MessageIntent;
  isAggressive: boolean;
  isCompliment: boolean;
  isQuestion: boolean;
  hasSarcasm: boolean;
}

const aggressiveWords = [
  'matar', 'morre', 'morrer', 'mata', 'destruir', 'acabar',
  'fude', 'fuder', 'caralho', 'porra', 'merda', 'idiota',
  'burro', 'estúpido', 'retardado', 'imbecil', 'cu',
  'desgraça', 'nojento', 'nojo', 'lixo', 'fraquinho',
  'inútil', 'miserável', 'vergonha', 'patético', 'ridículo',
  'estúpida', 'estúpidos', 'burros', 'burras', 'merdas',
  'porras', 'caralhos', 'desgraças', 'lixos', 'inúteis',
  'miseráveis', 'vergonhas', 'patéticos', 'ridículos',
] as const;

const complimentWords = [
  'obrigado', 'obrigada', 'excelente', 'incrível', 'amazing',
  'melhor', 'ótimo', 'ótima', 'admirável', 'fantástico',
  'fantástica', 'brilhante', 'genial', 'parabéns',
  'congratulations', 'love', 'amo', 'adora', 'admirar',
  'respeito', 'respeitar', 'grato', 'grata', 'agradecido',
  'agradecida', 'maravilhoso', 'maravilhosa', 'perfeito',
  'perfeita', 'espetacular', 'formidável', 'excepcional',
  'extraordinário', 'extraordinária',
] as const;

const sarcasmIndicators = [
  'sarcasmo',
  'ironia',
  'irônico',
  'irônica',
  'ironic',
  'sarcástico',
  'sarcástica',
  'sarcasticamente',
  'ironicamente',
  '😏',
  '🙄',
] as const;

const humorWords = [
  'kkkk',
  'hahaha',
  'rsrs',
  'haha',
  'piada',
  'engraçado',
  'engraçada',
  'rir',
  'risada',
  'humor',
  'comédia',
  'zueira',
  'brincadeira',
  'lol',
  'lmao',
] as const;

const seriousWords = [
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

const nostalgicWords = [
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

const philosophicalWords = [
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

const romanWords = [
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

const greetingPatterns = [
  'oi',
  'ola',
  'olá',
  'bom dia',
  'boa tarde',
  'boa noite',
  'eae',
  'e aí',
  'eai',
  'salve',
] as const;

const farewellPatterns = [
  'tchau',
  'adeus',
  'até mais',
  'ate mais',
  'até logo',
  'ate logo',
  'falou',
  'flw',
  'fui',
] as const;

export class TextAnalyzer {
  static normalize(content: string): string {
    return content
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(
        /[^\p{L}\p{N}\s!?]/gu,
        ' '
      )
      .replace(/[!?]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static tokenize(content: string): string[] {
    const normalized =
      this.normalize(content);

    return normalized.length > 0
      ? normalized.split(' ')
      : [];
  }

  static containsAny(
    content: string,
    values: readonly string[]
  ): boolean {
    const normalizedContent =
      this.normalize(content);

    return values.some(value => {
      const normalizedValue =
        this.normalize(value);

      if (
        normalizedValue.includes(' ')
      ) {
        return normalizedContent.includes(
          normalizedValue
        );
      }

      return normalizedContent
        .split(' ')
        .some(token => token === normalizedValue);
    });
  }

  static isQuestion(content: string): boolean {
    const normalized =
      this.normalize(content);

    return (
      content.includes('?') ||
      normalized.startsWith('como ') ||
      normalized.startsWith('por que ') ||
      normalized.startsWith('porque ') ||
      normalized.startsWith('quando ') ||
      normalized.startsWith('onde ') ||
      normalized.startsWith('quem ') ||
      normalized.startsWith('qual ') ||
      normalized.startsWith('quais ') ||
      normalized.startsWith('quanto ') ||
      normalized.startsWith('quantos ') ||
      normalized.startsWith('quantas ')
    );
  }

  static isAggressive(content: string): boolean {
    return this.containsAny(
      content,
      aggressiveWords
    );
  }

  static isCompliment(content: string): boolean {
    if (this.isAggressive(content)) {
      return false;
    }

    if (this.hasSarcasm(content)) {
      return false;
    }

    return this.containsAny(
      content,
      complimentWords
    );
  }

  static hasSarcasm(content: string): boolean {
    return this.containsAny(
      content,
      sarcasmIndicators
    );
  }

  static detectIntent(content: string): MessageIntent {
    if (this.isAggressive(content)) {
      return 'aggressive';
    }

    if (this.isCompliment(content)) {
      return 'compliment';
    }

    const normalized =
      this.normalize(content);

    if (
      this.containsAny(
        normalized,
        philosophicalWords
      )
    ) {
      return 'philosophical';
    }

    if (
      this.containsAny(
        normalized,
        seriousWords
      )
    ) {
      return 'serious';
    }

    if (
      this.containsAny(
        normalized,
        nostalgicWords
      )
    ) {
      return 'nostalgic';
    }

    if (
      this.containsAny(
        normalized,
        romanWords
      )
    ) {
      return 'roman';
    }

    if (
      this.containsAny(
        normalized,
        humorWords
      )
    ) {
      return 'humor';
    }

    if (
      this.isQuestion(content)
    ) {
      return 'question';
    }

    if (
      this.containsAny(
        normalized,
        greetingPatterns
      )
    ) {
      return 'greeting';
    }

    if (
      this.containsAny(
        normalized,
        farewellPatterns
      )
    ) {
      return 'farewell';
    }

    return 'neutral';
  }

  static analyze(
    content: string
  ): AnalyzedMessage {
    return {
      original: content,
      normalized: this.normalize(content),
      tokens: this.tokenize(content),
      intent: this.detectIntent(content),
      isAggressive: this.isAggressive(content),
      isCompliment: this.isCompliment(content),
      isQuestion: this.isQuestion(content),
      hasSarcasm: this.hasSarcasm(content),
    };
  }
}