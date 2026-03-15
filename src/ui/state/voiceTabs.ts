import type { VoiceTab } from "../voiceModule";

export function createVoiceTabsState() {
  const voiceTabs = new Map<string, VoiceTab>();

  return {
    getVoiceTab: (id: string): VoiceTab => voiceTabs.get(id) ?? "MAIN",
    setVoiceTab: (id: string, tab: VoiceTab) => {
      voiceTabs.set(id, tab);
    },
  };
}
