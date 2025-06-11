import OpenAI from "openai"

import type { ModelInfo } from "@roo-code/types"

import { ApiHandlerOptions, RouterName, ModelRecord, GetModelsOptions } from "../../shared/api"

import { BaseProvider } from "./base-provider"
import { getModels } from "./fetchers/modelCache"

type RouterProviderOptions = {
	name: RouterName
	baseURL: string
	apiKey?: string
	modelId?: string
	defaultModelId: string
	defaultModelInfo: ModelInfo
	options: ApiHandlerOptions
}

export abstract class RouterProvider extends BaseProvider {
	protected readonly options: ApiHandlerOptions
	protected readonly name: RouterName
	protected models: ModelRecord = {}
	protected readonly modelId?: string
	protected readonly defaultModelId: string
	protected readonly defaultModelInfo: ModelInfo
	protected readonly client: OpenAI

	constructor({
		options,
		name,
		baseURL,
		apiKey = "not-provided",
		modelId,
		defaultModelId,
		defaultModelInfo,
	}: RouterProviderOptions) {
		super()

		this.options = options
		this.name = name
		this.modelId = modelId
		this.defaultModelId = defaultModelId
		this.defaultModelInfo = defaultModelInfo

		this.client = new OpenAI({ baseURL, apiKey })
	}

	public async fetchModel() {
		let modelsOptions: GetModelsOptions

		switch (this.name) {
			case "openrouter":
				modelsOptions = { provider: "openrouter" }
				break
			case "glama":
				modelsOptions = { provider: "glama" }
				break
			case "requesty":
				modelsOptions = { provider: "requesty", apiKey: this.client.apiKey }
				break
			case "unbound":
				modelsOptions = { provider: "unbound", apiKey: this.client.apiKey }
				break
			case "litellm":
				modelsOptions = {
					provider: "litellm",
					apiKey: this.client.apiKey,
					baseUrl: this.client.baseURL,
				}
				break
			case "bedrock":
				modelsOptions = {
					provider: "bedrock",
					apiConfiguration: {
						awsAccessKey: this.options.awsAccessKey,
						awsSecretKey: this.options.awsSecretKey,
						awsSessionToken: this.options.awsSessionToken,
						awsProfile: this.options.awsProfile,
						awsUseProfile: this.options.awsUseProfile,
						awsBedrockEndpoint: this.options.awsBedrockEndpoint,
						awsBedrockEndpointEnabled: this.options.awsBedrockEndpointEnabled,
						awsRegion: this.options.awsRegion || "us-west-2",
					},
				}
				break
			default:
				throw new Error(`Unknown router provider: ${this.name}`)
		}

		this.models = await getModels(modelsOptions)
		return this.getModel()
	}

	override getModel(): { id: string; info: ModelInfo } {
		const id = this.modelId ?? this.defaultModelId

		return this.models[id]
			? { id, info: this.models[id] }
			: { id: this.defaultModelId, info: this.defaultModelInfo }
	}

	protected supportsTemperature(modelId: string): boolean {
		return !modelId.startsWith("openai/o3-mini")
	}
}
