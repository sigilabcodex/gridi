export const APP_NAME = "GRIDI";
export const APP_SUBTITLE = "Generative Rhythmically Indeterministic Digital Instrument";

export const APP_VERSION = __APP_VERSION__;
export const APP_BUILD = __APP_BUILD__;
export const APP_BRANCH = __APP_BRANCH__;
export const APP_DIRTY = __APP_DIRTY__;

export const APP_DISPLAY_NAME = APP_NAME;
export const APP_TITLE = `${APP_NAME} - ${APP_SUBTITLE}`;

export type AppVersionDetails = {
  version: string;
  build: string;
  branch: string;
  sourceHint: string;
};

export function getVersionDetails(): AppVersionDetails {
  const version = APP_VERSION || "0.0.0";
  const build = APP_BUILD || (import.meta.env.DEV ? "dev" : "release");
  const branch = APP_BRANCH || "unknown";
  const sourceHint = APP_BRANCH
    ? APP_DIRTY
      ? "Built from local development state"
      : "Built from git working tree"
    : "Build metadata unavailable";

  return { version, build, branch, sourceHint };
}

export function getVersionTooltipText() {
  const details = getVersionDetails();
  return `Version: ${details.version} • Build: ${details.build} • Branch: ${details.branch} • ${details.sourceHint}`;
}

export function getVersionCompactLabel() {
  const details = getVersionDetails();
  return `${details.version}-${details.build}`;
}
