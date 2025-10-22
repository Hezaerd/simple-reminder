import { Config, Context, Data, Effect, Layer } from "effect";
import type { OAuth2Client } from "google-auth-library";
import { type calendar_v3, google } from "googleapis";

export class CalendarError extends Data.TaggedError("CalendarError")<{
	cause?: unknown;
	message?: string;
}> {}

interface CalendarImpl {
	use: <T>(
		fn: (client: calendar_v3.Calendar) => T,
	) => Effect.Effect<Awaited<T>, CalendarError, never>;
	listEvents: (
		options: calendar_v3.Params$Resource$Events$List,
	) => Effect.Effect<calendar_v3.Schema$Event[], CalendarError, never>;
}

export class Calendar extends Context.Tag("Calendar")<
	Calendar,
	CalendarImpl
>() {}

export const make = (auth: OAuth2Client) =>
	Effect.gen(function* () {
		const client = google.calendar({ version: "v3", auth: auth });

		return Calendar.of({
			use: (fn) =>
				Effect.gen(function* () {
					const result = yield* Effect.try({
						try: () => fn(client),
						catch: (e) =>
							new CalendarError({
								cause: e,
								message: "Synchronous error in `Calendar.use`",
							}),
					});
					if (result instanceof Promise) {
						return yield* Effect.tryPromise({
							try: () => result,
							catch: (e) =>
								new CalendarError({
									cause: e,
									message: "Asynchronous error in `Calendar.use`",
								}),
						});
					} else {
						return result;
					}
				}),

			listEvents: (options) =>
				Effect.gen(function* () {
					const response = yield* Effect.tryPromise({
						try: () =>
							client.events.list({
								calendarId: options.calendarId,
								timeMin: options.timeMin,
								timeMax: options.timeMax,
								singleEvents: true,
								orderBy: "startTime",
							}),
						catch: (e) =>
							new CalendarError({
								cause: e,
								message: "Failed to list calendar events",
							}),
					});

					return response.data.items || [];
				}).pipe(Effect.withLogSpan("listEvents")),
		});
	});

export const fromServiceAccount = Layer.scoped(
	Calendar,
	Effect.gen(function* () {
		const serviceAccountEmail = yield* Config.string(
			"GOOGLE_SERVICE_ACCOUNT_EMAIL",
		);
		const privateKey = yield* Config.string("GOOGLE_PRIVATE_KEY");

		const auth = yield* Effect.try({
			try: () => {
				const jwt = new google.auth.JWT({
					email: serviceAccountEmail,
					key: privateKey.replace(/\\n/g, "\n"),
					scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
				});
				return jwt;
			},
			catch: (e) =>
				new CalendarError({
					cause: e,
					message: "Failed to create service account authentication",
				}),
		});

		const client = yield* make(auth);
		return client;
	}),
);

export const getUpcomingEvents = Effect.functionWithSpan({
	body: (calendarId: string, daysAhead: number = 7) =>
		Effect.gen(function* () {
			const calendar = yield* Calendar;

			const now = new Date();
			const future = new Date(now);
			future.setDate(now.getDate() + daysAhead);

			const events = yield* calendar.listEvents({
				calendarId,
				timeMin: now.toISOString(),
				timeMax: future.toISOString(),
			});

			yield* Effect.logInfo(
				`Found ${events.length} events in the next ${daysAhead} days`,
			);

			return events;
		}),
	options: { name: "getUpcomingEvents" },
});
