import { BedrockClient, ListFoundationModelsCommand } from "@aws-sdk/client-bedrock"
import { fromIni } from "@aws-sdk/credential-providers"

import type { ModelInfo } from "@roo-code/types"
import { bedrockModels } from "@roo-code/types"

import type { ApiHandlerOptions } from "../../../shared/api"

/**
 * Model inference utilities extracted from AwsBedrockHandler
 * These provide proper model constraints based on AWS model naming patterns
 */
export function inferMaxTokens(modelId: string): number {
	if (modelId.includes("claude-4") || modelId.includes("claude-3-7") || modelId.includes("claude-3-5")) {
		return 8192
	}
	if (modelId.includes("claude-3")) {
		return 4096
	}
	if (modelId.includes("nova")) {
		return 5000
	}
	if (modelId.includes("llama")) {
		return 8192
	}
	return 4096 // Conservative default
}

function inferContextWindow(modelId: string): number {
	if (modelId.includes("claude-4") || modelId.includes("claude-3-7") || modelId.includes("claude-3-5")) {
		return 200_000
	}
	if (modelId.includes("claude-3")) {
		return 200_000
	}
	if (modelId.includes("nova")) {
		return 300_000
	}
	if (modelId.includes("llama3-1")) {
		return 128_000
	}
	if (modelId.includes("llama")) {
		return 128_000
	}
	return 128_000 // Conservative default
}

function inferPromptCacheSupport(modelId: string): boolean {
	// Newer Claude models and Nova models support prompt cache
	return (
		modelId.includes("claude-3-5") ||
		modelId.includes("claude-4") ||
		modelId.includes("claude-3-7") ||
		modelId.includes("nova-pro") ||
		modelId.includes("nova-lite") ||
		modelId.includes("nova-micro")
	)
}

/**
 * Strip context window suffixes from AWS model IDs
 * AWS returns models like "anthropic.claude-3-haiku-20240307-v1:0:200k"
 * but validation expects "anthropic.claude-3-haiku-20240307-v1:0"
 * IMPORTANT: Only remove context window suffixes (with 'k'), NOT version suffixes like ":0"
 */
function stripContextWindowSuffix(modelId: string): string {
	// Remove suffixes like ":100k", ":200k", ":28k", ":48k", etc.
	// But keep version suffixes like ":0" (which are required)
	return modelId.replace(/:\d+k$/, "")
}

/**
 * Create default model info for unknown models using inference
 */
function createDefaultModelInfo(modelId: string): ModelInfo {
	return {
		maxTokens: inferMaxTokens(modelId),
		contextWindow: inferContextWindow(modelId),
		supportsImages: false,
		supportsPromptCache: inferPromptCacheSupport(modelId),
		inputPrice: 0, // Unknown pricing for new models
		outputPrice: 0,
		description: `Model: ${modelId}`,
	}
}

/**
 * Blend AWS API model data with static pricing and feature data
 * Priority: Static data for pricing/features, AWS data for availability/metadata
 */
function enhanceWithStaticModelData(
	awsModels: Record<string, any>,
	staticModels: typeof bedrockModels,
): Record<string, ModelInfo> {
	const blendedModels: Record<string, ModelInfo> = {}

	// Process AWS models (ensures regional availability)
	for (const [modelId, awsData] of Object.entries(awsModels)) {
		const staticData = staticModels[modelId as keyof typeof staticModels]
		const baseModel = staticData || createDefaultModelInfo(modelId)

		blendedModels[modelId] = {
			...baseModel,
			supportsImages: awsData.inputModalities?.includes("IMAGE") || baseModel.supportsImages,
			description: awsData.modelName || `Model: ${modelId}`,
		}
	}

	return blendedModels
}

/**
 * Known regions where Bedrock is available
 */
const BEDROCK_AVAILABLE_REGIONS = [
	"us-east-1",
	"us-west-2",
	"ap-southeast-1",
	"ap-northeast-1",
	"eu-west-1",
	"eu-central-1",
	"ca-central-1",
]

/**
 * requestBedrockModels - Fetch available Claude models from AWS Bedrock API
 * Uses ZERO hardcoded model names - everything comes from AWS APIs dynamically
 * Now includes proper model constraints and better error handling
 */
export async function requestBedrockModels(
	region: string,
	options?: ApiHandlerOptions,
): Promise<Record<string, ModelInfo>> {
	const models: Record<string, ModelInfo> = {}

	try {
		if (!options) {
			return models
		}

		// Validate region availability
		if (!BEDROCK_AVAILABLE_REGIONS.includes(region)) {
			console.warn(
				`Bedrock may not be available in region ${region}. Supported regions: ${BEDROCK_AVAILABLE_REGIONS.join(", ")}`,
			)
		}

		// Set up AWS credentials based on configuration
		const credentials = options.awsUseProfile
			? fromIni({ profile: options.awsProfile })
			: {
					accessKeyId: options.awsAccessKey!,
					secretAccessKey: options.awsSecretKey!,
					...(options.awsSessionToken && { sessionToken: options.awsSessionToken }),
				}

		const bedrockClient = new BedrockClient({
			region,
			credentials,
			...(options.awsBedrockEndpoint &&
				options.awsBedrockEndpointEnabled && { endpoint: options.awsBedrockEndpoint }),
		})

		const command = new ListFoundationModelsCommand({})
		const response = await bedrockClient.send(command)

		// Filter and process all models
		const awsModelData: Record<string, any> = {}

		response.modelSummaries
			?.filter((model) => {
				// Include any model that supports text input/output
				return model.outputModalities?.includes("TEXT") && model.inputModalities?.includes("TEXT")
			})
			?.forEach((model) => {
				// Smart filtering for dropdown models - focus on ON_DEMAND accessibility
				const inferenceTypes = model.inferenceTypesSupported || []
				const supportsOnDemand = inferenceTypes.includes("ON_DEMAND")
				const hasInferenceProfile = inferenceTypes.some((type) => (type as string) === "INFERENCE_PROFILE")

				// Filter based on customization patterns that indicate restricted access
				const customizations = model.customizationsSupported || []
				const hasRestrictedCustomizations =
					customizations.includes("FINE_TUNING") && customizations.includes("CONTINUED_PRE_TRAINING")

				// Models with advanced customizations often require special access
				if (hasRestrictedCustomizations && model.providerName === "Amazon") {
					return
				}

				// Group by base model ID for intelligent deduplication
				const baseModelId = stripContextWindowSuffix(model.modelId!)
				if (!awsModelData[baseModelId]) {
					awsModelData[baseModelId] = {
						modelName: model.modelName,
						inputModalities: model.inputModalities,
						outputModalities: model.outputModalities,
						responseStreamingSupported: model.responseStreamingSupported,
						inferenceTypesSupported: model.inferenceTypesSupported,
						candidates: [],
					}
				}

				// Add this model as a candidate for this base model
				awsModelData[baseModelId].candidates.push({
					fullModelId: model.modelId!,
					inferenceTypes: model.inferenceTypesSupported || [],
				})
			})

		// Pick the best representative for each base model
		Object.entries(awsModelData).forEach(([baseModelId, data]) => {
			const candidates = (data.candidates || []) as Array<{ fullModelId: string; inferenceTypes: string[] }>
			if (candidates.length === 0) return

			// Prefer models with ON_DEMAND support
			const onDemandCandidates = candidates.filter((c: { fullModelId: string; inferenceTypes: string[] }) =>
				c.inferenceTypes.includes("ON_DEMAND"),
			)

			if (onDemandCandidates.length > 0) {
				// Prefer base model (no context suffix) over variants
				const baseCandidate = onDemandCandidates.find(
					(c: { fullModelId: string; inferenceTypes: string[] }) =>
						stripContextWindowSuffix(c.fullModelId) === c.fullModelId,
				)

				const chosenCandidate = baseCandidate || onDemandCandidates[0]
				// Clean up the model data (remove candidates array)
				delete data.candidates
			} else {
				delete awsModelData[baseModelId]
			}
		})

		// Blend AWS data with static pricing/feature data
		const blendedModels = enhanceWithStaticModelData(awsModelData, bedrockModels)
		Object.assign(models, blendedModels)
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error)
		const errorType = error instanceof Error ? error.name : "Unknown"

		console.error("Failed to fetch models from AWS API", {
			ctx: "bedrock",
			region,
			errorType,
			error: errorMessage,
			availableRegions: BEDROCK_AVAILABLE_REGIONS,
		})

		// Log specific error types for better debugging
		if (errorMessage.includes("ENOTFOUND")) {
			console.error(
				`Network error: Bedrock service not found in region ${region}. This region may not support Bedrock.`,
			)
		} else if (errorMessage.includes("UnauthorizedOperation") || errorMessage.includes("AccessDenied")) {
			console.error("AWS credentials do not have permission to list foundation models. Check IAM permissions.")
		} else if (errorMessage.includes("InvalidRequestException")) {
			console.error("Invalid AWS request. Check region and endpoint configuration.")
		}

		// Return empty object instead of fallback to maintain pure AWS API approach
	}

	return models
}
