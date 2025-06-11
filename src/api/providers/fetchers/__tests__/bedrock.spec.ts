import { vi } from "vitest"
import { requestBedrockModels } from "../bedrock"

// Mock AWS SDK
vi.mock("@aws-sdk/client-bedrock", () => ({
	BedrockClient: vi.fn().mockImplementation(() => ({
		send: vi.fn().mockResolvedValue({
			modelSummaries: [
				{
					modelId: "anthropic.claude-3-5-sonnet-20240620-v1:0",
					outputModalities: ["TEXT"],
					inputModalities: ["TEXT"],
				},
				{
					modelId: "anthropic.claude-3-haiku-20240307-v1:0",
					outputModalities: ["TEXT"],
					inputModalities: ["TEXT"],
				},
				{
					modelId: "meta.llama2-70b-chat-v1",
					outputModalities: ["TEXT"],
					inputModalities: ["TEXT"],
				},
			],
		}),
	})),
	ListFoundationModelsCommand: vi.fn(),
}))

vi.mock("@aws-sdk/credential-providers", () => ({
	fromIni: vi.fn().mockReturnValue({
		accessKeyId: "profile-access-key",
		secretAccessKey: "profile-secret-key",
	}),
}))

describe("requestBedrockModels", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("should fetch and filter Claude models from AWS API", async () => {
		const options = {
			awsAccessKey: "test-key",
			awsSecretKey: "test-secret",
			awsUseProfile: false,
		}

		const models = await requestBedrockModels("us-east-1", options)

		expect(models).toEqual({
			"anthropic.claude-3-5-sonnet-20240620-v1:0": {
				maxTokens: 8192, // Inferred for claude-3-5 models
				contextWindow: 200_000, // Inferred for claude-3-5 models
				supportsImages: false, // Based on real AWS inputModalities data (no IMAGE)
				supportsPromptCache: true, // Inferred for claude-3-5 models
				inputPrice: 0,
				outputPrice: 0,
				description: "Claude model: anthropic.claude-3-5-sonnet-20240620-v1:0",
			},
			"anthropic.claude-3-haiku-20240307-v1:0": {
				maxTokens: 4096, // Inferred for claude-3 models (but not 3-5)
				contextWindow: 200_000, // Inferred for claude-3 models
				supportsImages: false, // Based on real AWS inputModalities data (no IMAGE)
				supportsPromptCache: false, // Inferred for older claude-3 models
				inputPrice: 0,
				outputPrice: 0,
				description: "Claude model: anthropic.claude-3-haiku-20240307-v1:0",
			},
		})
	})

	it("should filter out non-Claude models", async () => {
		const options = {
			awsAccessKey: "test-key",
			awsSecretKey: "test-secret",
			awsUseProfile: false,
		}

		const models = await requestBedrockModels("us-east-1", options)

		// Should not include the Llama model
		expect(models["meta.llama2-70b-chat-v1"]).toBeUndefined()
		expect(Object.keys(models)).toHaveLength(2)
	})

	it("should use profile credentials when configured", async () => {
		const options = {
			awsProfile: "test-profile",
			awsUseProfile: true,
		}

		await requestBedrockModels("us-west-2", options)

		const { fromIni } = await import("@aws-sdk/credential-providers")
		expect(fromIni).toHaveBeenCalledWith({ profile: "test-profile" })
	})

	it("should return empty object when no options provided", async () => {
		const models = await requestBedrockModels("us-east-1")
		expect(models).toEqual({})
	})

	it("should handle API errors gracefully", async () => {
		const { BedrockClient } = await import("@aws-sdk/client-bedrock")
		vi.mocked(BedrockClient).mockImplementationOnce(() => ({
			send: vi.fn().mockRejectedValue(new Error("API Error")),
			config: {} as any,
			destroy: vi.fn(),
			middlewareStack: {} as any,
		}))

		const options = {
			awsAccessKey: "test-key",
			awsSecretKey: "test-secret",
			awsUseProfile: false,
		}

		const models = await requestBedrockModels("us-east-1", options)
		expect(models).toEqual({})
	})
})
