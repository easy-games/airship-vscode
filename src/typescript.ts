import ts from "typescript";
import fs from "fs";
import * as vscode from "vscode";
import { nicifyVariableName } from "./util/nicifyVariableName";

export function tryParseSourceFile(filePath: string, source?: string) {
	return ts.createSourceFile(filePath, source ?? fs.readFileSync(filePath).toString(), ts.ScriptTarget.ESNext);
}

function hasDefaultExport(node: ts.ClassDeclaration) {
	return (
		node.modifiers &&
		node.modifiers.some((v) => ts.isExportModifier(v)) &&
		node.modifiers.some((v) => ts.isDefaultModifier(v))
	);
}

function getExtends(node: ts.ClassDeclaration) {
	const { heritageClauses } = node;
	if (!heritageClauses) return undefined;

	for (const heritageClause of heritageClauses) {
		if (heritageClause.token === ts.SyntaxKind.ExtendsKeyword) {
			return heritageClause.types[0].expression;
		}
	}
}

interface AirshipBehaviourInfo {
	name: string;
	readonly node: ts.ClassDeclaration;
	readonly textSpan: ts.TextSpan;
}

interface AirshipMethod {
	readonly node: ts.MethodDeclaration;
	readonly span: ts.TextSpan;
}

interface AirshipFile {
	readonly behaviour?: AirshipBehaviourInfo;

	readonly serverMethods?: AirshipMethod[];
	readonly clientMethods?: AirshipMethod[];
}

type AirshipContextDecorator = ts.Decorator & {
	expression: ts.CallExpression & {
		expression: ts.Identifier & {
			text: ContextDecoratorName;
		};
	};
};

type ContextDecoratorName = "Server" | "Client";
const contextDecorators: ContextDecoratorName[] = ["Server", "Client"];

function getDecorator(expression: ts.CallExpression) {
	if (ts.isIdentifier(expression.expression)) {
		return { name: expression.expression.text, arguments: expression.arguments };
	}
}

export function getAirshipBehaviourInfo(document: vscode.TextDocument, text = document.getText()): AirshipFile {
	const source = tryParseSourceFile(document.fileName, text);

	const airshipFile: { -readonly [P in keyof AirshipFile]: AirshipFile[P] } = {};

	ts.forEachChild(source, (node) => {
		if (ts.isClassDeclaration(node) && node.name && hasDefaultExport(node)) {
			const extendsNode = getExtends(node);
			if (extendsNode && ts.isIdentifier(extendsNode) && (extendsNode.text === "AirshipBehaviour" || extendsNode.text === "AirshipSingleton")) {
				const textSpan = ts.createTextSpanFromNode(node, source);

				airshipFile.behaviour = { name: node.name.text, node, textSpan };

				if (node.modifiers !== undefined) {
					for (const modifier of node.modifiers) {
						if (!ts.isDecorator(modifier) || !ts.isCallExpression(modifier.expression)) continue;
						const { expression } = modifier;
						if (!ts.isIdentifier(expression.expression)) continue;

						const decorator = getDecorator(expression);
						if (decorator?.name === "AirshipComponentMenu") {
							const [path] = decorator.arguments;
							if (ts.isStringLiteral(path)) {
								const parts = path.text.split("/");
								const last = parts[parts.length - 1];

								if (last) {
									airshipFile.behaviour.name = nicifyVariableName(parts[parts.length - 1]);
								} else {
									airshipFile.behaviour.name += " (Hidden)";
								}
							}
						}
					}
				}
			}

			for (const member of node.members) {
				if (!ts.isMethodDeclaration(member)) continue;

				const decorators = member.modifiers?.filter(
					(f): f is AirshipContextDecorator =>
						ts.isDecorator(f) &&
						ts.isCallExpression(f.expression) &&
						ts.isIdentifier(f.expression.expression) &&
						contextDecorators.includes(f.expression.expression.text as ContextDecoratorName),
				);
				if (!decorators) continue;

				const serverDecorator = decorators.find((f) => f.expression);
				if (serverDecorator?.expression.expression.text === "Server") {
					const textSpan = ts.createTextSpanFromNode(member, source);

					(airshipFile.serverMethods ??= []).push({
						node: member,
						span: textSpan,
					});
				}

				if (serverDecorator?.expression.expression.text === "Client") {
					const textSpan = ts.createTextSpanFromNode(member, source);

					(airshipFile.clientMethods ??= []).push({
						node: member,
						span: textSpan,
					});
				}
			}
		}
	});

	return airshipFile;
}
