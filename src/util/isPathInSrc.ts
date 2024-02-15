import * as path from "path";
import ts = require("typescript");
import { getCompilerOptionsAtFile } from "./compilerOptions";

export function isPathInSrc(fileName: string, compilerOptionsResult?: [string, ts.CompilerOptions]) {
	const result = compilerOptionsResult ?? getCompilerOptionsAtFile(fileName);
	if (result) {
		const [tsconfigPath, compilerOptions] = result;
		if (compilerOptions.rootDirs) {
			for (const rootDir of compilerOptions.rootDirs) {
				const srcRelative = path.join(path.dirname(tsconfigPath), rootDir);
				const isInSrc = !path.relative(srcRelative, fileName).startsWith('.');

				if (isInSrc) return true;
			}

			return false;
		}
	}

	return false;
}
