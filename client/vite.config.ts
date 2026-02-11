import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ds/shared": path.resolve(__dirname, "../shared/index.ts")
    }
  },
  server: {
    fs: {
      allow: [".."]
    }
  }
});

