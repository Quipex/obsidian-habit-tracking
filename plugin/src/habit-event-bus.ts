export type HabitGroupListener = () => void;

function normalizeGroup(group: string | null | undefined): string | null {
  if (!group) return null;
  const trimmed = group.trim().toLowerCase();
  return trimmed || null;
}

export default class HabitEventBus {
  private groupListeners: Map<string, Set<HabitGroupListener>> = new Map();

  onGroup(group: string, listener: HabitGroupListener): () => void {
    const normalized = normalizeGroup(group);
    if (!normalized) return () => {};
    let listeners = this.groupListeners.get(normalized);
    if (!listeners) {
      listeners = new Set();
      this.groupListeners.set(normalized, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = this.groupListeners.get(normalized);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.groupListeners.delete(normalized);
      }
    };
  }

  emitGroup(group: string | null | undefined): void {
    const normalized = normalizeGroup(group);
    if (!normalized) return;
    const listeners = this.groupListeners.get(normalized);
    if (!listeners?.size) return;
    for (const listener of Array.from(listeners)) {
      try {
        listener();
      } catch (error) {
        console.error("habit-group update failed", error);
      }
    }
  }

  clear(): void {
    this.groupListeners.clear();
  }
}
