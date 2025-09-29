import { existsSync, readFileSync } from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { makeColorProvider } from "./colorizePrint";
import { getCompilerOptionsAtFile } from "./util/compilerOptions";
import { isPathInSrc } from "./util/isPathInSrc";
import { PathTranslator } from "./util/PathTranslator";
import { showErrorMessage } from "./util/showMessage";
import { highlightDirectives, registerAirshipComponentFeatures } from "./airshipComponents";
import { AirshipBehaviourMetadata } from "./types";
import { getAirshipBehaviourInfo, tryParseSourceFile } from "./tss";
import { createOutputOpenCommand, OpenOutputCommand, openOutputCommand } from "./output";
import {
	ExtensionColorConfiguration,
	ExtensionCommand,
	ExtensionConfiguration,
	ExtensionEditorConfiguration,
	ExtensionInternalCommand,
} from "./commands";
import ts from "typescript";

interface APIV0 {
	configurePlugin(pluginId: string, configuration: {}): void;
}

interface TypescriptLanguageFeatures {
	getAPI(value: 0): APIV0;
}

export async function activate(context: vscode.ExtensionContext) {
	// Retrieve a reference to vscode's typescript extension.
	const extension = vscode.extensions.getExtension<TypescriptLanguageFeatures>("vscode.typescript-language-features");
	if (!extension) {
		return console.log("extension failed");
	}

	// Wait for extension to be activated, if not already active.
	await extension.activate();

	console.log("activated Airship extension");

	if (!extension.exports || !extension.exports.getAPI) {
		return console.log("extension exports failed");
	}

	// Get the language server's API for configuring plugins.
	const api = extension.exports.getAPI(0);
	if (!api) {
		return console.log("extension api failed");
	}
	configurePlugin(api);

	// Reconfigure the plugin when vscode settings change.
	vscode.workspace.onDidChangeConfiguration(
		(e) => {
			if (e.affectsConfiguration("airship")) {
				configurePlugin(api);
			}
		},
		undefined,
		context.subscriptions,
	);

	let shouldShowOutput = false;
	const openOutputFile = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 500);
	openOutputFile.text = "$(file-code) View Compiled";
	openOutputFile.command = ExtensionCommand.openOutput;

	const updateOpenOutputState = () => {
		if (shouldShowOutput) {
			openOutputFile.show();
		} else {
			openOutputFile.hide();
		}
	};

	highlightDirectives();

	// Enable airship.openOutput whenever in source directory.
	vscode.window.onDidChangeActiveTextEditor(
		(e) => {
			if (e) {
				const isInSrc = isPathInSrc(e.document.fileName);
				shouldShowOutput = isInSrc;
				vscode.commands.executeCommand("setContext", ExtensionInternalCommand.inSrcDir, isInSrc);
				vscode.commands.executeCommand(
					"setContext",
					ExtensionInternalCommand.isSourceFile,
					e.document.fileName.endsWith(".ts") && isInSrc,
				);
				updateOpenOutputState();
			}
		},
		undefined,
		context.subscriptions,
	);

	// Register commands.
	context.subscriptions.push(vscode.commands.registerCommand(ExtensionCommand.openOutput, openOutputCommand));
	context.subscriptions.push(
		vscode.commands.registerCommand(
			ExtensionCommand.openPublishedOutputServer,
			createOutputOpenCommand(OpenOutputCommand.server),
		),
	);
	context.subscriptions.push(
		vscode.commands.registerCommand(
			ExtensionCommand.openPublishedOutputClient,
			createOutputOpenCommand(OpenOutputCommand.client),
		),
	);
	registerAirshipComponentFeatures(context);

	const colorConfiguration = vscode.workspace.getConfiguration(ExtensionConfiguration.colorPicker);
	if (colorConfiguration.get(ExtensionColorConfiguration.enabled, true)) {
		makeColorProvider().forEach((provider) => context.subscriptions.push(provider));
	}

	vscode.commands.executeCommand(
		"setContext",
		ExtensionInternalCommand.inSrcDir,
		vscode.window.activeTextEditor?.document.uri.fsPath ?? false,
	);
	vscode.commands.executeCommand("setContext", ExtensionInternalCommand.compilerActive, false);

	const activeText = vscode.window.activeTextEditor;
	if (activeText) {
		shouldShowOutput = isPathInSrc(activeText.document.fileName);
		vscode.commands.executeCommand(
			"setContext",
			ExtensionInternalCommand.isSourceFile,
			activeText.document.fileName.endsWith(".ts") && shouldShowOutput,
		);
		updateOpenOutputState();
	}

	function ncifyName(name: string) {
		if (name.startsWith("_") || name.startsWith("k")) {
			name = name.substring(1);
		}

		let newStr = "";
		for (let i = 0; i < name.length; i++) {
			const charAt = name.at(i);
			if (i === 0) {
				newStr += charAt?.toUpperCase();
			} else if (charAt?.toUpperCase() === charAt) {
				newStr += " " + charAt;
			} else if (charAt) {
				newStr += charAt;
			}
		}

		return newStr;
	}

	// const DECLARATION_REGEX = /export default class ([A-z][a-z0-9_]+) extends (AirshipBehaviour|AirshipSingleton)/gi;
	vscode.languages.registerCodeLensProvider(
		{ language: "typescript", scheme: "file" },
		new (class implements vscode.CodeLensProvider {
			constructor() {}

			onDidChangeCodeLenses?: vscode.Event<void> | undefined;

			provideCodeLenses(
				document: vscode.TextDocument,
				token: vscode.CancellationToken,
			): vscode.ProviderResult<vscode.CodeLens[]> {
				const lenses = new Array<vscode.CodeLens>();
				const documentText = document.getText();

				const info = getAirshipBehaviourInfo(document, documentText);
				if (info.behaviour) {
					const { textSpan, name } = info.behaviour;
					const position = document.positionAt(textSpan.start);

					lenses.push(
						new vscode.CodeLens(
							new vscode.Range(position, document.positionAt(textSpan.start + textSpan.length)),
							{
								command: undefined!,
								tooltip: "",
								title: `AirshipComponent "${ncifyName(name)}"`,
							},
						),
					);
				}

				if (info.serverMethods) {
					for (const method of info.serverMethods) {
						const position = document.positionAt(method.span.start);

						lenses.push(
							new vscode.CodeLens(
								new vscode.Range(position, document.positionAt(method.span.start + method.span.length)),
								{
									command: undefined!,
									tooltip: "This method is only available to the server, and will be stripped on the client",
									title: `Server-only Method`,
								},
							),
						);
					}
				}

				if (info.clientMethods) {
					for (const method of info.clientMethods) {
						const position = document.positionAt(method.span.start);

						lenses.push(
							new vscode.CodeLens(
								new vscode.Range(position, document.positionAt(method.span.start + method.span.length)),
								{
									command: undefined!,
									tooltip: "This method is only available on the client, and will be stripped on the server.",
									title: `Client-only Method`,
								},
							),
						);
					}
				}

				return lenses;
			}
			resolveCodeLens?(
				codeLens: vscode.CodeLens,
				token: vscode.CancellationToken,
			): vscode.ProviderResult<vscode.CodeLens> {
				throw new Error("Method not implemented.");
			}
		})(),
	);

	console.log("airship extensions has loaded");
}

export function configurePlugin(api: APIV0) {
	const editor = vscode.workspace.getConfiguration(ExtensionConfiguration.editor);
	// const boundary = vscode.workspace.getConfiguration("airship.boundary");
	// const paths = vscode.workspace.getConfiguration("airship.boundary.paths");

	// Updates the settings that the language service plugin uses.
	api.configurePlugin("@easy-games/airship-typescript-extensions", {
		// mode: boundary.get("mode"),
		// useRojo: boundary.get("useRojo"),
		// server: paths.get("serverPaths"),
		// client: paths.get("clientPaths"),
		hideDeprecated: editor.get(ExtensionEditorConfiguration.hideDeprecated),
	});
}

// this method is called when your extension is deactivated
export function deactivate() {}
