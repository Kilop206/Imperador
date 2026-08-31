export type TiberiusMode =
  | 'normal'
  | 'drunk'
  | 'threat'
  | 'humor'
  | 'serious'
  | 'nostalgic'
  | 'philosophical'
  | 'roman';

export type SpontaneousCategory =
  | 'imperial'
  | 'arrogant';

export type ResponseValue =
  | string
  | string[];

export interface TiberiusResponses {
  spontaneous: Record<
    SpontaneousCategory,
    string[]
  >;

  keywords: Record<
    string,
    ResponseValue
  >;

  context: Record<
    string,
    string[]
  >;

  frequency: Record<
    string,
    Record<string, string[]>
  >;

  rarity: {
    very_rare: string[];
  };

  modes: Partial<
    Record<
      Exclude<TiberiusMode, 'normal'>,
      string[]
    >
  >;

  compliments: string[];
}