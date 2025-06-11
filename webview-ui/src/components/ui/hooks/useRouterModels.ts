import { useQuery } from "@tanstack/react-query"

import { RouterModels } from "@roo/api"
import { ExtensionMessage } from "@roo/ExtensionMessage"

import { vscode } from "@src/utils/vscode"

const getRouterModels = async (params?: Record<string, unknown>) =>
	new Promise<RouterModels>((resolve, reject) => {
		const cleanup = () => {
			window.removeEventListener("message", handler)
		}

		const timeout = setTimeout(() => {
			cleanup()
			reject(new Error("Router models request timed out"))
		}, 10000)

		const handler = (event: MessageEvent) => {
			const message: ExtensionMessage = event.data

			if (message.type === "routerModels") {
				clearTimeout(timeout)
				cleanup()

				if (message.routerModels) {
					resolve(message.routerModels)
				} else {
					reject(new Error("No router models in response"))
				}
			}
		}

		window.addEventListener("message", handler)
		vscode.postMessage({ type: "requestRouterModels", values: params })
	})

// Cache version - increment when filtering logic changes to invalidate cache
const CACHE_VERSION = "v5"

// Global router models for all providers (OpenRouter, Requesty, etc.)
export const useRouterModels = () => {
	return useQuery({
		queryKey: ["routerModels", CACHE_VERSION],
		queryFn: () => getRouterModels(),
	})
}

// Bedrock-specific region-aware models
export const useBedrockModels = (region: string) => {
	return useQuery({
		queryKey: ["bedrockModels", region, CACHE_VERSION],
		queryFn: () => getRouterModels({ awsRegion: region }),
		enabled: !!region,
	})
}
