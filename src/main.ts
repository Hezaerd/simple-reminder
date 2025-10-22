import { FileSystem } from "@effect/platform";
import { Config, Effect } from "effect";
import * as Calendar from "./calendar";

export const main = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const ascii = yield* fs.readFile("resources/ascii.txt");

	yield* Effect.logInfo(ascii.toString());

	const calendarId = yield* Config.string("CALENDAR_ID");
	yield* Effect.logInfo(`Fetching events from calendar ${calendarId}`);

	const events = yield* Calendar.getUpcomingEvents(calendarId);
	yield* Effect.logInfo(`Found ${events.length} upcoming events`);

	for (const event of events) {
		yield* Effect.logInfo(
			`📅 ${event.summary} - ${event.start?.dateTime || event.start?.date}`,
		);
	}
});
