import * as vscode from "vscode";
import { ColorRGBA, colorTo, ColorType, roundColor } from "./util/colorMap";

const matchColors: Record<ColorType, RegExp> = {
	[ColorType.new]:
		/(new\s+Color)\(\s*(\d*(?:\.\d*)?),\s*(\d*(?:\.\d*)?)\s*,\s*(\d*(?:\.\d*)?)(?:\s*,\s*(\d*(?:\.\d*)?))?\s*\)/,
	[ColorType.hsvToRGB]: /(Color\.HSVToRGB)\(\s*(\d*(?:\.\d*)?),\s*(\d*(?:\.\d*)?)\s*,\s*(\d*(?:\.\d*)?)(?:\s*)\)/,
};

const matchPrefix: Record<ColorType, string> = {
	[ColorType.new]: "new Color",
	[ColorType.hsvToRGB]: "Color.HSVToRGB",
};

function formatNumber(match: ColorType, a: number, b: number, c: number, d: number = 1): vscode.Color {
	if (match === ColorType.new) {
		return {
			alpha: d,
			red: a,
			green: b,
			blue: c,
		};
	}

	const [red, green, blue] = colorTo[match][ColorType.new](a, b, c, d ?? 1);

	return {
		alpha: d,
		red,
		green,
		blue,
	};
}

function extractRGBA(match: RegExpMatchArray): ColorRGBA {
	return [Number(match[2]), Number(match[3]), Number(match[4]), match[5] !== undefined ? Number(match[5]) : 1];
}

function getRotatedColorType() {
	const defaultColorType = vscode.workspace
		.getConfiguration("roblox-ts.colorPicker")
		.get("defaultOption", ColorType.new);

	const rotatingArray = Object.values(ColorType);
	const location = rotatingArray.findIndex((value) => value === defaultColorType);

	rotatingArray.unshift(...rotatingArray.splice(location, rotatingArray.length));
	return rotatingArray;
}

export function makeColorProvider() {
	const provider: vscode.DocumentColorProvider = {
		provideColorPresentations: (color, context, token) => {
			const text = context.document.getText(context.range);

			const match = Object.values(ColorType).find((match) => text.includes(match));
			if (!match) throw new Error("Color type specified was not found!");

			const regexMatch = text.match(matchColors[match])!;

			const matches: vscode.ProviderResult<Array<vscode.ColorPresentation>> = getRotatedColorType().map(
				(matchType): vscode.ColorPresentation => {
					const colorMatch =
						matchType === ColorType.new
							? ([color.red, color.green, color.blue, color.alpha] as ColorRGBA)
							: colorTo[ColorType.new][matchType](
									...roundColor([color.red, color.green, color.blue, color.alpha]),
							  );

					if (matchType === ColorType.hsvToRGB) {
						const [h, s, v] = roundColor(colorMatch);
						return {
							label: `${matchPrefix[matchType]}(${h}, ${s}, ${v})`,
						};
					} else {
						const [r, g, b, a] = roundColor([color.red, color.green, color.blue, color.alpha]);
						return {
							label:
								color.alpha !== 1
									? `${matchPrefix[matchType]}(${r}, ${g}, ${b}, ${a})`
									: `${matchPrefix[matchType]}(${r}, ${g}, ${b})`,
						};
					}
				},
			);

			return matches;
		},

		provideDocumentColors: (document, token) => {
			const source = document.getText();
			const result: vscode.ProviderResult<vscode.ColorInformation[]> = [];

			for (const [matchType, matchRegex] of Object.entries(matchColors)) {
				for (const match of source.matchAll(new RegExp(matchRegex, "g"))) {
					result.push({
						color: formatNumber(matchType as ColorType, ...extractRGBA(match)),
						range: new vscode.Range(
							document.positionAt(match.index!),
							document.positionAt(match.index! + match[0].length),
						),
					});
				}
			}

			return result;
		},
	};

	return [
		vscode.languages.registerColorProvider("typescript", provider),
		vscode.languages.registerColorProvider("typescriptreact", provider),
	];
}
