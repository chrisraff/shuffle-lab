import { defineConfig } from "vite";

// GitHub Pages project sites are served from /<repo-name>/, not /, so
// asset URLs need that base path — but only when building in CI. Local
// dev/build/preview stay at root. GITHUB_ACTIONS is set to "true" by every
// GitHub Actions runner automatically.
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? "/shuffle-lab/" : "/",
});
