import {
  WordEmbeddingModel,
} from "./wordEmbeddingModel";

import type {
  SemanticSentencePair,
} from "./semanticSentenceDataset";

export interface SemanticSentenceModelOptions {
  outputDimension?: number;
  learningRate?: number;
  epochs?: number;
  margin?: number;
  seed?: number;
}

export interface SemanticSentenceModelData {
  inputDimension: number;
  outputDimension: number;
  projection: number[][];
  learningRate: number;
  epochs: number;
  margin: number;
}

export interface SemanticSentenceTrainingResult {
  pairCount: number;
  epochs: number;
  finalLoss: number;
  positivePairs: number;
  negativePairs: number;
}

class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    this.state =
      (this.state * 1664525 + 1013904223) >>> 0;

    return this.state / 4294967296;
  }

  public nextSigned(): number {
    return this.next() * 2 - 1;
  }
}

export class SemanticSentenceModel {
  private readonly outputDimension: number;
  private readonly learningRate: number;
  private readonly epochs: number;
  private readonly margin: number;
  private readonly seed: number;

  private inputDimension = 0;
  private projection: number[][] = [];
  private trained = false;

  constructor(
    options: SemanticSentenceModelOptions = {},
  ) {
    this.outputDimension = Math.max(
      2,
      Math.floor(options.outputDimension ?? 16),
    );

    this.learningRate = Math.max(
      0.00001,
      options.learningRate ?? 0.02,
    );

    this.epochs = Math.max(
      1,
      Math.floor(options.epochs ?? 50),
    );

    this.margin = Math.max(
      0.01,
      Math.min(1, options.margin ?? 0.4),
    );

    this.seed = Math.floor(
      options.seed ?? 42,
    );
  }

  public train(
    wordModel: WordEmbeddingModel,
    dataset: SemanticSentencePair[],
  ): SemanticSentenceTrainingResult {
    if (!wordModel.isTrained()) {
      throw new Error(
        "O WordEmbeddingModel precisa estar treinado antes do modelo semântico.",
      );
    }

    if (!Array.isArray(dataset)) {
      throw new TypeError(
        "dataset deve ser um array.",
      );
    }

    const validPairs = dataset.filter(
      (pair): pair is SemanticSentencePair =>
        typeof pair?.first === "string" &&
        pair.first.trim().length > 0 &&
        typeof pair?.second === "string" &&
        pair.second.trim().length > 0 &&
        (pair.label === 0 || pair.label === 1),
    );

    if (validPairs.length === 0) {
      throw new Error(
        "Não existem pares válidos para treinamento.",
      );
    }

    const preparedPairs = validPairs
      .map((pair) => ({
        first: wordModel.encodeText(pair.first),
        second: wordModel.encodeText(pair.second),
        label: pair.label,
      }))
      .filter(
        (pair) =>
          !this.isZeroVector(pair.first) &&
          !this.isZeroVector(pair.second),
      );

    if (preparedPairs.length === 0) {
      throw new Error(
        "Nenhum par possui palavras conhecidas pelo modelo de embeddings.",
      );
    }

    this.inputDimension =
      wordModel.getDimension();

    this.initializeProjection();

    let finalLoss = 0;

    const positivePairs = preparedPairs.filter(
      (pair) => pair.label === 1,
    ).length;

    const negativePairs = preparedPairs.filter(
      (pair) => pair.label === 0,
    ).length;

    for (
      let epoch = 0;
      epoch < this.epochs;
      epoch += 1
    ) {
      let epochLoss = 0;

      for (const pair of preparedPairs) {
        epochLoss += this.trainPair(
          pair.first,
          pair.second,
          pair.label,
        );
      }

      finalLoss =
        epochLoss /
        Math.max(1, preparedPairs.length);
    }

    this.trained = true;

    return {
      pairCount: preparedPairs.length,
      epochs: this.epochs,
      finalLoss,
      positivePairs,
      negativePairs,
    };
  }

  public encode(
    wordModel: WordEmbeddingModel,
    text: string,
  ): number[] {
    this.ensureTrained();

    if (!wordModel.isTrained()) {
      throw new Error(
        "O WordEmbeddingModel precisa estar treinado.",
      );
    }

    const baseVector =
      wordModel.encodeText(text);

    if (this.isZeroVector(baseVector)) {
      return new Array<number>(
        this.outputDimension,
      ).fill(0);
    }

    const projected =
      this.multiplyProjection(baseVector);

    return this.normalizeVector(projected);
  }

  public similarity(
    wordModel: WordEmbeddingModel,
    first: string,
    second: string,
  ): number {
    const firstVector =
      this.encode(wordModel, first);

    const secondVector =
      this.encode(wordModel, second);

    return SemanticSentenceModel.cosineSimilarity(
      firstVector,
      secondVector,
    );
  }

  public getInputDimension(): number {
    return this.inputDimension;
  }

  public getOutputDimension(): number {
    return this.outputDimension;
  }

  public isTrained(): boolean {
    return this.trained;
  }

  public exportModel(): SemanticSentenceModelData {
    this.ensureTrained();

    return {
      inputDimension: this.inputDimension,
      outputDimension: this.outputDimension,
      projection: this.projection.map(
        (row) => [...row],
      ),
      learningRate: this.learningRate,
      epochs: this.epochs,
      margin: this.margin,
    };
  }

  public importModel(
    model: SemanticSentenceModelData,
  ): this {
    if (
      !model ||
      typeof model.inputDimension !== "number" ||
      typeof model.outputDimension !== "number" ||
      !Array.isArray(model.projection)
    ) {
      throw new TypeError(
        "Modelo semântico inválido.",
      );
    }

    if (
      model.outputDimension !==
      this.outputDimension
    ) {
      throw new Error(
        "A dimensão de saída do modelo não corresponde à configuração atual.",
      );
    }

    if (
      model.projection.length !==
      this.outputDimension
    ) {
      throw new Error(
        "A matriz de projeção possui dimensão inválida.",
      );
    }

    for (
      const row of model.projection
    ) {
      if (
        !Array.isArray(row) ||
        row.length !== model.inputDimension
      ) {
        throw new Error(
          "A matriz de projeção possui linhas inválidas.",
        );
      }
    }

    this.inputDimension =
      model.inputDimension;

    this.projection =
      model.projection.map(
        (row) => [...row],
      );

    this.trained = true;

    return this;
  }

  public reset(): void {
    this.inputDimension = 0;
    this.projection = [];
    this.trained = false;
  }

  public static cosineSimilarity(
    first: number[],
    second: number[],
  ): number {
    if (first.length !== second.length) {
      throw new Error(
        "Os vetores precisam possuir a mesma dimensão.",
      );
    }

    let dotProduct = 0;
    let firstMagnitude = 0;
    let secondMagnitude = 0;

    for (
      let index = 0;
      index < first.length;
      index += 1
    ) {
      dotProduct +=
        first[index] * second[index];

      firstMagnitude +=
        first[index] ** 2;

      secondMagnitude +=
        second[index] ** 2;
    }

    if (
      firstMagnitude === 0 ||
      secondMagnitude === 0
    ) {
      return 0;
    }

    return (
      dotProduct /
      (Math.sqrt(firstMagnitude) *
        Math.sqrt(secondMagnitude))
    );
  }

  private initializeProjection(): void {
    const random =
      new SeededRandom(this.seed);

    this.projection =
      new Array(this.outputDimension)
        .fill(null)
        .map((_, outputIndex) =>
          new Array<number>(
            this.inputDimension,
          )
            .fill(0)
            .map((_, inputIndex) => {
              if (
                outputIndex === inputIndex
              ) {
                return 1;
              }

              return (
                random.nextSigned() * 0.01
              );
            }),
        );
  }

  private trainPair(
    first: number[],
    second: number[],
    label: 0 | 1,
  ): number {
    const firstProjected =
      this.multiplyProjection(first);

    const secondProjected =
      this.multiplyProjection(second);

    const similarity =
      SemanticSentenceModel.cosineSimilarity(
        firstProjected,
        secondProjected,
      );

    if (
      label === 0 &&
      similarity <= this.margin
    ) {
      return 0;
    }

    const difference =
      label === 1
        ? similarity - 1
        : similarity - this.margin;

    const loss =
      difference ** 2;

    const derivative =
      2 * difference;

    const firstGradient =
      this.cosineGradient(
        firstProjected,
        secondProjected,
      );

    const secondGradient =
      this.cosineGradient(
        secondProjected,
        firstProjected,
      );

    const firstScale =
      derivative;

    const secondScale =
      derivative;

    for (
      let output = 0;
      output < this.outputDimension;
      output += 1
    ) {
      for (
        let input = 0;
        input < this.inputDimension;
        input += 1
      ) {
        const firstUpdate =
          firstScale *
          firstGradient[output] *
          first[input];

        const secondUpdate =
          secondScale *
          secondGradient[output] *
          second[input];

        this.projection[output][input] -=
          this.learningRate *
          (firstUpdate + secondUpdate);
      }
    }

    return loss;
  }

  private cosineGradient(
    first: number[],
    second: number[],
  ): number[] {
    let firstMagnitudeSquared = 0;
    let secondMagnitudeSquared = 0;
    let dotProduct = 0;

    for (
      let index = 0;
      index < first.length;
      index += 1
    ) {
      firstMagnitudeSquared +=
        first[index] ** 2;

      secondMagnitudeSquared +=
        second[index] ** 2;

      dotProduct +=
        first[index] * second[index];
    }

    if (
      firstMagnitudeSquared === 0 ||
      secondMagnitudeSquared === 0
    ) {
      return new Array<number>(
        first.length,
      ).fill(0);
    }

    const firstMagnitude =
      Math.sqrt(firstMagnitudeSquared);

    const secondMagnitude =
      Math.sqrt(secondMagnitudeSquared);

    const denominator =
      firstMagnitude *
      secondMagnitude;

    const gradient =
      new Array<number>(
        first.length,
      ).fill(0);

    for (
      let index = 0;
      index < first.length;
      index += 1
    ) {
      gradient[index] =
        second[index] / denominator -
        (
          dotProduct *
          first[index]
        ) /
          (
            firstMagnitudeSquared *
            denominator
          );
    }

    return gradient;
  }

  private multiplyProjection(
    vector: number[],
  ): number[] {
    if (
      vector.length !==
      this.inputDimension
    ) {
      throw new Error(
        "A dimensão do vetor de entrada não corresponde ao modelo.",
      );
    }

    const result =
      new Array<number>(
        this.outputDimension,
      ).fill(0);

    for (
      let output = 0;
      output < this.outputDimension;
      output += 1
    ) {
      for (
        let input = 0;
        input < this.inputDimension;
        input += 1
      ) {
        result[output] +=
          this.projection[output][input] *
          vector[input];
      }
    }

    return result;
  }

  private normalizeVector(
    vector: number[],
  ): number[] {
    let magnitude = 0;

    for (const value of vector) {
      magnitude += value ** 2;
    }

    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) {
      return [...vector];
    }

    return vector.map(
      (value) => value / magnitude,
    );
  }

  private isZeroVector(
    vector: number[],
  ): boolean {
    return vector.every(
      (value) => value === 0,
    );
  }

  private ensureTrained(): void {
    if (!this.trained) {
      throw new Error(
        "O modelo semântico ainda não foi treinado.",
      );
    }
  }
}