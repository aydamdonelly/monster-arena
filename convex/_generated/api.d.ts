/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as crons from "../crons.js";
import type * as dev from "../dev.js";
import type * as drops from "../drops.js";
import type * as eggs from "../eggs.js";
import type * as events from "../events.js";
import type * as golden from "../golden.js";
import type * as hatch from "../hatch.js";
import type * as monsters from "../monsters.js";
import type * as players from "../players.js";
import type * as royale from "../royale.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  crons: typeof crons;
  dev: typeof dev;
  drops: typeof drops;
  eggs: typeof eggs;
  events: typeof events;
  golden: typeof golden;
  hatch: typeof hatch;
  monsters: typeof monsters;
  players: typeof players;
  royale: typeof royale;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
