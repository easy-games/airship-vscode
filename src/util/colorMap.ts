/* eslint-disable @typescript-eslint/naming-convention */
import chroma from "chroma-js";
import * as vscode from "vscode";

export enum ColorType {
	hsvToRGB = "HSVToRGB",
	new = "new",
}

type ExcludeSelfDoubleRecord<K extends string, V> = {
	[I in K]: Record<Exclude<K, I>, V>;
};
export type HSVArray = [number, number, number];
export type ColorRGBA = [number, number, number, number];

function clearNaN(value: Readonly<HSVArray>) {
	return value.map((value) => (value !== value ? 0 : value)) as HSVArray;
}

function normalizeHsv(value: Readonly<HSVArray>): HSVArray {
	return [value[0] / 360, value[1], value[2]];
}

function denormalizeHsv(value: Readonly<HSVArray>): HSVArray {
	return [value[0] * 360, value[1], value[2]];
}

export function roundColor<T extends HSVArray | ColorRGBA>(value: T) {
	const precision = 10 ** vscode.workspace.getConfiguration("roblox-ts.colorPicker").get("precision", 2);
	return value.map((value) => Math.round(value * precision) / precision) as T;
}

/**
 * From a color to another color
 */
export const colorTo: ExcludeSelfDoubleRecord<
	ColorType,
	(a: number, b: number, c: number, d: number) => ColorRGBA | HSVArray
> = {
	new: {
		HSVToRGB: (r, g, b, a): HSVArray => {
			return normalizeHsv(
				clearNaN(
					chroma([r * 255, g * 255, b * 255], "rgb")
						.alpha(a)
						.hsv(),
				),
			);
		},
	},
	HSVToRGB: {
		new: (h, s, v): ColorRGBA => {
			return chroma(denormalizeHsv([h, s, v]), "hsv")
				.rgba(false)
				.map((color) => color / 255) as ColorRGBA;
		},
	},
};
