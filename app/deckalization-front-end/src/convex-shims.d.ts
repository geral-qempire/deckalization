// The shared root `convex/` folder is imported here only for its generated `api`
// types. That api references every module in the folder, including the Node-only
// bulk-import script `cardsImport.ts` (stream-json/stream-chain). The frontend
// never calls it, but `tsc` still loads it — declare those Node deps so the app
// typecheck stays clean without pulling backend @types into the frontend.
declare module "stream-chain"
declare module "stream-json"
declare module "stream-json/streamers/StreamArray"
