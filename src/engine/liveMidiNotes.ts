export type LiveMidiVoiceRef<T> = {
  id: number;
  moduleId: string;
  midiNote: number;
  voice: T;
};

export type LiveMidiVoiceTracker<T> = {
  add(moduleId: string, midiNote: number, voice: T): LiveMidiVoiceRef<T>;
  take(moduleId: string, midiNote: number): LiveMidiVoiceRef<T> | null;
  remove(ref: Pick<LiveMidiVoiceRef<T>, "id" | "moduleId" | "midiNote">): boolean;
  drainModule(moduleId: string): LiveMidiVoiceRef<T>[];
  drainAll(): LiveMidiVoiceRef<T>[];
  size(moduleId?: string): number;
};

export function createLiveMidiVoiceTracker<T>(): LiveMidiVoiceTracker<T> {
  const byModule = new Map<string, Map<number, LiveMidiVoiceRef<T>[]>>();
  let nextId = 1;

  const ensureModule = (moduleId: string) => {
    let bucket = byModule.get(moduleId);
    if (!bucket) {
      bucket = new Map<number, LiveMidiVoiceRef<T>[]>();
      byModule.set(moduleId, bucket);
    }
    return bucket;
  };

  const cleanupNoteBucket = (moduleId: string, midiNote: number) => {
    const moduleBucket = byModule.get(moduleId);
    if (!moduleBucket) return;
    const noteQueue = moduleBucket.get(midiNote);
    if (noteQueue && noteQueue.length === 0) moduleBucket.delete(midiNote);
    if (moduleBucket.size === 0) byModule.delete(moduleId);
  };

  return {
    add(moduleId, midiNote, voice) {
      const normalizedNote = midiNote | 0;
      const moduleBucket = ensureModule(moduleId);
      const queue = moduleBucket.get(normalizedNote) ?? [];
      const ref: LiveMidiVoiceRef<T> = {
        id: nextId++,
        moduleId,
        midiNote: normalizedNote,
        voice,
      };
      queue.push(ref);
      moduleBucket.set(normalizedNote, queue);
      return ref;
    },
    take(moduleId, midiNote) {
      const normalizedNote = midiNote | 0;
      const queue = byModule.get(moduleId)?.get(normalizedNote);
      if (!queue?.length) return null;
      const next = queue.shift() ?? null;
      cleanupNoteBucket(moduleId, normalizedNote);
      return next;
    },
    remove(ref) {
      const queue = byModule.get(ref.moduleId)?.get(ref.midiNote);
      if (!queue?.length) return false;
      const idx = queue.findIndex((entry) => entry.id === ref.id);
      if (idx < 0) return false;
      queue.splice(idx, 1);
      cleanupNoteBucket(ref.moduleId, ref.midiNote);
      return true;
    },
    drainModule(moduleId) {
      const moduleBucket = byModule.get(moduleId);
      if (!moduleBucket) return [];
      const refs: LiveMidiVoiceRef<T>[] = [];
      for (const queue of moduleBucket.values()) refs.push(...queue);
      byModule.delete(moduleId);
      return refs;
    },
    drainAll() {
      const refs: LiveMidiVoiceRef<T>[] = [];
      for (const moduleBucket of byModule.values()) {
        for (const queue of moduleBucket.values()) refs.push(...queue);
      }
      byModule.clear();
      return refs;
    },
    size(moduleId) {
      let count = 0;
      if (moduleId) {
        const moduleBucket = byModule.get(moduleId);
        if (!moduleBucket) return 0;
        for (const queue of moduleBucket.values()) count += queue.length;
        return count;
      }
      for (const moduleBucket of byModule.values()) {
        for (const queue of moduleBucket.values()) count += queue.length;
      }
      return count;
    },
  };
}
