import { BunContext, BunRuntime } from "@effect/platform-bun";
import { ConfigProvider, Effect, Layer } from "effect";
import { main } from "./main";
import * as Twilio from "./twilio";

const services = Layer.mergeAll(BunContext.layer, Twilio.fromEnv);

BunRuntime.runMain(
	main.pipe(
		Effect.withConfigProvider(ConfigProvider.fromEnv()),
		Effect.provide(services),
	),
);
