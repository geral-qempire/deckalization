// Ambient declarations for the streaming-JSON libs used by the Node import
// action. They ship no/weak TypeScript types; esbuild resolves the real
// modules from node_modules at bundle time.

declare module "stream-chain" {
  import type { Duplex } from "node:stream";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function chain(fns: any[]): Duplex;
}

declare module "stream-json" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function parser(options?: any): any;
}

declare module "stream-json/streamers/StreamArray" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function streamArray(options?: any): any;
}
