"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.splitSemanticDataset = splitSemanticDataset;
exports.labelDatasetSplit = labelDatasetSplit;
exports.getClassDistribution = getClassDistribution;
function splitSemanticDataset(dataset, options = {}) {
    if (!Array.isArray(dataset)) {
        throw new TypeError("dataset deve ser um array.");
    }
    const trainRatio = options.trainRatio ?? 0.7;
    const validationRatio = options.validationRatio ?? 0.15;
    const testRatio = 1 -
        trainRatio -
        validationRatio;
    if (trainRatio <= 0 ||
        validationRatio <= 0 ||
        testRatio <= 0) {
        throw new RangeError("As proporções precisam ser positivas e somar 1.");
    }
    const validDataset = dataset.filter((pair) => typeof pair?.first === "string" &&
        pair.first.trim().length > 0 &&
        typeof pair?.second === "string" &&
        pair.second.trim().length > 0 &&
        (pair.label === 0 ||
            pair.label === 1));
    if (validDataset.length < 3) {
        throw new Error("O dataset precisa possuir pelo menos 3 exemplos.");
    }
    const positives = [];
    const negatives = [];
    validDataset.forEach((pair, originalIndex) => {
        if (pair.label === 1) {
            positives.push({
                pair,
                originalIndex,
            });
        }
        else {
            negatives.push({
                pair,
                originalIndex,
            });
        }
    });
    const random = createSeededRandom(options.seed ?? 42);
    shuffle(positives, random);
    shuffle(negatives, random);
    const positiveSplit = splitClass(positives, trainRatio, validationRatio);
    const negativeSplit = splitClass(negatives, trainRatio, validationRatio);
    return {
        train: mergeAndSort([
            ...positiveSplit.train,
            ...negativeSplit.train,
        ]),
        validation: mergeAndSort([
            ...positiveSplit.validation,
            ...negativeSplit.validation,
        ]),
        test: mergeAndSort([
            ...positiveSplit.test,
            ...negativeSplit.test,
        ]),
    };
}
function labelDatasetSplit(split) {
    return {
        train: split.train.map((pair) => ({
            ...pair,
            split: "train",
        })),
        validation: split.validation.map((pair) => ({
            ...pair,
            split: "validation",
        })),
        test: split.test.map((pair) => ({
            ...pair,
            split: "test",
        })),
    };
}
function getClassDistribution(dataset) {
    let positive = 0;
    let negative = 0;
    for (const pair of dataset) {
        if (pair.label === 1) {
            positive += 1;
        }
        else if (pair.label === 0) {
            negative += 1;
        }
    }
    return {
        positive,
        negative,
        total: positive + negative,
    };
}
function splitClass(examples, trainRatio, validationRatio) {
    if (examples.length < 3) {
        throw new Error("Cada classe precisa possuir pelo menos 3 exemplos.");
    }
    const trainCount = Math.max(1, Math.floor(examples.length * trainRatio));
    const validationCount = Math.max(1, Math.floor(examples.length * validationRatio));
    let adjustedTrainCount = trainCount;
    let adjustedValidationCount = validationCount;
    if (adjustedTrainCount +
        adjustedValidationCount >=
        examples.length) {
        adjustedValidationCount =
            Math.max(1, examples.length -
                adjustedTrainCount -
                1);
    }
    if (adjustedTrainCount +
        adjustedValidationCount >=
        examples.length) {
        adjustedTrainCount =
            examples.length - 2;
        adjustedValidationCount = 1;
    }
    return {
        train: examples.slice(0, adjustedTrainCount),
        validation: examples.slice(adjustedTrainCount, adjustedTrainCount +
            adjustedValidationCount),
        test: examples.slice(adjustedTrainCount +
            adjustedValidationCount),
    };
}
function mergeAndSort(examples) {
    return examples
        .sort((first, second) => first.originalIndex -
        second.originalIndex)
        .map(({ pair }) => pair);
}
function shuffle(values, random) {
    for (let index = values.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [values[index], values[swapIndex]] =
            [values[swapIndex], values[index]];
    }
}
function createSeededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state =
            (state * 1664525 + 1013904223) >>> 0;
        return state / 4294967296;
    };
}
