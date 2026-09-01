import {
  TfidfVectorizer,
  type TfidfVector,
} from "./tfidfVectorizer";

export interface SimilarityDocument {
  id: string;
  text: string;
}

export interface SimilarityResult {
  id: string;
  text: string;
  score: number;
}

export interface SemanticSimilarityOptions {
  minimumScore?: number;
  topK?: number;
}

export class SemanticSimilarityService {
  private vectorizer = new TfidfVectorizer();
  private documents: SimilarityDocument[] = [];
  private vectors: TfidfVector[] = [];

  public train(documents: SimilarityDocument[]): this {
    if (!Array.isArray(documents)) {
      throw new TypeError("documents deve ser um array.");
    }

    const validDocuments = documents.filter(
      (document): document is SimilarityDocument =>
        typeof document?.id === "string" &&
        document.id.trim().length > 0 &&
        typeof document?.text === "string" &&
        document.text.trim().length > 0,
    );

    this.documents = validDocuments.map((document) => ({
      id: document.id,
      text: document.text,
    }));

    this.vectors = this.vectorizer.fitTransform(
      this.documents.map((document) => document.text),
    );

    return this;
  }

  public isTrained(): boolean {
    return this.vectorizer.isFitted();
  }

  public getDocumentCount(): number {
    return this.documents.length;
  }

  public getVocabularySize(): number {
    return this.vectorizer.getVocabularySize();
  }

  public getVector(text: string): TfidfVector {
    if (!this.isTrained()) {
      throw new Error(
        "O serviço de similaridade precisa ser treinado antes de gerar vetores.",
      );
    }

    return this.vectorizer.transformOne(text);
  }

  public compare(first: string, second: string): number {
    const firstVector = this.getVector(first);
    const secondVector = this.getVector(second);

    return TfidfVectorizer.cosineSimilarity(
      firstVector,
      secondVector,
    );
  }

  public findSimilar(
    text: string,
    options: SemanticSimilarityOptions = {},
  ): SimilarityResult[] {
    if (!this.isTrained()) {
      throw new Error(
        "O serviço de similaridade precisa ser treinado antes da busca.",
      );
    }

    const minimumScore = Math.max(
      0,
      Math.min(1, options.minimumScore ?? 0),
    );

    const topK = Math.max(
      1,
      Math.floor(options.topK ?? 5),
    );

    const queryVector = this.getVector(text);

    const results = this.documents
      .map((document, index) => ({
        id: document.id,
        text: document.text,
        score: TfidfVectorizer.cosineSimilarity(
          queryVector,
          this.vectors[index],
        ),
      }))
      .filter((result) => result.score >= minimumScore)
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }

        return a.id.localeCompare(b.id);
      });

    return results.slice(0, topK);
  }

  public exportModel(): {
    vectorizer: ReturnType<TfidfVectorizer["exportModel"]>;
    documents: SimilarityDocument[];
  } {
    if (!this.isTrained()) {
      throw new Error(
        "Não é possível exportar um modelo não treinado.",
      );
    }

    return {
      vectorizer: this.vectorizer.exportModel(),
      documents: this.documents.map((document) => ({ ...document })),
    };
  }

  public importModel(model: {
    vectorizer: ReturnType<TfidfVectorizer["exportModel"]>;
    documents: SimilarityDocument[];
  }): this {
    if (!model || !model.vectorizer || !Array.isArray(model.documents)) {
      throw new TypeError("Modelo de similaridade inválido.");
    }

    this.vectorizer.importModel(model.vectorizer);

    this.documents = model.documents.map((document) => ({
      id: document.id,
      text: document.text,
    }));

    this.vectors = this.vectorizer.transform(
      this.documents.map((document) => document.text),
    );

    return this;
  }

  public reset(): void {
    this.vectorizer.reset();
    this.documents = [];
    this.vectors = [];
  }
}