import treeKill = require("tree-kill");
import * as childProcess from "child_process";
import * as path from "path";
import * as fs from "fs";
import { VirtualTerminal } from "./VirtualTerminal";
import * as vscode from "vscode";
import { showErrorMessage } from "./util/showMessage";

interface WorkspaceCompilerRuntime extends vscode.Disposable {
	startCompilerForWorkspace(workspace: vscode.WorkspaceFolder): void;
	startCompilerForDefaultWorkspace(): void;
}

interface ActiveCompilerState {
	readonly workspace: vscode.WorkspaceFolder;
	readonly terminal: VirtualTerminal;
	compilerProcess?: childProcess.ChildProcessWithoutNullStreams;
	statusBarItem?: vscode.StatusBarItem;
	pendingExit?: true;
}

interface WorkspacePickItem extends vscode.QuickPickItem {
	workspace: vscode.WorkspaceFolder | undefined;
}

export function registerCompilerRuntime(context: vscode.ExtensionContext): WorkspaceCompilerRuntime {
	const activeCompilers = new Map<vscode.WorkspaceFolder, ActiveCompilerState>();
	const terminals = new Map<vscode.WorkspaceFolder, VirtualTerminal>();

	const getWorkspaceCompilerTerminal = (workspace: vscode.WorkspaceFolder) => {
		let terminal = terminals.get(workspace);
		if (!terminal) {
			terminal = new VirtualTerminal("Airship");
			context.subscriptions.push(terminal);

			terminal.onClose(() => {
				for (const [, activeCompiler] of activeCompilers) {
					if (activeCompiler.terminal === terminal) {
						activeCompiler.pendingExit = true;
						stopCompilers(activeCompiler.workspace);
					}
				}
			});

			terminals.set(workspace, terminal);
		}

		return terminal;
	};

	const compileStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 500);

	const workspaceFolderCount = vscode.workspace.workspaceFolders?.length ?? 0;

	const statusBarDefaultState = () => {
		if (workspaceFolderCount > 1) {
			compileStatusBarItem.text = "$(run-all) Run Airship TS Compiler...";
		} else {
			compileStatusBarItem.text = "$(run) Run Airship TS Compiler";
		}

		compileStatusBarItem.command = "airship.start";
		compileStatusBarItem.color = undefined;
	};

	const updateStatusButtonVisibility = () => {
		const canCompileCode =
			workspaceFolderCount === 1 ||
			(vscode.workspace.workspaceFolders?.some((f) => {
				const hasCompiler = fs.existsSync(path.join(f.uri.fsPath, "node_modules", ".bin", "utsc"));
				return !activeCompilers.has(f) && hasCompiler;
			}) ??
				false);

		if (vscode.workspace.getConfiguration("airship.command.status").get("show", true) && canCompileCode) {
			compileStatusBarItem.show();
		} else {
			compileStatusBarItem.hide();
		}
	};

	//let compilerProcesses = new Array<childProcess.ChildProcessWithoutNullStreams>();
	//let compilerPendingExit = false;

	const startCompilers = async (workspaces?: readonly vscode.WorkspaceFolder[]) => {
		workspaces = workspaces ?? vscode.workspace.workspaceFolders;
		if (!workspaces) return showErrorMessage("Not in a workspace");

		if (workspaces.length > 1) {
			const items = new Array<WorkspacePickItem>();
			for (const workspace of workspaces) {
				const hasCompiler = fs.existsSync(path.join(workspace.uri.fsPath, "node_modules", ".bin", "utsc"));

				if (hasCompiler && !activeCompilers.has(workspace)) {
					items.push({
						label: `$(folder) ${workspace.name}`,
						description: workspace.uri.fsPath,
						workspace: workspace,
						// detail: " Test description lol",
					});
				}
			}

			if (items.length > 0) {
				items.unshift({
					label: "$(file-submodule) All",
					detail: "Run the TypeScript compiler for all workspaces",
					workspace: undefined,
				});
			} else {
				items.unshift({
					label: "$(error) No available workspaces, or all projects already running",
					workspace: undefined,
				});
			}

			if (items.length === 0) {
				return;
			}

			const result = await vscode.window.showQuickPick(items);
			if (!result) {
				return;
			}

			if (result.workspace) workspaces = [result.workspace];
		}

		if (workspaceFolderCount === 1) {
			compileStatusBarItem.text = "$(debug-stop) Stop Airship TS Compiler";
			compileStatusBarItem.command = "airship.stop";
			compileStatusBarItem.color = new vscode.ThemeColor("terminal.ansiRed");
		}

		for (const workspace of workspaces) {
			if (activeCompilers.has(workspace)) continue;

			const hasCompiler = fs.existsSync(path.join(workspace.uri.fsPath, "node_modules", ".bin", "utsc"));
			if (!hasCompiler) continue;

			startCompiler(workspace);
		}
	};

	const startCompiler = async (workspace: vscode.WorkspaceFolder) => {
		let state: ActiveCompilerState = {
			workspace,
			terminal: getWorkspaceCompilerTerminal(workspace),
		};
		activeCompilers.set(workspace, state);

		if (workspaceFolderCount > 1) {
			state.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 490);
			state.statusBarItem.text = "$(debug-stop) Stop Compiler for '" + workspace.name + "'";
			state.statusBarItem.color = new vscode.ThemeColor("terminal.ansiRed");
			state.statusBarItem.show();
			state.statusBarItem.command = {
				title: "",
				command: "airship.stop",
				arguments: [workspace],
				tooltip: "stop",
			};
		}

		const outputChannel = state.terminal;
		outputChannel.name = `Compiler: ${workspace.name}`;

		let compilerProcess: childProcess.ChildProcessWithoutNullStreams;

		const workspacePath = workspace.uri.fsPath;
		const options = {
			cwd: workspacePath.toString(),
			shell: true,
		};

		outputChannel.show();
		outputChannel.appendLine("Starting TypeScript Compiler...");

		const commandConfiguration = vscode.workspace.getConfiguration("airship.command");
		const parameters = commandConfiguration.get<Array<string>>("parameters", [
			"build",
			"--watch",
			"--writeOnlyChanged",
		]);

		const development = commandConfiguration.get("development", false);
		const compilerCommand = development ? "utsc-dev" : "utsc";

		// Detect if there is a local install
		const localInstall = path.join(workspacePath, "node_modules", ".bin", "utsc");

		vscode.commands.executeCommand("setContext", "airship:compilerActive", true);
		if (!development) {
			// outputChannel.appendLine("Detected local install, using local install instead of global");
			outputChannel.appendLine(`Starting compilation for project ${workspacePath}`);
			compilerProcess = childProcess.spawn(`"${localInstall.replaceAll(/"/g, '\\"')}"`, parameters, options);
		} else {
			compilerProcess = childProcess.spawn(compilerCommand, parameters, options);
		}

		compilerProcess.on("error", (error) => {
			const errorMessage = `Error while starting compiler: ${error.message}`;
			showErrorMessage(errorMessage);
			outputChannel.appendLine(errorMessage);
		});

		compilerProcess.stdout.on("data", (chunk) => outputChannel.append(chunk.toString()));
		compilerProcess.stderr.on("data", (chunk) => outputChannel.append(chunk.toString()));

		compilerProcess.on("exit", (exitCode) => {
			// vscode.commands.executeCommand("setContext", "airship:compilerActive", false);

			if (exitCode && !state.pendingExit) {
				stopCompilers(state.workspace);

				vscode.window.showErrorMessage("Compiler did not exit successfully.", "Show Output").then((choice) => {
					if (!choice) return;
					outputChannel.show();
				});
			}

			outputChannel.appendLine(`Compiler exited with code ${exitCode ?? 0}`);
			updateStatusButtonVisibility();
		});

		state.compilerProcess = compilerProcess;
		updateStatusButtonVisibility();
	};

	const cleanupCompiler = (activeCompiler: ActiveCompilerState) => {
		activeCompiler.pendingExit = true;
		activeCompiler?.statusBarItem?.dispose();

		if (activeCompiler.compilerProcess) {
			treeKill(activeCompiler.compilerProcess.pid);
		}

		activeCompilers.delete(activeCompiler.workspace);
		updateStatusButtonVisibility();
	};

	const stopCompilers = async (workspace?: vscode.WorkspaceFolder) => {
		if (workspace) {
			const activeCompiler = activeCompilers.get(workspace);
			if (!activeCompiler) return;

			cleanupCompiler(activeCompiler);
		} else {
			for (const [, compiler] of activeCompilers) {
				cleanupCompiler(compiler);
			}

			activeCompilers.clear();
			statusBarDefaultState();
		}
	};

	statusBarDefaultState();
	updateStatusButtonVisibility();

	context.subscriptions.push(vscode.commands.registerCommand("airship.start", startCompilers));
	context.subscriptions.push(vscode.commands.registerCommand("airship.stop", stopCompilers));
	context.subscriptions.push(compileStatusBarItem);
	// context.subscriptions.push(outputChannel);

	// Reconfigure the plugin when vscode settings change.
	vscode.workspace.onDidChangeConfiguration(
		(e) => {
			if (e.affectsConfiguration("airship")) {
				updateStatusButtonVisibility();
			}
		},
		undefined,
		context.subscriptions,
	);

	return {
		startCompilerForWorkspace(workspace) {},
		startCompilerForDefaultWorkspace() {},
		dispose() {
			activeCompilers.forEach((compiler) => {
				compiler.terminal.dispose();
				if (compiler.compilerProcess) {
					treeKill(compiler.compilerProcess.pid);
				}
				compiler.statusBarItem?.dispose();
			});
		},
	};
}
