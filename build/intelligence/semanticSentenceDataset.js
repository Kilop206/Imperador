"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SEMANTIC_TRAINING_DATASET = exports.SEMANTIC_SENTENCE_DATASET = void 0;
exports.SEMANTIC_SENTENCE_DATASET = [
    // ============================================================
    // HISTÓRIA — POSITIVOS
    // ============================================================
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
        first: "Quem foi responsavel pela queda de Roma?",
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
        first: "Julio Cesar liderou os romanos?",
        second: "Julio Cesar foi um lider de Roma?",
        label: 1,
    },
    {
        first: "Roma foi uma grande potencia?",
        second: "O Imperio Romano teve grande poder?",
        label: 1,
    },
    // ============================================================
    // TECNOLOGIA — POSITIVOS
    // ============================================================
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
        first: "Como criar uma API?",
        second: "Como desenvolver uma API para uma aplicacao?",
        label: 1,
    },
    {
        first: "Como armazenar dados?",
        second: "Como salvar informacoes em um banco de dados?",
        label: 1,
    },
    {
        first: "O que e um banco de dados?",
        second: "Para que serve um sistema de armazenamento de dados?",
        label: 1,
    },
    {
        first: "Como funciona uma rede?",
        second: "Como computadores trocam dados por uma rede?",
        label: 1,
    },
    {
        first: "O que e programacao?",
        second: "O que significa escrever software?",
        label: 1,
    },
    {
        first: "Como funciona um algoritmo?",
        second: "Como um algoritmo resolve um problema?",
        label: 1,
    },
    {
        first: "Como instalar um programa?",
        second: "Como colocar um software no computador?",
        label: 1,
    },
    {
        first: "O que e aprendizado de maquina?",
        second: "Como funciona machine learning?",
        label: 1,
    },
    // ============================================================
    // PERGUNTAS — POSITIVOS
    // ============================================================
    {
        first: "Por que as pessoas estudam?",
        second: "Qual e o motivo para estudar?",
        label: 1,
    },
    {
        first: "Como resolver esse problema?",
        second: "Qual e a maneira de solucionar essa questao?",
        label: 1,
    },
    {
        first: "O que isso significa?",
        second: "Qual e o significado disso?",
        label: 1,
    },
    {
        first: "Quando isso aconteceu?",
        second: "Em que momento isso ocorreu?",
        label: 1,
    },
    {
        first: "Onde aconteceu a batalha?",
        second: "Em qual lugar ocorreu a batalha?",
        label: 1,
    },
    // ============================================================
    // GENERICAMENTE RELACIONADAS — POSITIVOS
    // ============================================================
    {
        first: "O computador ficou lento.",
        second: "A maquina esta com baixo desempenho.",
        label: 1,
    },
    {
        first: "O programa apresentou um erro.",
        second: "O software encontrou uma falha.",
        label: 1,
    },
    {
        first: "A rede caiu.",
        second: "A conexao foi interrompida.",
        label: 1,
    },
    {
        first: "Ele ficou muito irritado.",
        second: "Ele demonstrou grande raiva.",
        label: 1,
    },
    {
        first: "Estou muito feliz.",
        second: "Estou bastante contente.",
        label: 1,
    },
    // ============================================================
    // HISTÓRIA — NEGATIVOS
    // ============================================================
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
    // ============================================================
    // TECNOLOGIA — NEGATIVOS
    // ============================================================
    {
        first: "Como criar uma API?",
        second: "Quem foi Julio Cesar?",
        label: 0,
    },
    {
        first: "Como armazenar dados?",
        second: "Por que Roma entrou em decadencia?",
        label: 0,
    },
    {
        first: "Como funciona uma rede?",
        second: "Como morreu Julio Cesar?",
        label: 0,
    },
    {
        first: "O que e programacao?",
        second: "Quando caiu o Imperio Romano?",
        label: 0,
    },
    {
        first: "Como funciona um algoritmo?",
        second: "Qual foi a causa da queda de Roma?",
        label: 0,
    },
    {
        first: "O que e um banco de dados?",
        second: "Como era o exercito romano?",
        label: 0,
    },
    {
        first: "Como instalar um programa?",
        second: "Quem governou Roma?",
        label: 0,
    },
    {
        first: "O que e aprendizado de maquina?",
        second: "Onde aconteceu uma batalha romana?",
        label: 0,
    },
    // ============================================================
    // GENERICAMENTE NEGATIVOS
    // ============================================================
    {
        first: "O computador ficou lento.",
        second: "Julio Cesar foi um lider romano.",
        label: 0,
    },
    {
        first: "A rede caiu.",
        second: "Roma entrou em decadencia.",
        label: 0,
    },
    {
        first: "Estou muito feliz.",
        second: "O banco de dados possui dez tabelas.",
        label: 0,
    },
    {
        first: "Ele ficou muito irritado.",
        second: "Como instalar um programa?",
        label: 0,
    },
    {
        first: "O programa apresentou um erro.",
        second: "Qual foi a capital do Imperio Romano?",
        label: 0,
    },
];
exports.SEMANTIC_TRAINING_DATASET = [
    ...exports.SEMANTIC_SENTENCE_DATASET,
];
