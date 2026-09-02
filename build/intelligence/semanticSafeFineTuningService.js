"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SemanticSafeFineTuningService = void 0;
const modelManager_1 = require("./modelManager");
const semanticModelPromotionService_1 = require("./semanticModelPromotionService");
class SemanticSafeFineTuningService {
    constructor(manager = modelManager_1.ModelManager) {
        this.manager = manager;
    }
    /**
     * Executa fine-tuning com promoção segura.
     *
     * Fluxo:
     *
     * 1. Obtém a versão ativa atual.
     * 2. Executa o fine-tuning.
     * 3. Avalia o candidato através do Promotion Gate.
     * 4. Se o candidato tiver sido ativado e for reprovado,
     *    restaura a versão anterior.
     * 5. Retorna o estado final do sistema.
     */
    run(input, thresholds = {}) {
        const previousActiveVersion = this.manager.getActiveVersion();
        if (previousActiveVersion === null) {
            throw new Error('Não existe modelo semântico ativo para servir como ponto de rollback.');
        }
        const fineTuning = this.manager.fineTune(input);
        const promotion = semanticModelPromotionService_1.SemanticModelPromotionService.evaluate({
            validationMetrics: fineTuning.candidateValidationMetrics,
            testMetrics: fineTuning.candidateTestMetrics,
        }, thresholds);
        /**
         * O fine-tuning já rejeitou o candidato.
         *
         * Nesse cenário não há alteração da versão ativa
         * a ser revertida.
         */
        if (!fineTuning.activated) {
            return {
                fineTuning,
                promotion,
                previousActiveVersion,
                finalActiveVersion: this.manager.getActiveVersion(),
                rolledBack: false,
            };
        }
        /**
         * O candidato foi ativado e passou pelo Promotion Gate.
         */
        if (promotion.approved) {
            return {
                fineTuning,
                promotion,
                previousActiveVersion,
                finalActiveVersion: this.manager.getActiveVersion(),
                rolledBack: false,
            };
        }
        /**
         * O candidato foi ativado pelo fluxo de fine-tuning,
         * mas falhou nos critérios de promoção.
         *
         * Nesse caso, restaura imediatamente a versão
         * anterior conhecida.
         */
        const rolledBack = this.manager.activateVersion(previousActiveVersion);
        if (!rolledBack) {
            throw new Error(`Falha crítica no rollback da versão ${previousActiveVersion} após reprovação do modelo ${fineTuning.candidateVersion}.`);
        }
        return {
            fineTuning,
            promotion,
            previousActiveVersion,
            finalActiveVersion: this.manager.getActiveVersion(),
            rolledBack: true,
        };
    }
    /**
     * Formata o resultado para logs, diagnósticos
     * ou comandos administrativos.
     */
    formatResult(result) {
        const lines = [
            '=== Fine-Tuning Seguro ===',
            `Versão anterior: ${result.previousActiveVersion}`,
            `Versão candidata: ${result.fineTuning.candidateVersion}`,
            `Fine-tuning ativou candidato: ${result.fineTuning.activated
                ? 'sim'
                : 'não'}`,
            `Promotion Gate: ${result.promotion.approved
                ? '✅ APROVADO'
                : '❌ REPROVADO'}`,
            `Rollback executado: ${result.rolledBack
                ? '✅ sim'
                : 'não'}`,
            `Versão ativa final: ${result.finalActiveVersion ??
                'nenhuma'}`,
            `Motivo: ${result.promotion.reason}`,
        ];
        if (result.promotion.failedMetrics.length >
            0) {
            lines.push('', 'Critérios não atendidos:');
            for (const metric of result.promotion.failedMetrics) {
                lines.push(`- ${metric}`);
            }
        }
        return lines.join('\n');
    }
}
exports.SemanticSafeFineTuningService = SemanticSafeFineTuningService;
