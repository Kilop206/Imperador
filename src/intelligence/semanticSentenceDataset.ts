export interface SemanticSentencePair {
  first: string;
  second: string;
  label: 0 | 1;
}

export const SEMANTIC_SENTENCE_DATASET: SemanticSentencePair[] = [
  {
    first: "Por que Roma caiu?",
    second: "Qual foi a causa da queda de Roma?",
    label: 1,
  },
  {
    first: "O que provocou a queda do Imperio Romano?",
    second: "Por quais motivos Roma entrou em decadencia?",
    label: 1,
  },
  {
    first: "Quem foi o responsavel pela queda de Roma?",
    second: "Quem contribuiu para a decadencia do Imperio Romano?",
    label: 1,
  },
  {
    first: "Como Roma entrou em decadencia?",
    second: "Como aconteceu a decadencia do Imperio Romano?",
    label: 1,
  },
  {
    first: "O Imperio Romano caiu por causa de guerras?",
    second: "As guerras ajudaram a provocar a queda de Roma?",
    label: 1,
  },
  {
    first: "O que aconteceu com Roma?",
    second: "Qual foi o destino do Imperio Romano?",
    label: 1,
  },
  {
    first: "Roma era um grande imperio?",
    second: "O Imperio Romano foi poderoso?",
    label: 1,
  },
  {
    first: "O exercito romano era importante?",
    second: "As forcas militares eram importantes para Roma?",
    label: 1,
  },
  {
    first: "Como programar um computador?",
    second: "Como escrever codigo em uma linguagem de programacao?",
    label: 1,
  },
  {
    first: "O que e inteligencia artificial?",
    second: "Como funciona a inteligencia artificial?",
    label: 1,
  },

  {
    first: "Por que Roma caiu?",
    second: "Como instalar memoria RAM?",
    label: 0,
  },
  {
    first: "Qual foi a causa da queda de Roma?",
    second: "Como programar em JavaScript?",
    label: 0,
  },
  {
    first: "O que provocou a decadencia do Imperio Romano?",
    second: "Qual computador devo comprar?",
    label: 0,
  },
  {
    first: "Quem contribuiu para a queda de Roma?",
    second: "Como configurar uma rede Wi-Fi?",
    label: 0,
  },
  {
    first: "O exercito romano era importante?",
    second: "Como funciona um banco de dados?",
    label: 0,
  },
  {
    first: "Roma era um grande imperio?",
    second: "Como criar uma API REST?",
    label: 0,
  },
  {
    first: "Como aconteceu a decadencia do Imperio Romano?",
    second: "Qual linguagem de programacao devo aprender?",
    label: 0,
  },
  {
    first: "As guerras ajudaram a provocar a queda de Roma?",
    second: "Como funciona uma placa de video?",
    label: 0,
  },
  {
    first: "Como programar um computador?",
    second: "Quem foi Julio Cesar?",
    label: 0,
  },
  {
    first: "O que e inteligencia artificial?",
    second: "Qual foi a capital do Imperio Romano?",
    label: 0,
  },
];