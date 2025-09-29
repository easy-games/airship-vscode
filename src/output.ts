import * as vscode from "vscode";
import path from "path";
import fs from "fs";
import { getCompilerOptionsAtFile } from "./util/compilerOptions";
import { showErrorMessage } from "./util/showMessage";
import { isPathInSrc } from "./util/isPathInSrc";
import { PathTranslator } from "./util/PathTranslator";

export function openOutputCommand(uri?: vscode.Uri) {
	var currentFile = uri?.fsPath ?? vscode.window.activeTextEditor?.document.fileName;
	if (!currentFile) return showErrorMessage("No file selected");

	const result = getCompilerOptionsAtFile(currentFile);
	if (!result) return showErrorMessage("tsconfig not found");

	const [tsconfigPath, compilerOptions] = result;
	if (!compilerOptions) return showErrorMessage("compilerOptions not found");

	if (!compilerOptions.outDir) return showErrorMessage("outDir not specified");
	if (!isPathInSrc(currentFile, result)) return showErrorMessage("File not in srcDir: " + currentFile);

	const basePath = path.dirname(tsconfigPath);
	const pathTranslator = new PathTranslator(basePath, path.join(basePath, compilerOptions.outDir), undefined, true);

	const outputPath = pathTranslator.getOutputPath(currentFile);
	console.log("outputPath is ", outputPath, "from base path", basePath);
	if (!fs.existsSync(outputPath))
		return showErrorMessage(
			"Output file could not be found",
			true,
			"The output file for this TypeScript source file could not be found, make sure the unity editor is running the TypeScript compiler and try again.",
		);

	const openToSide = vscode.workspace.getConfiguration("airship").get<boolean>("openOutputToSide", true);
	const viewColumn = openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
	vscode.workspace
		.openTextDocument(vscode.Uri.file(outputPath))
		.then((document) => vscode.window.showTextDocument(document, viewColumn));
}

export const enum OpenOutputCommand {
	editor,
	server,
	client,
}
export function createOutputOpenCommand(context: OpenOutputCommand) {
	return (uri?: vscode.Uri) => {
		var currentFile = uri?.fsPath ?? vscode.window.activeTextEditor?.document.fileName;
		if (!currentFile) return showErrorMessage("No file selected");

		const result = getCompilerOptionsAtFile(currentFile);
		if (!result) return showErrorMessage("tsconfig not found");

		const [tsconfigPath, compilerOptions] = result;
		if (!compilerOptions) return showErrorMessage("compilerOptions not found");

		if (!compilerOptions.outDir) return showErrorMessage("outDir not specified");
		if (!isPathInSrc(currentFile, result)) return showErrorMessage("File not in srcDir: " + currentFile);

		const basePath = path.dirname(tsconfigPath);

		let outPath: string;
		switch (context) {
			case OpenOutputCommand.editor:
				outPath = path.join(basePath, compilerOptions.outDir);
				break;
			case OpenOutputCommand.server:
				outPath = path.join(basePath, "TypeScript~", "dist", "server");
				break;
			case OpenOutputCommand.client:
				outPath = path.join(basePath,  "TypeScript~", "dist", "client");
				break;
		}

		const pathTranslator = new PathTranslator(basePath, outPath, undefined, true);

		const outputPath = pathTranslator.getOutputPath(currentFile);
		console.log("outputPath is ", outputPath, "from base path", basePath);
		if (!fs.existsSync(outputPath))
			return showErrorMessage(
				"Output file could not be found",
				true,
				"The output file for this TypeScript source file could not be found, make sure the unity editor is running the TypeScript compiler and try again.",
			);

		const openToSide = vscode.workspace.getConfiguration("airship").get<boolean>("openOutputToSide", true);
		const viewColumn = openToSide ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active;
		vscode.workspace
			.openTextDocument(vscode.Uri.file(outputPath))
			.then((document) => vscode.window.showTextDocument(document, viewColumn));
	};
}
