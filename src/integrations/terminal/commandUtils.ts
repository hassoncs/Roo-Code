import * as path from "path"

export interface CommandConversionResult {
	finalCommand: string
	finalCwd: string
	wasConverted: boolean
}

/**
 * Extracts tokens from cd command, respecting quotes.
 * Stops at && or ; separator. Strips quotes during tokenization.
 */
function extractCdTokens(command: string): string[] {
	const tokens: string[] = []
	let current = ""
	let inQuotes = false
	let quoteChar = ""

	for (let i = 0; i < command.length; i++) {
		const char = command[i]
		const next = command[i + 1]

		// Handle quote boundaries
		if (!inQuotes && (char === '"' || char === "'")) {
			inQuotes = true
			quoteChar = char
			continue // Skip the quote character
		}
		if (inQuotes && char === quoteChar) {
			inQuotes = false
			quoteChar = ""
			continue // Skip the quote character
		}

		// Stop at separators (outside quotes)
		if (!inQuotes) {
			if ((char === "&" && next === "&") || char === ";") {
				if (current) tokens.push(current)
				break
			}
			if (char === " ") {
				if (current) tokens.push(current)
				current = ""
				continue
			}
		}

		current += char
	}

	if (current) tokens.push(current)
	return tokens
}

/**
 * Converts `cd path && command` or `cd path; command` to {cwd, command}.
 * Only converts if safe to do so, otherwise returns original command.
 */
export function detectAndConvertCdPattern(command: string, baseCwd: string): CommandConversionResult {
	command = command.trim()
	if (!command) {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}

	// Find separator (prefer && over ;)
	let sepIndex = command.indexOf(" && ")
	let sepLength = 4
	if (sepIndex === -1) {
		sepIndex = command.indexOf(";")
		sepLength = 1
	}
	if (sepIndex === -1) {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}

	// Extract parts
	const beforeSep = command.slice(0, sepIndex)
	const afterSep = command.slice(sepIndex + sepLength).trim()

	// Parse cd command
	const tokens = extractCdTokens(beforeSep)
	if (tokens.length < 2) {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}

	// Check for cd/chdir
	const verb = tokens[0].toLowerCase()
	if (verb !== "cd" && verb !== "chdir") {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}

	// Handle Windows /d flag
	let pathIndex = 1
	if (tokens[1]?.toLowerCase() === "/d") {
		pathIndex = 2
	}

	const targetPath = tokens[pathIndex]
	if (!targetPath) {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}

	// Don't convert paths with variables
	if (targetPath.includes("$") || targetPath.includes("%")) {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}

	try {
		const resolvedPath = path.resolve(baseCwd, targetPath)
		return { finalCommand: afterSep, finalCwd: resolvedPath, wasConverted: true }
	} catch {
		return { finalCommand: command, finalCwd: baseCwd, wasConverted: false }
	}
}
