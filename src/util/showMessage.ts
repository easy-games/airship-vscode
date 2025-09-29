import * as vscode from "vscode";

export function showErrorMessage(message: string, modal = false, modalDetail?: string) {
	vscode.window.showErrorMessage(message, { modal, detail: modalDetail });
}
