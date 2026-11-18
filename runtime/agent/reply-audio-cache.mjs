// Only vetted, fixed reply text can enter this cache. Each call owns its cache
// so audio always uses that caller's configured voice, model, and settings.
export class ReplyAudioCache {
  constructor(tts) {
    this.tts = tts;
    this.entries = new Map();
    this.loadsThisTurn = 0;
  }

  nextTurn() {
    this.loadsThisTurn = 0;
  }

  warm(text) {
    if (!text || this.entries.has(text) || this.loadsThisTurn >= 2) return;
    this.loadsThisTurn += 1;
    if (this.entries.size >= 4) {
      const key = this.entries.keys().next().value;
      this.entries.get(key).stream.close();
      this.entries.delete(key);
    }

    const stream = this.tts.stream();
    const started = performance.now();
    const entry = { stream, frames: [], ttfbMs: null, complete: false, waiters: new Set() };
    this.entries.set(text, entry);
    stream.updateInputStream(new ReadableStream({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    }));

    void (async () => {
      try {
        for await (const chunk of stream) {
          if (!chunk?.frame) continue;
          entry.ttfbMs ??= Math.round(performance.now() - started);
          entry.frames.push(chunk.frame);
          for (const wake of entry.waiters) wake();
          entry.waiters.clear();
        }
      } catch {
        if (this.entries.get(text) === entry) this.entries.delete(text);
      } finally {
        entry.complete = true;
        for (const wake of entry.waiters) wake();
        entry.waiters.clear();
        stream.close();
      }
    })();
  }

  get(text) {
    const entry = this.entries.get(text);
    return entry?.frames.length ? entry : null;
  }

  read(entry) {
    let index = 0;
    let wake;
    let cancelled = false;
    return new ReadableStream({
      async pull(controller) {
        if (index === entry.frames.length && !entry.complete) {
          await new Promise((resolve) => {
            wake = resolve;
            entry.waiters.add(resolve);
          });
        }
        if (cancelled) return;
        if (index < entry.frames.length) controller.enqueue(entry.frames[index++]);
        else controller.close();
      },
      cancel() {
        cancelled = true;
        entry.waiters.delete(wake);
        wake?.();
      },
    });
  }

  close() {
    for (const entry of this.entries.values()) entry.stream.close();
    this.entries.clear();
  }
}
