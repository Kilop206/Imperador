"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticDataAugmentationService = void 0;
class SemanticDataAugmentationService {
    augment(dataset, options = {}) {
        if (!Array.isArray(dataset)) {
            throw new TypeError("dataset deve ser um array.");
        }
        const includeReversed = options.includeReversedPairs ?? true;
        const includePunctuation = options.includePunctuationVariants ?? true;
        const includeCase = options.includeCaseVariants ?? true;
        const maxAugmentedPerExample = Math.max(0, Math.floor(options.maxAugmentedPerExample ?? 4));
        const validExamples = dataset.filter((example) => this.isValidExample(example));
        const maxTotalExamples = Math.max(validExamples.length, Math.floor(options.maxTotalExamples ??
            validExamples.length * 3));
        const result = [];
        const originalKeys = new Set();
        for (const example of validExamples) {
            originalKeys.add(this.createExactKey(example));
        }
        const seenExact = new Set();
        for (const example of validExamples) {
            if (result.length >=
                maxTotalExamples) {
                break;
            }
            this.addExactUnique(result, seenExact, example);
        }
        const originalCount = result.length;
        if (maxAugmentedPerExample === 0 ||
            result.length >= maxTotalExamples) {
            return {
                originalCount,
                augmentedCount: 0,
                totalCount: result.length,
                examples: result,
            };
        }
        for (const example of validExamples) {
            if (result.length >=
                maxTotalExamples) {
                break;
            }
            let generated = 0;
            const candidates = [];
            if (includeReversed) {
                candidates.push({
                    example: {
                        first: example.second,
                        second: example.first,
                        label: example.label,
                    },
                    type: "reverse",
                });
            }
            if (includePunctuation) {
                candidates.push({
                    example: {
                        first: this.togglePunctuation(example.first),
                        second: this.togglePunctuation(example.second),
                        label: example.label,
                    },
                    type: "punctuation",
                });
            }
            if (includeCase) {
                candidates.push({
                    example: {
                        first: this.toggleCase(example.first),
                        second: this.toggleCase(example.second),
                        label: example.label,
                    },
                    type: "case",
                });
            }
            if (includePunctuation) {
                candidates.push({
                    example: {
                        first: this.removeTerminalPunctuation(example.first),
                        second: this.removeTerminalPunctuation(example.second),
                        label: example.label,
                    },
                    type: "punctuation",
                });
            }
            for (const candidate of candidates) {
                if (generated >=
                    maxAugmentedPerExample) {
                    break;
                }
                if (result.length >=
                    maxTotalExamples) {
                    break;
                }
                const candidateKey = this.createExactKey(candidate.example);
                if (originalKeys.has(candidateKey)) {
                    continue;
                }
                if (this.addExactUnique(result, seenExact, candidate.example)) {
                    generated += 1;
                }
            }
        }
        return {
            originalCount,
            augmentedCount: result.length - originalCount,
            totalCount: result.length,
            examples: result,
        };
    }
    deduplicate(dataset) {
        if (!Array.isArray(dataset)) {
            throw new TypeError("dataset deve ser um array.");
        }
        const result = [];
        const seen = new Set();
        for (const example of dataset) {
            if (!this.isValidExample(example)) {
                continue;
            }
            const key = this.createSemanticKey(example);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            result.push({
                first: example.first,
                second: example.second,
                label: example.label,
            });
        }
        return result;
    }
    isValidExample(example) {
        return (typeof example?.first === "string" &&
            example.first.trim().length > 0 &&
            typeof example?.second === "string" &&
            example.second.trim().length > 0 &&
            (example.label === 0 ||
                example.label === 1));
    }
    addExactUnique(result, seen, example) {
        const key = this.createExactKey(example);
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        result.push({
            first: example.first,
            second: example.second,
            label: example.label,
        });
        return true;
    }
    createExactKey(example) {
        return [
            example.label,
            example.first.trim(),
            example.second.trim(),
        ].join("|||");
    }
    createSemanticKey(example) {
        const first = normalizeForComparison(example.first);
        const second = normalizeForComparison(example.second);
        const ordered = first <= second
            ? `${first}|||${second}`
            : `${second}|||${first}`;
        return [
            example.label,
            ordered,
        ].join("|||");
    }
    togglePunctuation(text) {
        const trimmed = text.trim();
        if (!trimmed) {
            return trimmed;
        }
        const last = trimmed.charAt(-1);
        if (last === "." ||
            last === "!" ||
            last === "?") {
            return trimmed.slice(0, -1);
        }
        return `${trimmed}.`;
    }
    removeTerminalPunctuation(text) {
        return text
            .trim()
            .replace(/[.!?]+$/u, "");
    }
    toggleCase(text) {
        const trimmed = text.trim();
        if (!trimmed) {
            return trimmed;
        }
        const isUpper = trimmed ===
            trimmed.toUpperCase();
        if (isUpper) {
            return trimmed.toLowerCase();
        }
        return trimmed.toUpperCase();
    }
}
exports.SemanticDataAugmentationService = SemanticDataAugmentationService;
function normalizeForComparison(text) {
    return text
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}
