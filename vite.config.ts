import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  // En GH Pages debe ser "/gridi/"
  // En local (vite dev) mejor "/"
  base: mode === "gh" ? "/gridi/" : "/",
}));
