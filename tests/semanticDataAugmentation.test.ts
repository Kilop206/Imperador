import assert from "node:assert/strict";
import test from "node:test";

import {
  SemanticDataAugmentationService,
} from "../src/intelligence/semanticDataAugmentation";

function createDataset() {
  return [
    {
      first: "Por que Roma caiu?",
      second: "Qual foi a causa da queda de Roma?",
      label: 1 as const,
    },
    {
      first: "Como programar um computador?",
      second: "Como escrever codigo?",
      label: 1 as const,
    },
    {
      first: "Roma caiu?",
      second: "Como configurar uma rede?",
      label: 0 as const,
    },
  ];
}

test("deve manter os exemplos originais", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      createDataset(),
    );

  assert.ok(
    result.totalCount >=
      result.originalCount,
  );

  for (const original of createDataset()) {
    assert.ok(
      result.examples.some(
        (example) =>
          example.first ===
            original.first &&
          example.second ===
            original.second &&
          example.label ===
            original.label,
      ),
    );
  }
});

test("deve gerar variantes quando habilitado", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      createDataset(),
      {
        includeReversedPairs: true,
        includePunctuationVariants: true,
        includeCaseVariants: true,
      },
    );

  assert.ok(
    result.augmentedCount > 0,
  );
});

test("deve gerar pares invertidos", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      [
        {
          first: "Roma caiu",
          second: "Roma entrou em decadencia",
          label: 1,
        },
      ],
      {
        includeReversedPairs: true,
        includePunctuationVariants: false,
        includeCaseVariants: false,
      },
    );

  assert.ok(
    result.examples.some(
      (example) =>
        example.first ===
          "Roma entrou em decadencia" &&
        example.second ===
          "Roma caiu" &&
        example.label === 1,
    ),
  );
});

test("pares invertidos não devem criar duplicatas", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      [
        {
          first: "Roma caiu",
          second: "Roma entrou em decadencia",
          label: 1,
        },
        {
          first: "Roma entrou em decadencia",
          second: "Roma caiu",
          label: 1,
        },
      ],
      {
        includeReversedPairs: true,
        includePunctuationVariants: false,
        includeCaseVariants: false,
      },
    );

  assert.equal(
    result.examples.length,
    2,
  );

  assert.ok(
    result.examples.some(
      (example) =>
        example.first === "Roma caiu" &&
        example.second ===
          "Roma entrou em decadencia",
    ),
  );

  assert.ok(
    result.examples.some(
      (example) =>
        example.first ===
          "Roma entrou em decadencia" &&
        example.second === "Roma caiu",
    ),
  );
});

test("deve respeitar maxAugmentedPerExample", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      [
        {
          first: "Roma caiu",
          second: "A queda aconteceu",
          label: 1,
        },
      ],
      {
        maxAugmentedPerExample: 1,
      },
    );

  assert.ok(
    result.augmentedCount <= 1,
  );
});

test("deve respeitar maxTotalExamples", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      createDataset(),
      {
        maxTotalExamples: 5,
      },
    );

  assert.ok(
    result.totalCount <= 5,
  );
});

test("deve permitir desativar reversão", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      [
        {
          first: "Roma caiu",
          second: "Roma entrou em decadencia",
          label: 1,
        },
      ],
      {
        includeReversedPairs: false,
        includePunctuationVariants: false,
        includeCaseVariants: false,
        maxAugmentedPerExample: 4,
      },
    );

  assert.equal(
    result.totalCount,
    1,
  );
});

test("deve permitir desativar variantes de pontuação", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      [
        {
          first: "Roma caiu",
          second: "Roma entrou em decadencia",
          label: 1,
        },
      ],
      {
        includeReversedPairs: false,
        includePunctuationVariants: false,
        includeCaseVariants: true,
      },
    );

  assert.equal(
    result.totalCount,
    2,
  );
});

test("deve permitir desativar variantes de capitalização", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      [
        {
          first: "Roma caiu.",
          second: "Roma entrou em decadencia.",
          label: 1,
        },
      ],
      {
        includeReversedPairs: false,
        includePunctuationVariants: false,
        includeCaseVariants: false,
      },
    );

  assert.equal(
    result.totalCount,
    1,
  );
});

test("deduplicate deve remover duplicatas", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.deduplicate([
      {
        first: "Roma caiu",
        second: "Roma venceu",
        label: 1,
      },
      {
        first: "Roma caiu",
        second: "Roma venceu",
        label: 1,
      },
      {
        first: "Roma venceu",
        second: "Roma caiu",
        label: 1,
      },
    ]);

  assert.equal(
    result.length,
    1,
  );
});

test("pares com rótulos diferentes não devem ser considerados duplicados", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.deduplicate([
      {
        first: "Roma caiu",
        second: "Roma venceu",
        label: 1,
      },
      {
        first: "Roma caiu",
        second: "Roma venceu",
        label: 0,
      },
    ]);

  assert.equal(
    result.length,
    2,
  );
});

test("deve ignorar exemplos inválidos", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.deduplicate([
      {
        first: "",
        second: "Roma",
        label: 1,
      },
      {
        first: "Roma",
        second: "",
        label: 0,
      },
      {
        first: "Roma",
        second: "Roma",
        label: 1,
      },
    ]);

  assert.equal(
    result.length,
    1,
  );
});

test("isValidExample deve validar pares corretamente", () => {
  const service =
    new SemanticDataAugmentationService();

  assert.equal(
    service.isValidExample({
      first: "Roma caiu",
      second: "Roma entrou em decadencia",
      label: 1,
    }),
    true,
  );

  assert.equal(
    service.isValidExample({
      first: "",
      second: "Roma",
      label: 1,
    }),
    false,
  );

  assert.equal(
    service.isValidExample({
      first: "Roma",
      second: "Roma",
      label: 2 as 0,
    }),
    false,
  );
});

test("normalização deve tratar pontuação e capitalização como equivalentes", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.deduplicate([
      {
        first: "Roma caiu!",
        second: "Roma venceu?",
        label: 1,
      },
      {
        first: "ROMA CAIU",
        second: "roma venceu",
        label: 1,
      },
    ]);

  assert.equal(
    result.length,
    1,
  );
});

test("resultado deve informar corretamente as contagens", () => {
  const service =
    new SemanticDataAugmentationService();

  const result =
    service.augment(
      createDataset(),
      {
        maxTotalExamples: 20,
      },
    );

  assert.equal(
    result.totalCount,
    result.examples.length,
  );

  assert.equal(
    result.augmentedCount,
    result.totalCount -
      result.originalCount,
  );
});