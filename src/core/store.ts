/** Minimal pub/sub used to notify the UI/visualizations of state changes. */
export class Emitter {
  private listeners = new Set<() => void>();

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  protected emit(): void {
    for (const fn of this.listeners) fn();
  }
}
