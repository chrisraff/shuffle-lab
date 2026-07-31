import { resolve } from "node:path";
import { defineConfig } from "vite";

// GitHub Pages project sites are served from /<repo-name>/, not /, so
// asset URLs need that base path — but only when building in CI. Local
// dev/build/preview stay at root. GITHUB_ACTIONS is set to "true" by every
// GitHub Actions runner automatically.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/shuffle-lab/" : "/",
  // Two real HTML entries (index.html, embed.html), not a single-page app —
  // disable Vite's SPA fallback so an unmatched path 404s in dev instead of
  // silently serving index.html, matching how GitHub Pages (a plain static
  // host) actually behaves in production.
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        embed: resolve(__dirname, "embed.html"),
      },
    },
  },
});
