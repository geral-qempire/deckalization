import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"
import { devtools } from "@tanstack/devtools-vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// The generated Convex API lives at the monorepo root (../../convex), shared with
// the Python agents. Allow Vite to read it via the "@convex/*" tsconfig alias.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url))

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { fs: { allow: [".", repoRoot] } },
  plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
})

export default config
