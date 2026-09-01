import assert from "node:assert/strict";
import test from "node:test";

import {
  TfidfVectorizer,
} from "../src/intelligence/tfidfVectorizer";

test("TF-IDF deve construir um vocabulário", () => {
  const vectorizer = new TfidfVectorizer();

  vectorizer.fit([
    "Roma foi um grande imperio",
    "O imperio romano caiu",
    "Roma possuia exercitos poderosos",
  ]);

  assert.equal(vectorizer.isFitted(), true);
  assert.ok(vectorizer.getVocabularySize() > 0);
  assert.equal(vectorizer.getDocumentCount(), 3);

  assert.ok(vectorizer.getVocabulary().includes("roma"));
  assert.ok(vectorizer.getVocabulary().includes("imperio"));
});

test("TF-IDF deve gerar vetores com dimensão igual ao vocabulário", () => {
  const vectorizer = new TfidfVectorizer();

  vectorizer.fit([
    "roma caiu",
    "roma venceu",
  ]);

  const vectors = vectorizer.transform([
    "roma caiu",
    "roma venceu",
  ]);

  assert.equal(vectors.length, 2);
  assert.equal(
    vectors[0].length,
    vectorizer.getVocabularySize(),
  );
  assert.equal(
    vectors[1].length,
    vectorizer.getVocabularySize(),
  );
});

test("TF-IDF deve produzir vetor normalizado", () => {
  const vectorizer = new TfidfVectorizer();

  vectorizer.fit([
    "roma caiu",
    "roma venceu",
  ]);

  const vector = vectorizer.transformOne("roma caiu");

  const magnitude = Math.sqrt(
    vector.reduce(
      (sum, value) => sum + value ** 2,
      0,
    ),
  );

  assert.ok(Math.abs(magnitude - 1) < 0.000001);
});

test("similaridade cosseno deve retornar 1 para vetores idênticos", () => {
  const first = [1, 0, 0];
  const second = [1, 0, 0];

  const similarity =
    TfidfVectorizer.cosineSimilarity(first, second);

  assert.ok(Math.abs(similarity - 1) < 0.000001);
});

test("similaridade cosseno deve retornar 0 para vetores ortogonais", () => {
  const first = [1, 0, 0];
  const second = [0, 1, 0];

  const similarity =
    TfidfVectorizer.cosineSimilarity(first, second);

  assert.equal(similarity, 0);
});

test("vetor vazio deve produzir similaridade zero", () => {
  const first = [0, 0, 0];
  const second = [1, 0, 0];

  const similarity =
    TfidfVectorizer.cosineSimilarity(first, second);

  assert.equal(similarity, 0);
});

test("modelo TF-IDF deve poder ser exportado e importado", () => {
  const original = new TfidfVectorizer();

  original.fit([
    "roma caiu",
    "roma cresceu",
    "imperio romano",
  ]);

  const model = original.exportModel();

  const restored = new TfidfVectorizer();
  restored.importModel(model);

  assert.equal(
    restored.getVocabularySize(),
    original.getVocabularySize(),
  );

  assert.equal(
    restored.getDocumentCount(),
    original.getDocumentCount(),
  );

  assert.deepEqual(
    restored.getVocabulary(),
    original.getVocabulary(),
  );
});