/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aliases from "../aliases.js";
import type * as cards from "../cards.js";
import type * as cardsImport from "../cardsImport.js";
import type * as crons from "../crons.js";
import type * as evalCases from "../evalCases.js";
import type * as hello from "../hello.js";
import type * as lib_normalize from "../lib/normalize.js";
import type * as queries from "../queries.js";
import type * as rules from "../rules.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aliases: typeof aliases;
  cards: typeof cards;
  cardsImport: typeof cardsImport;
  crons: typeof crons;
  evalCases: typeof evalCases;
  hello: typeof hello;
  "lib/normalize": typeof lib_normalize;
  queries: typeof queries;
  rules: typeof rules;
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
