import { FileSystem } from "@effect/platform";
import { Effect } from "effect";

export const main = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const ascii = yield* fs.readFile("resources/ascii.txt");

	yield* Effect.logInfo(ascii.toString());
});
