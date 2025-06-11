/**
 * @fileoverview Main entry point for the compact logging system
 * Provides a default logger instance with Jest environment detection
 */

import { CompactLogger } from "./CompactLogger"

/**
 * No-operation logger implementation for production environments
 */
const noopLogger = {
	debug: () => {},
	info: () => {},
	warn: () => {},
	error: () => {},
	fatal: () => {},
	child: () => noopLogger,
	close: () => {},
}

const consoleLogger = {
	debug: (message: string, data?: any) => {
		console.debug(`[DEBUG] ${message}`, data || "")
	},
	info: (message: string, data?: any) => {
		console.info(`[INFO] ${message}`, data || "")
	},
	warn: (message: string, data?: any) => {
		console.warn(`[WARN] ${message}`, data || "")
	},
	error: (message: string, data?: any) => {
		console.error(`[ERROR] ${message}`, data || "")
	},
	fatal: (message: string, data?: any) => {
		console.error(`[FATAL] ${message}`, data || "")
	},
	child: () => consoleLogger, // Return the console logger instead of noopLogger
	close: () => {},
}

/**
 * Default logger instance
 * Uses CompactLogger for normal operation, switches to noop logger in Jest test environment
 */
// export const logger = process.env.JEST_WORKER_ID !== undefined ? new CompactLogger() : noopLogger
export const logger = consoleLogger
