"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PublicAiModelService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicAiModelService = void 0;
const ai_sdk_1 = require("@buildingai/ai-sdk");
const base_1 = require("@buildingai/base");
const modules_1 = require("@buildingai/core/modules");
const typeorm_1 = require("@buildingai/db/@nestjs/typeorm");
const entities_1 = require("@buildingai/db/entities");
const typeorm_2 = require("@buildingai/db/typeorm");
const common_1 = require("@nestjs/common");
const provider_config_1 = require("../provider-config");
/**
 * Public AI Model Service
 */
let PublicAiModelService = PublicAiModelService_1 = class PublicAiModelService {
    aiModelRepository;
    secretRepository;
    secretService;
    logger = new common_1.Logger(PublicAiModelService_1.name);
    baseService;
    constructor(aiModelRepository, secretRepository, secretService) {
        this.aiModelRepository = aiModelRepository;
        this.secretRepository = secretRepository;
        this.secretService = secretService;
        this.baseService = new base_1.BaseService(aiModelRepository);
    }
    async getModelInfo(modelId) {
        const model = await this.baseService.findOneById(modelId, {
            relations: ["provider"],
        });
        if (!model) {
            throw new Error("The ai model is not found.");
        }
        return model;
    }
    async listActiveModelsByType(modelType, take = 100) {
        const models = await this.aiModelRepository.find({
            where: { modelType, isActive: true },
            relations: ["provider"],
            order: { sortOrder: "DESC", createdAt: "DESC" },
            take: Math.min(Math.max(Number(take) || 100, 1), 200),
        });
        return models.filter((model) => model.provider?.isActive !== false);
    }
    async listActiveLlmModels(take = 100) {
        return this.listActiveModelsByType("llm", take);
    }
    async listActiveImageModels(take = 100) {
        return this.listActiveModelsByType("text-to-image", take);
    }
    async listActiveVideoModels(take = 100) {
        return this.listActiveModelsByType("text-to-video", take);
    }
    /**
     * Get provider config
     * @param modelId AI model identifier
     * @returns Provider config
     */
    async getProviderConfig(modelId) {
        const model = await this.getModelInfo(modelId);
        if (!model.provider.bindSecretId) {
            throw new Error("The ai model is not bound to a secret.");
        }
        const secretConfig = await this.secretService.getConfigKeyValuePairs(model.provider.bindSecretId);
        return secretConfig;
    }
    /**
     * Get provider
     * @param modelId AI model identifier
     * @param configKeys Config keys
     * @returns Provider
     */
    async getProviderAdapter(modelId, config = {}) {
        const model = await this.getModelInfo(modelId);
        const provider = (0, ai_sdk_1.getProvider)(model.provider.provider, config);
        return provider;
    }
    async getUsableModelProvider(modelId) {
        const model = await this.getModelInfo(modelId);
        const providerConfig = (0, provider_config_1.normalizeProviderConfig)(await this.getProviderConfig(modelId));
        const provider = (0, ai_sdk_1.getProvider)(model.provider.provider, providerConfig);
        return { model, provider };
    }
    async generateText(modelId, params) {
        const { model, provider } = await this.getUsableModelProvider(modelId);
        if (!provider.supports("language")) {
            throw new Error("The ai model does not support text generation.");
        }
        const request = {
            ...params,
            model: provider(model.model).model,
        };
        return (0, ai_sdk_1.generateTextWithUsage)(request, { model: model.model });
    }
    async generateImage(modelId, params) {
        const { model, provider } = await this.getUsableModelProvider(modelId);
        if (model.modelType !== "text-to-image") {
            throw new Error("The ai model is not a text-to-image model.");
        }
        if (!provider.supports("image")) {
            throw new Error("The ai model provider does not support image generation.");
        }
        return (0, ai_sdk_1.generateImage)({
            ...params,
            model: provider.image(model.model).model,
        });
    }
    async generateVideo(modelId, params) {
        const { model, provider } = await this.getUsableModelProvider(modelId);
        if (model.modelType !== "text-to-video") {
            throw new Error("The ai model is not a text-to-video model.");
        }
        if (!provider.supports("video")) {
            throw new Error("The ai model provider does not support video generation.");
        }
        return (0, ai_sdk_1.experimental_generateVideo)({
            ...params,
            model: provider.video(model.model).model,
        });
    }
};
exports.PublicAiModelService = PublicAiModelService;
exports.PublicAiModelService = PublicAiModelService = PublicAiModelService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(entities_1.AiModel)),
    __param(1, (0, typeorm_1.InjectRepository)(entities_1.Secret)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        modules_1.SecretService])
], PublicAiModelService);
