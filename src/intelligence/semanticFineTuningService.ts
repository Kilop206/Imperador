import {
  SemanticSentenceModel,
  type SemanticSentenceModelData,
  type SemanticSentenceModelOptions,
} from "./semanticSentenceModel";

import {
  WordEmbeddingModel,
} from "./wordEmbeddingModel";

import {
  SemanticDataAugmentationService,
  type SemanticAugmentationOptions,
} from "./semanticDataAugmentation";

import {
  HardNegativeMiningService,
  type HardNegativeExample,
} from "./hardNegativeMiningService";

import {
  evaluateNeural,
  type SemanticEvaluationMetrics,
} from "./semanticEvaluation";

import type {
  SemanticSentencePair,
} from "./semanticSentenceDataset";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticModelVersion {
  version: number;
  createdAt: number;
  datasetSize: number;
  trainingPairs: number;
  validationScore: number;
  testScore: number;
  active: boolean;
  modelData: SemanticSentenceModelData;
}

export interface SemanticFineTuningInput {
  /** Pares originais do dataset (não serão modificados). */
  originalDataset: SemanticSentencePair[];
  /** Subconjunto de validação para comparar modelos. */
  validationDataset: SemanticSentencePair[];
  /** Subconjunto de teste para avaliação final do modelo ativado. */
  testDataset: SemanticSentencePair[];
  /** Hard negatives já minerados (opcionais). */
  hardNegatives?: HardNegativeExample[];
  /** Opções de augmentation aplicadas sobre o conjunto combinado. */
  augmentationOptions?: SemanticAugmentationOptions;
  /** Opções do SemanticSentenceModel para o novo treino. */
  modelOptions?: SemanticSentenceModelOptions;
  /** Threshold de similaridade usado na avaliação (padrão 0.5). */
  threshold?: number;
}

export interface SemanticFineTuningResult {
  /** Versão do modelo candidato gerado. */
  candidateVersion: number;
  /** Métricas no conjunto de validação do modelo anterior ativo. */
  previousValidationMetrics: SemanticEvaluationMetrics;
  /** Métricas no conjunto de validação do novo modelo. */
  candidateValidationMetrics: SemanticEvaluationMetrics;
  /** Métricas no conjunto de teste do novo modelo (somente se ativado). */
  candidateTestMetrics: SemanticEvaluationMetrics | null;
  /** Quantos exemplos originais foram usados. */
  originalPairs: number;
  /** Quantos hard negatives foram incluídos. */
  hardNegativePairs: number;
  /** Quantos exemplos augmentados foram gerados. */
  augmentedPairs: number;
  /** Total de pares de treino. */
  totalTrainingPairs: number;
  /** Se o novo modelo foi ativado (F1 validação melhorou ou era zero). */
  activated: boolean;
  /** Motivo da decisão. */
  reason: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry de versões
// ─────────────────────────────────────────────────────────────────────────────

export class SemanticModelRegistry {
  private versions: SemanticModelVersion[] = [];
  private nextVersion = 1;

  /**
   * Registra uma nova versão.  Não ativa automaticamente — a decisão
   * de ativar pertence ao SemanticFineTuningService.
   */
  public register(
    modelData: SemanticSentenceModelData,
    metrics: {
      datasetSize: number;
      trainingPairs: number;
      validationScore: number;
      testScore: number;
    },
  ): SemanticModelVersion {
    const version: SemanticModelVersion = {
      version: this.nextVersion,
      createdAt: Date.now(),
      datasetSize: metrics.datasetSize,
      trainingPairs: metrics.trainingPairs,
      validationScore: metrics.validationScore,
      testScore: metrics.testScore,
      active: false,
      modelData: {
        inputDimension: modelData.inputDimension,
        outputDimension: modelData.outputDimension,
        projection: modelData.projection.map((row) => [...row]),
        learningRate: modelData.learningRate,
        epochs: modelData.epochs,
        margin: modelData.margin,
      },
    };

    this.versions.push(version);
    this.nextVersion += 1;

    return version;
  }

  /**
   * Ativa uma versão específica, desativando todas as outras.
   * Retorna false se a versão não existir.
   */
  public activate(version: number): boolean {
    const target = this.versions.find(
      (v) => v.version === version,
    );

    if (!target) {
      return false;
    }

    for (const v of this.versions) {
      v.active = false;
    }

    target.active = true;

    return true;
  }

  /**
   * Retorna a versão atualmente ativa, ou null se nenhuma.
   */
  public getActive(): SemanticModelVersion | null {
    return (
      this.versions.find((v) => v.active) ??
      null
    );
  }

  /**
   * Retorna todas as versões registradas (cópias).
   */
  public getAll(): SemanticModelVersion[] {
    return this.versions.map((v) => ({
      ...v,
      modelData: {
        ...v.modelData,
        projection: v.modelData.projection.map(
          (row) => [...row],
        ),
      },
    }));
  }

  /**
   * Retorna a versão com melhor F1 de validação.
   */
  public getBest(): SemanticModelVersion | null {
    if (this.versions.length === 0) {
      return null;
    }

    return this.versions.reduce(
      (best, current) =>
        current.validationScore >
        best.validationScore
          ? current
          : best,
    );
  }

  /**
   * Retorna metadados de uma versão sem o modelData completo.
   */
  public getSummary(): Array<{
    version: number;
    createdAt: number;
    datasetSize: number;
    trainingPairs: number;
    validationScore: number;
    testScore: number;
    active: boolean;
  }> {
    return this.versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      datasetSize: v.datasetSize,
      trainingPairs: v.trainingPairs,
      validationScore: v.validationScore,
      testScore: v.testScore,
      active: v.active,
    }));
  }

  /**
   * Reconstrói um SemanticSentenceModel a partir de uma versão registrada.
   */
  public restoreModel(
    version: number,
  ): SemanticSentenceModel | null {
    const entry = this.versions.find(
      (v) => v.version === version,
    );

    if (!entry) {
      return null;
    }

    const model = new SemanticSentenceModel({
      outputDimension: entry.modelData.outputDimension,
      learningRate: entry.modelData.learningRate,
      epochs: entry.modelData.epochs,
      margin: entry.modelData.margin,
    });

    model.importModel(entry.modelData);

    return model;
  }

  /**
   * Exporta o registry para persistência.
   */
  public exportData(): {
    versions: SemanticModelVersion[];
    nextVersion: number;
  } {
    return {
      versions: this.getAll(),
      nextVersion: this.nextVersion,
    };
  }

  /**
   * Importa o registry de dados persistidos.
   */
  public importData(data: {
    versions: SemanticModelVersion[];
    nextVersion: number;
  }): this {
    if (
      !data ||
      !Array.isArray(data.versions) ||
      typeof data.nextVersion !== "number"
    ) {
      throw new TypeError(
        "Dados de registry inválidos.",
      );
    }

    this.versions = data.versions.map((v) => ({
      version: v.version,
      createdAt: v.createdAt,
      datasetSize: v.datasetSize,
      trainingPairs: v.trainingPairs,
      validationScore: v.validationScore,
      testScore: v.testScore,
      active: v.active,
      modelData: {
        inputDimension: v.modelData.inputDimension,
        outputDimension: v.modelData.outputDimension,
        projection: v.modelData.projection.map(
          (row) => [...row],
        ),
        learningRate: v.modelData.learningRate,
        epochs: v.modelData.epochs,
        margin: v.modelData.margin,
      },
    }));

    this.nextVersion = data.nextVersion;

    return this;
  }

  public getVersionCount(): number {
    return this.versions.length;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Serviço de Fine-Tuning
// ─────────────────────────────────────────────────────────────────────────────

export class SemanticFineTuningService {
  private readonly registry: SemanticModelRegistry;
  private readonly augmentation: SemanticDataAugmentationService;

  constructor(registry?: SemanticModelRegistry) {
    this.registry =
      registry ?? new SemanticModelRegistry();
    this.augmentation =
      new SemanticDataAugmentationService();
  }

  /**
   * Executa um ciclo completo de fine-tuning:
   *
   * 1. Combina dataset original + hard negatives.
   * 2. Aplica data augmentation.
   * 3. Treina novo modelo.
   * 4. Avalia no conjunto de validação.
   * 5. Compara com o modelo atualmente ativo.
   * 6. Ativa o novo modelo se for melhor (F1 validação).
   *    - Se não houver modelo ativo, ativa automaticamente.
   * 7. Avalia no conjunto de teste apenas se o modelo for ativado.
   * 8. Registra a versão no registry.
   */
  public fineTune(
    wordModel: WordEmbeddingModel,
    input: SemanticFineTuningInput,
  ): SemanticFineTuningResult {
    this.validateInput(input);

    // ── 1. Combinar dataset ───────────────────────────────────────────────────

    const hardNegativePairs =
      this.extractHardNegatives(
        input.hardNegatives,
      );

    const combined: SemanticSentencePair[] = [
      ...input.originalDataset,
      ...hardNegativePairs,
    ];

    // ── 2. Augmentation ───────────────────────────────────────────────────────

    const augmented = this.augmentation.augment(
      combined,
      input.augmentationOptions,
    );

    const trainingDataset = augmented.examples;

    const augmentedPairs =
      augmented.augmentedCount;

    // ── 3. Treinar novo modelo ─────────────────────────────────────────────────

    const newModel = new SemanticSentenceModel(
      input.modelOptions,
    );

    newModel.train(wordModel, trainingDataset);

    // ── 4. Métricas do modelo anterior ────────────────────────────────────────

    const threshold = input.threshold ?? 0.5;

    const previousValidationMetrics =
      this.evaluatePrevious(
        wordModel,
        input.validationDataset,
        threshold,
      );

    // ── 5. Métricas do novo modelo ────────────────────────────────────────────

    const candidateValidationMetrics =
      evaluateNeural(
        wordModel,
        newModel,
        input.validationDataset,
        threshold,
      );

    // ── 6. Decisão de ativação ────────────────────────────────────────────────

    const { activated, reason } =
      this.shouldActivate(
        previousValidationMetrics,
        candidateValidationMetrics,
      );

    // ── 7. Teste (somente se ativado) ─────────────────────────────────────────

    let candidateTestMetrics: SemanticEvaluationMetrics | null =
      null;

    if (activated) {
      candidateTestMetrics = evaluateNeural(
        wordModel,
        newModel,
        input.testDataset,
        threshold,
      );
    }

    // ── 8. Registrar versão ───────────────────────────────────────────────────

    const registeredVersion = this.registry.register(
      newModel.exportModel(),
      {
        datasetSize:
          input.originalDataset.length +
          hardNegativePairs.length,
        trainingPairs: trainingDataset.length,
        validationScore: candidateValidationMetrics.f1,
        testScore:
          candidateTestMetrics?.f1 ?? 0,
      },
    );

    if (activated) {
      this.registry.activate(
        registeredVersion.version,
      );
    }

    return {
      candidateVersion: registeredVersion.version,
      previousValidationMetrics,
      candidateValidationMetrics,
      candidateTestMetrics,
      originalPairs: input.originalDataset.length,
      hardNegativePairs: hardNegativePairs.length,
      augmentedPairs,
      totalTrainingPairs: trainingDataset.length,
      activated,
      reason,
    };
  }

  /**
   * Retorna o registry de versões.
   */
  public getRegistry(): SemanticModelRegistry {
    return this.registry;
  }

  /**
   * Formata o resultado do fine-tuning como relatório legível.
   */
  public formatResult(
    result: SemanticFineTuningResult,
  ): string {
    const lines: string[] = [
      "=== Fine-Tuning Semântico ===",
      `Versão candidata: ${result.candidateVersion}`,
      `Dataset original: ${result.originalPairs} pares`,
      `Hard negatives: ${result.hardNegativePairs} pares`,
      `Augmentation: +${result.augmentedPairs} pares`,
      `Total treino: ${result.totalTrainingPairs} pares`,
      "",
      "--- Validação: Modelo Anterior ---",
      `F1: ${result.previousValidationMetrics.f1.toFixed(4)}`,
      `Accuracy: ${result.previousValidationMetrics.accuracy.toFixed(4)}`,
      "",
      "--- Validação: Modelo Candidato ---",
      `F1: ${result.candidateValidationMetrics.f1.toFixed(4)}`,
      `Accuracy: ${result.candidateValidationMetrics.accuracy.toFixed(4)}`,
      `Precision: ${result.candidateValidationMetrics.precision.toFixed(4)}`,
      `Recall: ${result.candidateValidationMetrics.recall.toFixed(4)}`,
    ];

    if (result.candidateTestMetrics) {
      lines.push(
        "",
        "--- Teste: Modelo Candidato ---",
        `F1: ${result.candidateTestMetrics.f1.toFixed(4)}`,
        `Accuracy: ${result.candidateTestMetrics.accuracy.toFixed(4)}`,
        `Precision: ${result.candidateTestMetrics.precision.toFixed(4)}`,
        `Recall: ${result.candidateTestMetrics.recall.toFixed(4)}`,
      );
    }

    lines.push(
      "",
      `Decisão: ${result.activated ? "✅ ATIVADO" : "❌ REJEITADO"}`,
      `Motivo: ${result.reason}`,
    );

    return lines.join("\n");
  }

  // ─── Métodos privados ───────────────────────────────────────────────────────

  private validateInput(
    input: SemanticFineTuningInput,
  ): void {
    if (!Array.isArray(input.originalDataset)) {
      throw new TypeError(
        "originalDataset deve ser um array.",
      );
    }

    if (!Array.isArray(input.validationDataset)) {
      throw new TypeError(
        "validationDataset deve ser um array.",
      );
    }

    if (!Array.isArray(input.testDataset)) {
      throw new TypeError(
        "testDataset deve ser um array.",
      );
    }

    if (input.originalDataset.length === 0) {
      throw new Error(
        "originalDataset não pode estar vazio.",
      );
    }

    if (input.validationDataset.length === 0) {
      throw new Error(
        "validationDataset não pode estar vazio.",
      );
    }

    if (input.testDataset.length === 0) {
      throw new Error(
        "testDataset não pode estar vazio.",
      );
    }
  }

  private extractHardNegatives(
    hardNegatives?: HardNegativeExample[],
  ): SemanticSentencePair[] {
    if (
      !hardNegatives ||
      hardNegatives.length === 0
    ) {
      return [];
    }

    const miningService =
      new HardNegativeMiningService();

    miningService.importData(hardNegatives);

    return miningService.toTrainingExamples();
  }

  private evaluatePrevious(
    wordModel: WordEmbeddingModel,
    validationDataset: SemanticSentencePair[],
    threshold: number,
  ): SemanticEvaluationMetrics {
    const active = this.registry.getActive();

    if (!active) {
      // Nenhum modelo ativo: retorna métricas zero como baseline
      return emptyMetrics(validationDataset);
    }

    const previousModel = new SemanticSentenceModel(
      {
        outputDimension: active.modelData.outputDimension,
        learningRate: active.modelData.learningRate,
        epochs: active.modelData.epochs,
        margin: active.modelData.margin,
      },
    );

    previousModel.importModel(active.modelData);

    return evaluateNeural(
      wordModel,
      previousModel,
      validationDataset,
      threshold,
    );
  }

  private shouldActivate(
    previous: SemanticEvaluationMetrics,
    candidate: SemanticEvaluationMetrics,
  ): { activated: boolean; reason: string } {
    // Se não havia modelo anterior (F1 zero), ativa automaticamente
    if (previous.f1 === 0) {
      return {
        activated: true,
        reason:
          "Nenhum modelo anterior. Primeiro modelo ativado automaticamente.",
      };
    }

    if (candidate.f1 > previous.f1) {
      return {
        activated: true,
        reason: `F1 melhorou de ${previous.f1.toFixed(4)} para ${candidate.f1.toFixed(4)}.`,
      };
    }

    if (candidate.f1 === previous.f1) {
      return {
        activated: false,
        reason: `F1 igual (${candidate.f1.toFixed(4)}). Modelo anterior mantido.`,
      };
    }

    return {
      activated: false,
      reason: `F1 piorou de ${previous.f1.toFixed(4)} para ${candidate.f1.toFixed(4)}. Modelo rejeitado.`,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários internos
// ─────────────────────────────────────────────────────────────────────────────

function emptyMetrics(
  dataset: SemanticSentencePair[],
): SemanticEvaluationMetrics {
  const positiveCount = dataset.filter(
    (p) => p.label === 1,
  ).length;

  const negativeCount = dataset.filter(
    (p) => p.label === 0,
  ).length;

  return {
    total: dataset.length,
    positiveCount,
    negativeCount,
    truePositive: 0,
    trueNegative: 0,
    falsePositive: 0,
    falseNegative: 0,
    accuracy: 0,
    precision: 0,
    recall: 0,
    f1: 0,
    positiveAverageScore: 0,
    negativeAverageScore: 0,
  };
}
