import { describe, it, expect } from "vitest"
import * as path from "path"
import { detectAndConvertCdPattern } from "../commandUtils"

describe("detectAndConvertCdPattern", () => {
	const baseCwd = "/project/root"

	describe("Basic && patterns (should convert)", () => {
		it("should convert cd with && - simple case", () => {
			const result = detectAndConvertCdPattern("cd frontend && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should convert chdir with &&", () => {
			const result = detectAndConvertCdPattern("chdir backend && npm test", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm test",
				finalCwd: path.resolve(baseCwd, "backend"),
				wasConverted: true,
			})
		})

		it("should handle relative paths with ../", () => {
			const result = detectAndConvertCdPattern("cd ../parent && ls -la", baseCwd)

			expect(result).toEqual({
				finalCommand: "ls -la",
				finalCwd: path.resolve(baseCwd, "../parent"),
				wasConverted: true,
			})
		})

		it("should handle case insensitive cd/chdir", () => {
			const result = detectAndConvertCdPattern("CD frontend && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})
	})

	describe("Quoted paths", () => {
		it("should handle double-quoted paths", () => {
			const result = detectAndConvertCdPattern('cd "path with spaces" && npm install', baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "path with spaces"),
				wasConverted: true,
			})
		})

		it("should handle single-quoted paths", () => {
			const result = detectAndConvertCdPattern("cd 'another path' && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "another path"),
				wasConverted: true,
			})
		})
	})

	describe("Windows-specific patterns", () => {
		it("should handle cd /d with && (Windows drive change)", () => {
			const winBaseCwd = "C:\\project"
			const result = detectAndConvertCdPattern("cd /d D:\\work && dir", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "dir",
				finalCwd: path.resolve(winBaseCwd, "D:\\work"),
				wasConverted: true,
			})
		})
	})

	describe("Complex command patterns", () => {
		it("should handle commands with multiple arguments", () => {
			const result = detectAndConvertCdPattern("cd frontend && npm run build --prod", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm run build --prod",
				finalCwd: path.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should handle commands with pipes and redirects", () => {
			const result = detectAndConvertCdPattern('cd logs && grep "error" *.log | head -10', baseCwd)

			expect(result).toEqual({
				finalCommand: 'grep "error" *.log | head -10',
				finalCwd: path.resolve(baseCwd, "logs"),
				wasConverted: true,
			})
		})
	})

	describe("Semicolon separator support", () => {
		it("should convert cd with semicolon separator", () => {
			const result = detectAndConvertCdPattern("cd frontend; npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should convert cd with semicolon and quoted path", () => {
			const result = detectAndConvertCdPattern('cd "path with spaces"; npm test', baseCwd)

			expect(result).toEqual({
				finalCommand: "npm test",
				finalCwd: path.resolve(baseCwd, "path with spaces"),
				wasConverted: true,
			})
		})

		it("should convert cd with semicolon and complex command", () => {
			const result = detectAndConvertCdPattern("cd logs; tail -f app.log | grep ERROR", baseCwd)

			expect(result).toEqual({
				finalCommand: "tail -f app.log | grep ERROR",
				finalCwd: path.resolve(baseCwd, "logs"),
				wasConverted: true,
			})
		})

		it("should NOT convert single & (background execution)", () => {
			const result = detectAndConvertCdPattern("cd frontend & npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd frontend & npm install",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert cd without subsequent command", () => {
			const result = detectAndConvertCdPattern("cd frontend", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd frontend",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert commands with variables", () => {
			const result = detectAndConvertCdPattern("cd $WORKSPACE_ROOT/src && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd $WORKSPACE_ROOT/src && npm install",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert commands with Windows variables", () => {
			const result = detectAndConvertCdPattern("cd %USERPROFILE%\\Documents && dir", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd %USERPROFILE%\\Documents && dir",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})
	})

	describe("Cross-platform Windows scenarios", () => {
		const winBaseCwd = "C:\\Users\\dev\\project"

		it("should handle Windows backslash paths", () => {
			const result = detectAndConvertCdPattern("cd src\\components && npm test", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "npm test",
				finalCwd: path.resolve(winBaseCwd, "src\\components"),
				wasConverted: true,
			})
		})

		it("should handle Windows UNC paths", () => {
			const result = detectAndConvertCdPattern('cd "\\\\server\\share\\folder" && dir', winBaseCwd)

			expect(result).toEqual({
				finalCommand: "dir",
				finalCwd: path.resolve(winBaseCwd, "\\\\server\\share\\folder"),
				wasConverted: true,
			})
		})

		it("should handle Windows drive letters", () => {
			const result = detectAndConvertCdPattern("cd D:\\projects\\app && npm start", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "npm start",
				finalCwd: path.resolve(winBaseCwd, "D:\\projects\\app"),
				wasConverted: true,
			})
		})

		it("should handle Windows cmd.exe commands", () => {
			const result = detectAndConvertCdPattern("cd temp && del *.tmp", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "del *.tmp",
				finalCwd: path.resolve(winBaseCwd, "temp"),
				wasConverted: true,
			})
		})

		it("should handle PowerShell commands", () => {
			const result = detectAndConvertCdPattern("cd scripts && Get-ChildItem *.ps1", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "Get-ChildItem *.ps1",
				finalCwd: path.resolve(winBaseCwd, "scripts"),
				wasConverted: true,
			})
		})
	})

	describe("Cross-platform Unix/Linux scenarios", () => {
		const unixBaseCwd = "/home/dev/project"

		it("should handle Unix forward slash paths", () => {
			const result = detectAndConvertCdPattern("cd src/components && npm test", unixBaseCwd)

			expect(result).toEqual({
				finalCommand: "npm test",
				finalCwd: path.resolve(unixBaseCwd, "src/components"),
				wasConverted: true,
			})
		})

		it("should handle Unix hidden directories", () => {
			const result = detectAndConvertCdPattern("cd .config && ls -la", unixBaseCwd)

			expect(result).toEqual({
				finalCommand: "ls -la",
				finalCwd: path.resolve(unixBaseCwd, ".config"),
				wasConverted: true,
			})
		})

		it("should handle Unix root paths", () => {
			const result = detectAndConvertCdPattern("cd /etc && cat hosts", unixBaseCwd)

			expect(result).toEqual({
				finalCommand: "cat hosts",
				finalCwd: "/etc",
				wasConverted: true,
			})
		})

		it("should handle Unix home directory shortcuts", () => {
			const result = detectAndConvertCdPattern("cd ~/Documents && find . -name '*.txt'", unixBaseCwd)

			expect(result).toEqual({
				finalCommand: "find . -name '*.txt'",
				finalCwd: path.resolve(unixBaseCwd, "~/Documents"),
				wasConverted: true,
			})
		})

		it("should handle complex Unix commands with pipes", () => {
			const result = detectAndConvertCdPattern("cd logs && tail -f app.log | grep ERROR", unixBaseCwd)

			expect(result).toEqual({
				finalCommand: "tail -f app.log | grep ERROR",
				finalCwd: path.resolve(unixBaseCwd, "logs"),
				wasConverted: true,
			})
		})
	})

	describe("macOS-specific scenarios", () => {
		const macBaseCwd = "/Users/dev/project"

		it("should handle macOS Applications folder", () => {
			const result = detectAndConvertCdPattern('cd "/Applications/Xcode.app" && ls -la', macBaseCwd)

			expect(result).toEqual({
				finalCommand: "ls -la",
				finalCwd: "/Applications/Xcode.app",
				wasConverted: true,
			})
		})

		it("should handle macOS user directories", () => {
			const result = detectAndConvertCdPattern("cd ~/Library/Preferences && ls", macBaseCwd)

			expect(result).toEqual({
				finalCommand: "ls",
				finalCwd: path.resolve(macBaseCwd, "~/Library/Preferences"),
				wasConverted: true,
			})
		})
	})

	describe("Shell-specific command variations", () => {
		it("should handle bash-style commands", () => {
			const result = detectAndConvertCdPattern("cd build && make clean && make", baseCwd)

			expect(result).toEqual({
				finalCommand: "make clean && make",
				finalCwd: path.resolve(baseCwd, "build"),
				wasConverted: true,
			})
		})

		it("should handle zsh-style commands", () => {
			const result = detectAndConvertCdPattern("cd src && find . -name '*.ts' -exec echo {} \\;", baseCwd)

			expect(result).toEqual({
				finalCommand: "find . -name '*.ts' -exec echo {} \\;",
				finalCwd: path.resolve(baseCwd, "src"),
				wasConverted: true,
			})
		})

		it("should handle fish shell commands", () => {
			const result = detectAndConvertCdPattern("cd tests && python -m pytest --verbose", baseCwd)

			expect(result).toEqual({
				finalCommand: "python -m pytest --verbose",
				finalCwd: path.resolve(baseCwd, "tests"),
				wasConverted: true,
			})
		})
	})

	describe("Development workflow scenarios", () => {
		it("should handle Node.js workflows", () => {
			const result = detectAndConvertCdPattern("cd frontend && npm ci && npm run build", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm ci && npm run build",
				finalCwd: path.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should handle Python workflows", () => {
			const result = detectAndConvertCdPattern(
				"cd backend && python -m venv venv && source venv/bin/activate",
				baseCwd,
			)

			expect(result).toEqual({
				finalCommand: "python -m venv venv && source venv/bin/activate",
				finalCwd: path.resolve(baseCwd, "backend"),
				wasConverted: true,
			})
		})

		it("should handle Docker workflows", () => {
			const result = detectAndConvertCdPattern("cd docker && docker build -t myapp .", baseCwd)

			expect(result).toEqual({
				finalCommand: "docker build -t myapp .",
				finalCwd: path.resolve(baseCwd, "docker"),
				wasConverted: true,
			})
		})

		it("should handle Git workflows", () => {
			const result = detectAndConvertCdPattern("cd .git && git log --oneline -10", baseCwd)

			expect(result).toEqual({
				finalCommand: "git log --oneline -10",
				finalCwd: path.resolve(baseCwd, ".git"),
				wasConverted: true,
			})
		})
	})

	describe("Advanced quote and escape scenarios", () => {
		it("should handle mixed quotes", () => {
			const result = detectAndConvertCdPattern(`cd 'path with "nested" quotes' && ls`, baseCwd)

			expect(result).toEqual({
				finalCommand: "ls",
				finalCwd: path.resolve(baseCwd, 'path with "nested" quotes'),
				wasConverted: true,
			})
		})

		it("should handle paths with special characters", () => {
			const result = detectAndConvertCdPattern("cd 'folder (with) [brackets] & symbols' && npm test", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm test",
				finalCwd: path.resolve(baseCwd, "folder (with) [brackets] & symbols"),
				wasConverted: true,
			})
		})

		it("should handle very long paths", () => {
			const longPath = "very/long/nested/path/structure/that/goes/deep/into/subdirectories"
			const result = detectAndConvertCdPattern(`cd ${longPath} && ls -la`, baseCwd)

			expect(result).toEqual({
				finalCommand: "ls -la",
				finalCwd: path.resolve(baseCwd, longPath),
				wasConverted: true,
			})
		})
	})

	describe("Error and edge case scenarios", () => {
		it("should handle empty input", () => {
			const result = detectAndConvertCdPattern("", baseCwd)

			expect(result).toEqual({
				finalCommand: "",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should handle whitespace variations", () => {
			const result = detectAndConvertCdPattern("cd   frontend   &&   npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should handle absolute paths", () => {
			const result = detectAndConvertCdPattern("cd /usr/local/bin && ls", baseCwd)

			expect(result).toEqual({
				finalCommand: "ls",
				finalCwd: "/usr/local/bin",
				wasConverted: true,
			})
		})

		it("should handle malformed quotes", () => {
			const result = detectAndConvertCdPattern('cd "unclosed quote && npm install', baseCwd)

			// Our custom tokenizer handles this case by treating the unclosed quote as part of the path
			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.resolve(baseCwd, "unclosed quote"),
				wasConverted: true,
			})
		})

		it("should handle cd with no path argument", () => {
			const result = detectAndConvertCdPattern("cd && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd && npm install",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should handle multiple && operators", () => {
			const result = detectAndConvertCdPattern("cd src && npm test && npm run lint", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm test && npm run lint",
				finalCwd: path.resolve(baseCwd, "src"),
				wasConverted: true,
			})
		})

		// Additional tests for the custom tokenizer robustness
		it("should preserve complex quoted commands exactly", () => {
			const result = detectAndConvertCdPattern('cd src && echo "Hello && World" | grep "&&"', baseCwd)

			expect(result).toEqual({
				finalCommand: 'echo "Hello && World" | grep "&&"',
				finalCwd: path.resolve(baseCwd, "src"),
				wasConverted: true,
			})
		})

		it("should handle mixed quote types in command", () => {
			const result = detectAndConvertCdPattern(`cd 'test dir' && echo "mixed 'quotes'" && ls`, baseCwd)

			expect(result).toEqual({
				finalCommand: `echo "mixed 'quotes'" && ls`,
				finalCwd: path.resolve(baseCwd, "test dir"),
				wasConverted: true,
			})
		})
	})
})
