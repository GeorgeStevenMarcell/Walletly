import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

// Plugin: stamps a unique build hash into sw.js so every deployment
// produces a new service worker, forcing browsers to fetch fresh assets.
function swBuildHash() {
  return {
    name: "sw-build-hash",
    closeBundle() {
      const swSrc = resolve(__dirname, "src/sw.js");
      const swDest = resolve(__dirname, "dist/sw.js");
      const template = readFileSync(swSrc, "utf-8");

      // Hash = timestamp + random bytes — unique per build
      const hash = createHash("md5")
        .update(Date.now().toString() + Math.random().toString())
        .digest("hex")
        .slice(0, 8);

      const output = template.replace("__BUILD_HASH__", hash);
      writeFileSync(swDest, output);
      console.log(`\x1b[32m✓\x1b[0m sw.js stamped with build hash: ${hash}`);
    },
  };
}

export default defineConfig({
  plugins: [react(), swBuildHash()],
  build: {
    outDir: "dist",
    sourcemap: false,
    rollupOptions: {
      output: { manualChunks: { vendor: ["react", "react-dom"] } },
    },
  },
  server: {
    port: 5173,
    // In dev mode, forward /api calls to the local backend
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
