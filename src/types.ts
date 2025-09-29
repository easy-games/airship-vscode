interface AirshipBehaviourClassDecorator {
	readonly name: string;
	readonly parameters: { type: "string"; value: string }[];
}

export interface AirshipBehaviourMetadata {
	readonly name: string;
	readonly properties: unknown[];
	readonly decorators: AirshipBehaviourClassDecorator[];
}
