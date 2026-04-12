import { execSync } from "node:child_process";
import { defineConfig } from "vite";

function readGitMetadata() {
  const run = (cmd: string) => {
    try {
      return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
    } catch {
      return "";
    }
  };

  const commit = run("git rev-parse --short HEAD");
  const branch = run("git rev-parse --abbrev-ref HEAD");
  const dirty = run("git status --porcelain").length > 0;
  return { commit, branch, dirty };
}

export default defineConfig(({ mode }) => {
  const { commit, branch, dirty } = readGitMetadata();
  const semver = process.env.npm_package_version ?? "0.0.0";
  const build = commit ? `dev+${commit}${dirty ? ".dirty" : ""}` : mode === "development" ? "dev" : "release";

  return {
    // En GH Pages debe ser "/gridi/"
    // En local (vite dev) mejor "/"
    base: mode === "gh" ? "/gridi/" : "/",
    define: {
      __APP_VERSION__: JSON.stringify(semver),
      __APP_BUILD__: JSON.stringify(build),
      __APP_BRANCH__: JSON.stringify(branch),
      __APP_DIRTY__: JSON.stringify(dirty),
    },
  };
});
