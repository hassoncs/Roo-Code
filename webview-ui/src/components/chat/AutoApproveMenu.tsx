import { useCallback, useEffect, useMemo, useState } from "react"
import { Trans } from "react-i18next"
import { VSCodeCheckbox, VSCodeLink, VSCodeTextField } from "@vscode/webview-ui-toolkit/react"

import { vscode } from "@src/utils/vscode"
import { useExtensionState } from "@src/context/ExtensionStateContext"
import { useAppTranslation } from "@src/i18n/TranslationContext"
import { AutoApproveToggle, AutoApproveSetting, autoApproveSettingsConfig } from "../settings/AutoApproveToggle"

interface AutoApproveMenuProps {
	style?: React.CSSProperties
}

const AutoApproveMenu = ({ style }: AutoApproveMenuProps) => {
	const [isExpanded, setIsExpanded] = useState(false)
	const [costLimitInputValue, setCostLimitInputValue] = useState<string>("")

	const {
		autoApprovalEnabled,
		setAutoApprovalEnabled,
		alwaysAllowReadOnly,
		alwaysAllowWrite,
		alwaysAllowExecute,
		alwaysAllowBrowser,
		alwaysAllowMcp,
		alwaysAllowModeSwitch,
		alwaysAllowSubtasks,
		alwaysApproveResubmit,
		allowedMaxRequests,
		allowedMaxCostLimit,
		setAlwaysAllowReadOnly,
		setAlwaysAllowWrite,
		setAlwaysAllowExecute,
		setAlwaysAllowBrowser,
		setAlwaysAllowMcp,
		setAlwaysAllowModeSwitch,
		setAlwaysAllowSubtasks,
		setAlwaysApproveResubmit,
		setAllowedMaxRequests,
		setAllowedMaxCostLimit,
	} = useExtensionState()

	// Initialize the input value when the component mounts or when allowedMaxCostLimit changes
	useEffect(() => {
		const newLimit = allowedMaxCostLimit ?? Infinity
		if (newLimit === Infinity) {
			setCostLimitInputValue("Unlimited")
		} else {
			setCostLimitInputValue(`$${newLimit.toString()}`)
		}
	}, [allowedMaxCostLimit])

	const { t } = useAppTranslation()

	// Callback to update the actual cost limit value
	const updateCostLimit = useCallback(() => {
		const value = parseFloat(costLimitInputValue.replace(/[^0-9.]/g, ""))

		// If we got a valid number, use it; otherwise set to undefined
		if (!isNaN(value) && value > 0) {
			setAllowedMaxCostLimit(value)
			vscode.postMessage({ type: "allowedMaxCostLimit", value })
		} else {
			setAllowedMaxCostLimit(undefined)
			vscode.postMessage({ type: "allowedMaxCostLimit", value: undefined })
			setCostLimitInputValue("Unlimited")
		}
	}, [costLimitInputValue, setAllowedMaxCostLimit])

	const onAutoApproveToggle = useCallback(
		(key: AutoApproveSetting, value: boolean) => {
			vscode.postMessage({ type: key, bool: value })

			switch (key) {
				case "alwaysAllowReadOnly":
					setAlwaysAllowReadOnly(value)
					break
				case "alwaysAllowWrite":
					setAlwaysAllowWrite(value)
					break
				case "alwaysAllowExecute":
					setAlwaysAllowExecute(value)
					break
				case "alwaysAllowBrowser":
					setAlwaysAllowBrowser(value)
					break
				case "alwaysAllowMcp":
					setAlwaysAllowMcp(value)
					break
				case "alwaysAllowModeSwitch":
					setAlwaysAllowModeSwitch(value)
					break
				case "alwaysAllowSubtasks":
					setAlwaysAllowSubtasks(value)
					break
				case "alwaysApproveResubmit":
					setAlwaysApproveResubmit(value)
					break
			}
		},
		[
			setAlwaysAllowReadOnly,
			setAlwaysAllowWrite,
			setAlwaysAllowExecute,
			setAlwaysAllowBrowser,
			setAlwaysAllowMcp,
			setAlwaysAllowModeSwitch,
			setAlwaysAllowSubtasks,
			setAlwaysApproveResubmit,
		],
	)

	const toggleExpanded = useCallback(() => setIsExpanded((prev) => !prev), [])

	const toggles = useMemo(
		() => ({
			alwaysAllowReadOnly: alwaysAllowReadOnly,
			alwaysAllowWrite: alwaysAllowWrite,
			alwaysAllowExecute: alwaysAllowExecute,
			alwaysAllowBrowser: alwaysAllowBrowser,
			alwaysAllowMcp: alwaysAllowMcp,
			alwaysAllowModeSwitch: alwaysAllowModeSwitch,
			alwaysAllowSubtasks: alwaysAllowSubtasks,
			alwaysApproveResubmit: alwaysApproveResubmit,
		}),
		[
			alwaysAllowReadOnly,
			alwaysAllowWrite,
			alwaysAllowExecute,
			alwaysAllowBrowser,
			alwaysAllowMcp,
			alwaysAllowModeSwitch,
			alwaysAllowSubtasks,
			alwaysApproveResubmit,
		],
	)

	const enabledActionsList = Object.entries(toggles)
		.filter(([_key, value]) => !!value)
		.map(([key]) => t(autoApproveSettingsConfig[key as AutoApproveSetting].labelKey))
		.join(", ")

	const handleOpenSettings = useCallback(
		() =>
			window.postMessage({ type: "action", action: "settingsButtonClicked", values: { section: "autoApprove" } }),
		[],
	)

	return (
		<div
			style={{
				padding: "0 15px",
				userSelect: "none",
				borderTop: isExpanded
					? `0.5px solid color-mix(in srgb, var(--vscode-titleBar-inactiveForeground) 20%, transparent)`
					: "none",
				overflowY: "auto",
				...style,
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "8px",
					padding: isExpanded ? "8px 0" : "8px 0 0 0",
					cursor: "pointer",
				}}
				onClick={toggleExpanded}>
				<div onClick={(e) => e.stopPropagation()}>
					<VSCodeCheckbox
						checked={autoApprovalEnabled ?? false}
						onChange={() => {
							const newValue = !(autoApprovalEnabled ?? false)
							setAutoApprovalEnabled(newValue)
							vscode.postMessage({ type: "autoApprovalEnabled", bool: newValue })
						}}
					/>
				</div>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "4px",
						flex: 1,
						minWidth: 0,
					}}>
					<span
						style={{
							color: "var(--vscode-foreground)",
							flexShrink: 0,
						}}>
						{t("chat:autoApprove.title")}
					</span>
					<span
						style={{
							color: "var(--vscode-descriptionForeground)",
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							flex: 1,
							minWidth: 0,
						}}>
						{enabledActionsList || t("chat:autoApprove.none")}
					</span>
					<span
						className={`codicon codicon-chevron-${isExpanded ? "down" : "right"}`}
						style={{
							flexShrink: 0,
							marginLeft: isExpanded ? "2px" : "-2px",
						}}
					/>
				</div>
			</div>

			{isExpanded && (
				<div className="flex flex-col gap-2">
					<div
						style={{
							color: "var(--vscode-descriptionForeground)",
							fontSize: "12px",
						}}>
						<Trans
							i18nKey="chat:autoApprove.description"
							components={{
								settingsLink: <VSCodeLink href="#" onClick={handleOpenSettings} />,
							}}
						/>
					</div>

					{/* Auto-approve limits row */}
					<div
						style={{
							display: "flex",
							flexDirection: "column",
							gap: "8px",
							marginTop: "10px",
							marginBottom: "8px",
						}}>
						{/* Input fields row */}
						<div
							style={{
								display: "flex",
								gap: "16px",
								color: "var(--vscode-descriptionForeground)",
							}}>
							{/* Max Requests input */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									flex: 1,
								}}>
								<span style={{ flexShrink: 1, minWidth: 0 }}>Max Requests:</span>
								<VSCodeTextField
									value={
										(allowedMaxRequests ?? Infinity) === Infinity
											? "Unlimited"
											: allowedMaxRequests?.toString()
									}
									onInput={(e) => {
										const input = e.target as HTMLInputElement
										// Remove any non-numeric characters
										input.value = input.value.replace(/[^0-9]/g, "")
										const value = parseInt(input.value)
										const parsedValue = !isNaN(value) && value > 0 ? value : undefined
										setAllowedMaxRequests(parsedValue)
										vscode.postMessage({ type: "allowedMaxRequests", value: parsedValue })
									}}
									style={{ flex: 1 }}
								/>
							</div>

							{/* Max Cost input */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "8px",
									flex: 1,
								}}>
								<span style={{ flexShrink: 1, minWidth: 0 }}>Max Cost:</span>
								<VSCodeTextField
									value={costLimitInputValue}
									onInput={(e) => {
										const input = e.target as HTMLInputElement
										// Allow numeric characters and decimal point
										const sanitizedValue = input.value.replace(/[^0-9.]/g, "")

										// Ensure only one decimal point
										const decimalCount = (sanitizedValue.match(/\./g) || []).length
										let finalValue = sanitizedValue
										if (decimalCount > 1) {
											finalValue =
												sanitizedValue.substring(0, sanitizedValue.lastIndexOf(".")) +
												sanitizedValue.substring(sanitizedValue.lastIndexOf("."))
										}

										// Special case for "Unlimited"
										if (
											input.value.toLowerCase() === "u" ||
											input.value.toLowerCase().startsWith("un")
										) {
											setCostLimitInputValue("Unlimited")
										} else {
											setCostLimitInputValue(finalValue)
										}
									}}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											updateCostLimit()
										}
									}}
									onBlur={updateCostLimit}
									style={{ flex: 1 }}
								/>
							</div>
						</div>

						{/* Description */}
						<div
							style={{
								color: "var(--vscode-descriptionForeground)",
								fontSize: "12px",
								marginBottom: "10px",
							}}>
							<Trans i18nKey="settings:autoApprove.apiRequestLimit.description" />
						</div>
					</div>

					<AutoApproveToggle {...toggles} onToggle={onAutoApproveToggle} />
				</div>
			)}
		</div>
	)
}

export default AutoApproveMenu
