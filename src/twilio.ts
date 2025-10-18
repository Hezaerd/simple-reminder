import { Config, Context, Data, Effect, Layer } from "effect";
import { Twilio as TwilioClient } from "twilio";

export class TwilioError extends Data.TaggedError("TwilioError")<{
	cause?: unknown;
	message?: string;
}> {}

interface TwilioImpl {
	use: <T>(
		fn: (client: TwilioClient) => T,
	) => Effect.Effect<Awaited<T>, TwilioError, never>;
}
export class Twilio extends Context.Tag("Twilio")<Twilio, TwilioImpl>() {}

type ConstructorArgs<T extends new (...args: any) => any> = T extends new (
	...args: infer A
) => infer _R
	? A
	: never;

export const make = (options: ConstructorArgs<typeof TwilioClient>) =>
	Effect.gen(function* () {
		const client = yield* Effect.try({
			try: () => new TwilioClient(options[0], options[1]),
			catch: (e) => new TwilioError({ cause: e }),
		});

		return Twilio.of({
			use: (fn) =>
				Effect.gen(function* () {
					const result = yield* Effect.try({
						try: () => fn(client),
						catch: (e) =>
							new TwilioError({
								cause: e,
								message: "Synchronous error in `Twilio.use`",
							}),
					});
					if (result instanceof Promise) {
						return yield* Effect.tryPromise({
							try: () => result,
							catch: (e) =>
								new TwilioError({
									cause: e,
									message: "Asynchronous error in `Twilio.use`",
								}),
						});
					} else {
						return result;
					}
				}),
		});
	});

export const layer = (options: ConstructorArgs<typeof TwilioClient>) =>
	Layer.scoped(Twilio, make(options));

export const fromEnv = Layer.scoped(
	Twilio,
	Effect.gen(function* () {
		const accountSid = yield* Config.string("TWILIO_ACCOUNT_SID");
		const authToken = yield* Config.string("TWILIO_AUTH_TOKEN");

		const client = yield* make([accountSid, authToken]);

		return client;
	}),
);

export const sendSms = (to: string, body: string) =>
	Effect.gen(function* () {
		const twilio = yield* Twilio;

		const from = yield* Config.string("TWILIO_PHONE_NUMBER");

		yield* Effect.try({
			try: () =>
				twilio.use((client) => client.messages.create({ from, to, body })),
			catch: (e) => new TwilioError({ cause: e }),
		});

		yield* Effect.logInfo(`SMS sent to ${to}`);
	}).pipe(Effect.withLogSpan("sendSms"));
