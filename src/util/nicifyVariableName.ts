export function nicifyVariableName(text: string): string {
	let result = "";

	let prevIsLetter = false;
	let prevIsLetterUpper = false;
	let prevIsDigit = false;
	let prevIsStartOfWord = false;
	let prevIsNumberWord = false;

	let firstCharIndex = 0;
	if (text.startsWith("_")) {
		firstCharIndex = 1;
	} else if (text.startsWith("m_")) {
		firstCharIndex = 2;
	}

	for (let i = text.length - 1; i >= firstCharIndex; i--) {
		let currentChar = text[i];

		let currIsLetter = currentChar.match(/[A-z]/) !== null;
		let currIsLetterUpper = currentChar.toUpperCase() === currentChar;
		let currIsDigit = currentChar.match(/\d/) !== null;
		let currIsSpacer = currentChar.match(/[\s_]/) !== null;

		if (i === firstCharIndex && currIsLetter) currentChar = currentChar.toUpperCase();

		let addSpace =
			(currIsLetter && !currIsLetterUpper && prevIsLetterUpper) ||
			(currIsLetter && prevIsLetterUpper && prevIsStartOfWord) ||
			(currIsDigit && prevIsStartOfWord) ||
			(!currIsDigit && prevIsNumberWord) ||
			(currIsLetter && !currIsLetterUpper && prevIsDigit);

		if (!currIsSpacer && addSpace) {
			result = " " + result;
		}

        result = currentChar + result;

		prevIsStartOfWord = currIsLetter && currIsLetterUpper && prevIsLetter && !prevIsLetterUpper;
		prevIsNumberWord = currIsDigit && prevIsLetter && !prevIsLetterUpper;
		prevIsLetterUpper = currIsLetter && currIsLetterUpper;
		prevIsLetter = currIsLetter;
		prevIsDigit = currIsDigit;
	}

	return result;
}
