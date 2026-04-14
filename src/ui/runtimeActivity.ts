export function isRuntimeActive(isPlaying: boolean, isOn: boolean) {
  return isPlaying && isOn;
}

export function runtimeStateLabel(isPlaying: boolean, isOn: boolean) {
  if (!isOn) return "BYPASS";
  return isPlaying ? "ACTIVE" : "IDLE";
}
