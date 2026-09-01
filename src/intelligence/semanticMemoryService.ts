import {
  SemanticSimilarityService,
  type SimilarityResult,
} from "./semanticSimilarityService";

export interface SemanticMemory {
  id: string;
  text: string;
  createdAt?: number;
  metadata?: Record<string, unknown>;
}

export interface SemanticMemorySearchOptions {
  minimumScore?: number;
  topK?: number;
}

export interface SemanticMemoryResult
  extends SimilarityResult {
  memory: SemanticMemory;
}

export class SemanticMemoryService {
  private readonly similarityService =
    new SemanticSimilarityService();

  private memories: SemanticMemory[] = [];

  public add(memory: SemanticMemory): void {
    if (!this.isValidMemory(memory)) {
      throw new TypeError("Memória semântica inválida.");
    }

    const existingIndex = this.memories.findIndex(
      (item) => item.id === memory.id,
    );

    const normalizedMemory: SemanticMemory = {
      id: memory.id,
      text: memory.text.trim(),
      createdAt: memory.createdAt ?? Date.now(),
      metadata: memory.metadata
        ? { ...memory.metadata }
        : undefined,
    };

    if (existingIndex >= 0) {
      this.memories[existingIndex] = normalizedMemory;
    } else {
      this.memories.push(normalizedMemory);
    }

    this.rebuild();
  }

  public addMany(memories: SemanticMemory[]): void {
    if (!Array.isArray(memories)) {
      throw new TypeError("memories deve ser um array.");
    }

    for (const memory of memories) {
      if (!this.isValidMemory(memory)) {
        throw new TypeError("Memória semântica inválida.");
      }
    }

    for (const memory of memories) {
      const existingIndex = this.memories.findIndex(
        (item) => item.id === memory.id,
      );

      const normalizedMemory: SemanticMemory = {
        id: memory.id,
        text: memory.text.trim(),
        createdAt: memory.createdAt ?? Date.now(),
        metadata: memory.metadata
          ? { ...memory.metadata }
          : undefined,
      };

      if (existingIndex >= 0) {
        this.memories[existingIndex] = normalizedMemory;
      } else {
        this.memories.push(normalizedMemory);
      }
    }

    this.rebuild();
  }

  public remove(id: string): boolean {
    const initialLength = this.memories.length;

    this.memories = this.memories.filter(
      (memory) => memory.id !== id,
    );

    const removed =
      this.memories.length !== initialLength;

    if (removed) {
      this.rebuild();
    }

    return removed;
  }

  public search(
    text: string,
    options: SemanticMemorySearchOptions = {},
  ): SemanticMemoryResult[] {
    if (!this.similarityService.isTrained()) {
      return [];
    }

    const results =
      this.similarityService.findSimilar(text, {
        minimumScore: options.minimumScore ?? 0,
        topK: options.topK ?? 5,
      });

    const semanticResults: SemanticMemoryResult[] = [];

    for (const result of results) {
      const memory = this.memories.find(
        (item) => item.id === result.id,
      );

      if (!memory) {
        continue;
      }

      semanticResults.push({
        id: result.id,
        text: result.text,
        score: result.score,
        memory: {
          id: memory.id,
          text: memory.text,
          createdAt: memory.createdAt,
          metadata: memory.metadata
            ? { ...memory.metadata }
            : undefined,
        },
      });
    }

    return semanticResults;
  }

  public findBest(
    text: string,
    minimumScore = 0,
  ): SemanticMemoryResult | null {
    const results = this.search(text, {
      minimumScore,
      topK: 1,
    });

    return results[0] ?? null;
  }

  public getMemories(): SemanticMemory[] {
    return this.memories.map((memory) => ({
      id: memory.id,
      text: memory.text,
      createdAt: memory.createdAt,
      metadata: memory.metadata
        ? { ...memory.metadata }
        : undefined,
    }));
  }

  public getMemoryCount(): number {
    return this.memories.length;
  }

  public isTrained(): boolean {
    return this.similarityService.isTrained();
  }

  public getVocabularySize(): number {
    return this.similarityService.getVocabularySize();
  }

  public exportModel(): {
    memories: SemanticMemory[];
    semanticModel: ReturnType<
      SemanticSimilarityService["exportModel"]
    > | null;
  } {
    return {
      memories: this.getMemories(),
      semanticModel: this.isTrained()
        ? this.similarityService.exportModel()
        : null,
    };
  }

  public importModel(model: {
    memories: SemanticMemory[];
    semanticModel: ReturnType<
      SemanticSimilarityService["exportModel"]
    > | null;
  }): this {
    if (
      !model ||
      !Array.isArray(model.memories)
    ) {
      throw new TypeError(
        "Modelo de memória semântica inválido.",
      );
    }

    for (const memory of model.memories) {
      if (!this.isValidMemory(memory)) {
        throw new TypeError(
          "Modelo contém memória semântica inválida.",
        );
      }
    }

    this.memories = model.memories.map(
      (memory) => ({
        id: memory.id,
        text: memory.text,
        createdAt: memory.createdAt,
        metadata: memory.metadata
          ? { ...memory.metadata }
          : undefined,
      }),
    );

    if (model.semanticModel) {
      this.similarityService.importModel(
        model.semanticModel,
      );
    } else {
      this.rebuild();
    }

    return this;
  }

  public clear(): void {
    this.memories = [];
    this.similarityService.reset();
  }

  private rebuild(): void {
    if (this.memories.length === 0) {
      this.similarityService.reset();
      return;
    }

    this.similarityService.train(
      this.memories.map((memory) => ({
        id: memory.id,
        text: memory.text,
      })),
    );
  }

  private isValidMemory(
    memory: SemanticMemory,
  ): boolean {
    return (
      typeof memory?.id === "string" &&
      memory.id.trim().length > 0 &&
      typeof memory?.text === "string" &&
      memory.text.trim().length > 0
    );
  }
}