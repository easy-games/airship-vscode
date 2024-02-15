import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

async function createAirshipComponentFile(componentName: string, uri: vscode.Uri) {
	if (/(^[A-z0-9\.-]+$)/g.test(componentName)) {
		const fileToCreate = path.join(uri.fsPath, `${componentName}.ts`);

		const template = new vscode.SnippetString(
			"export default class ${TM_FILENAME_BASE/(.*)/${1:/pascalcase}/g} extends AirshipBehaviour {\n" +
				"\toverride Start(): void {\n" +
				"\t\t${0}\n" +
				"\t}\n" +
				"\n" +
				"\toverride OnDestroy(): void {}\n" +
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
					prompt: "Enter a name for the component (location: " + vscode.workspace.asRelativePath(uri.fsPath) + ")",
                    placeHolder: "The component name, e.g. SpinnerComponent",
                    validateInput: async (componentName) => {
                        if (/(^[A-z0-9\.-]+$)/g.test(componentName)) {
                            return undefined;
                        } else {
                            return 'Invalid Component Name: ' + componentName;
                        }
                    }
				});

				if (!fileName) return;

				createAirshipComponentFile(fileName, uri);
			}
		}),
	);
}
