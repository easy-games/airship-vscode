export const enum ExtensionCommand {
	openOutput = "airship.openOutput",
	createComponent = "airship.create-component",
	createSingleton = "airship.create-singleton",

	openPublishedOutputServer = "airship.openPublishedOutputServer",
	openPublishedOutputClient = "airship.openPublishedOutputClient",
}

export const enum ExtensionConfiguration {
	colorPicker = "airship.colorPicker",
	editor = "airship.editor",
	networkBoundary = "airship.networkBoundary",
}

export const enum ExtensionColorConfiguration {
	enabled = "enabled",
}

export const enum ExtensionEditorConfiguration {
	hideDeprecated = "hideDeprecated",
}

export const enum ExtensionInternalCommand {
	compilerActive = "airship:compilerActive",
	isSourceFile = "airship:isSourceFile",
	inSrcDir = "airship:inSrcDir",
}
