import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import ts from "typescript";

async function createAirshipComponentFile(componentName: string, uri: vscode.Uri) {
	if (/(^[A-z0-9\.-]+$)/g.test(componentName)) {
		const fileToCreate = path.join(uri.fsPath, `${componentName}.ts`);

		const template = new vscode.SnippetString(
			"export default class ${TM_FILENAME_BASE/(.*)/${1:/pascalcase}/g} extends AirshipBehaviour {\n" +
				"\tprotected Start(): void {\n" +
				"\t\t${0}\n" +
				"\t}\n" +
				"\n" +
				"\tprotected OnDestroy(): void {}\n" +
				"}\n" +
				"",
		);

		fs.writeFileSync(fileToCreate, "");
		const document = await vscode.workspace.openTextDocument(fileToCreate);
		const editor = await vscode.window.showTextDocument(document);
		editor.insertSnippet(template, new vscode.Position(0, 0));
		document.save();
	} else {
		vscode.window.showErrorMessage(
			"Could not create Component with name '" + componentName + "' - not a valid name for a component.",
		);
	}
}

async function createAirshipSingletonFile(componentName: string, uri: vscode.Uri) {
	if (/(^[A-z0-9\.-]+$)/g.test(componentName)) {
		const fileToCreate = path.join(uri.fsPath, `${componentName}.ts`);

		const template = new vscode.SnippetString(
			"export default class ${TM_FILENAME_BASE/(.*)/${1:/pascalcase}/g} extends AirshipSingleton {\n" +
				"\tprotected Start(): void {\n" +
				"\t\t${0}\n" +
				"\t}\n" +
				"}\n" +
				"",
		);

		fs.writeFileSync(fileToCreate, "");
		const document = await vscode.workspace.openTextDocument(fileToCreate);
		const editor = await vscode.window.showTextDocument(document);
		editor.insertSnippet(template, new vscode.Position(0, 0));
		document.save();
	} else {
		vscode.window.showErrorMessage(
			"Could not create Component with name '" + componentName + "' - not a valid name for a component.",
		);
	}
}

export function registerAirshipComponentFeatures(context: vscode.ExtensionContext) {
	context.subscriptions.push(
		vscode.commands.registerCommand("airship.create-component", async (...args) => {
			let uri: vscode.Uri | undefined;
			if (args.length > 0 && args[0] instanceof vscode.Uri) {
				[uri] = args;
			} else {
				const workspaces = vscode.workspace.workspaceFolders;
				if (workspaces) {
					let workspace: vscode.WorkspaceFolder | undefined;
					workspace = workspaces.length > 1 ? await vscode.window.showWorkspaceFolderPick({}) : workspaces[0];
					if (workspace) {
						uri = vscode.Uri.joinPath(workspace.uri, "src", "Shared");
					}
				} else {
					console.warn("no workspaces");
				}
			}

			if (uri) {
				const fileName = await vscode.window.showInputBox({
					prompt:
						"Enter a name for the component (location: " +
						vscode.workspace.asRelativePath(uri.fsPath) +
						")",
					placeHolder: "The component name, e.g. SpinnerComponent",
					validateInput: async (componentName) => {
						if (/(^[A-z0-9\.-]+$)/g.test(componentName)) {
							return undefined;
						} else {
							return "Invalid Component Name: " + componentName;
						}
					},
				});

				if (!fileName) return;

				createAirshipComponentFile(fileName, uri);
			}
		}),
		vscode.commands.registerCommand("airship.create-singleton", async (...args) => {
			let uri: vscode.Uri | undefined;
			if (args.length > 0 && args[0] instanceof vscode.Uri) {
				[uri] = args;
			} else {
				const workspaces = vscode.workspace.workspaceFolders;
				if (workspaces) {
					let workspace: vscode.WorkspaceFolder | undefined;
					workspace = workspaces.length > 1 ? await vscode.window.showWorkspaceFolderPick({}) : workspaces[0];
					if (workspace) {
						uri = vscode.Uri.joinPath(workspace.uri, "src", "Shared");
					}
				} else {
					console.warn("no workspaces");
				}
			}

			if (uri) {
				const fileName = await vscode.window.showInputBox({
					prompt:
						"Enter a name for the component (location: " +
						vscode.workspace.asRelativePath(uri.fsPath) +
						")",
					placeHolder: "The component name, e.g. SpinnerComponent",
					validateInput: async (componentName) => {
						if (/(^[A-z0-9\.-]+$)/g.test(componentName)) {
							return undefined;
						} else {
							return "Invalid Component Name: " + componentName;
						}
					},
				});

				if (!fileName) return;

				createAirshipSingletonFile(fileName, uri);
			}
		}),
	);
}

export function highlightDirectives() {
	const tokenTypes = ["macro"];
	const tokenModifiers = ["declaration", "documentation", "directive"];
	const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

	const provider: vscode.DocumentSemanticTokensProvider = {
		provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
			// analyze the document and return semantic tokens

			const tokensBuilder = new vscode.SemanticTokensBuilder(legend);

			let line = 0;
			for (const lineText of document.getText().split("\n")) {
				let re = /\$(SERVER|CLIENT)/gm;

				let match: RegExpExecArray | null = null;
				while ((match = re.exec(lineText)) !== null) {
					tokensBuilder.push(
						new vscode.Range(
							new vscode.Position(line, match.index),
							new vscode.Position(line, match.index + match[1].length + 1),
						),
						"macro",
						["directive"],
					);
				}
				line++;
			}

			line = 0;
			for (const lineText of document.getText().split("\n")) {
				let re = /@(Server|Client)\(.*\)/gm;

				let match: RegExpExecArray | null = null;
				while ((match = re.exec(lineText)) !== null) {
					tokensBuilder.push(
						new vscode.Range(
							new vscode.Position(line, match.index + 1),
							new vscode.Position(line, match.index + 1 + match[1].length),
						),
						"macro",
						["directive"],
					);
				}
				line++;
			}

			return tokensBuilder.build("test");
		},
	};

	const selector = { language: "typescript", scheme: "file" }; // register for all Java documents from the local file system

	// vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend);

	const PAT = /@(Server|Client)\(\)/gi;
	const PAT2 = /!?\$(SERVER|CLIENT)/gi;

	// vscode.languages.registerCodeActionsProvider(
	// 	{ scheme: "file", language: "typescript" },
	// 	{
	// 		provideCodeActions: function (
	// 			document: vscode.TextDocument,
	// 			range: vscode.Range | vscode.Selection,
	// 			context: vscode.CodeActionContext,
	// 			token: vscode.CancellationToken,
	// 		): vscode.ProviderResult<(vscode.CodeAction | vscode.Command)[]> {
	// 			throw new Error("Function not implemented.");
	// 		},
	// 	},
	// 	{},
	// );

	// vscode.languages.registerInlayHintsProvider(
	// 	{ scheme: "file", language: "typescript" },
	// 	new (class implements vscode.InlayHintsProvider {
	// 		onDidChangeInlayHints?: vscode.Event<void> | undefined;
	// 		provideInlayHints(
	// 			document: vscode.TextDocument,
	// 			range: vscode.Range,
	// 			token: vscode.CancellationToken,
	// 		): vscode.ProviderResult<vscode.InlayHint[]> {
	// 			const text = document.getText();
	// 			const hints: vscode.InlayHint[] = [];

	// 			for (const [foundExpr, position, exprLen] of this.findDirectiveDecorators(text)) {
	// 				hints.push(
	// 					new vscode.InlayHint(
	// 						document.positionAt(position + exprLen),
	// 						` [${foundExpr} Only]`,
	// 						vscode.InlayHintKind.Type,
	// 					),
	// 				);
	// 			}

	// 			// for (const [foundExpr, position, exprLen] of this.findDirectives(text)) {
	// 			// 	hints.push(
	// 			// 		new vscode.InlayHint(
	// 			// 			document.positionAt(position),
	// 			// 			`#directive `,
	// 			// 			vscode.InlayHintKind.Parameter,
	// 			// 		),
	// 			// 	);
	// 			// }

	// 			return hints;
	// 		}

	// 		private *findDirectiveDecorators(text: string) {
	// 			let match: RegExpExecArray | null;
	// 			while ((match = PAT.exec(text)) != null) {
	// 				const expr = match[1];

	// 				yield [expr, match.index, match[0].length] as const;
	// 			}
	// 		}

	// 		private *findDirectives(text: string) {
	// 			let match: RegExpExecArray | null;
	// 			while ((match = PAT2.exec(text)) != null) {
	// 				const expr = match[1];

	// 				yield [expr, match.index, match[0].length] as const;
	// 			}
	// 		}

	// 		// resolveInlayHint?(
	// 		// 	hint: vscode.InlayHint,
	// 		// 	token: vscode.CancellationToken,
	// 		// ): vscode.ProviderResult<vscode.InlayHint> {

	// 		// }
	// 	})(),
	// );
}
