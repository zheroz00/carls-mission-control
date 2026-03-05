import { ActivityEvent } from "@/lib/types";

type ActivityListener = (event: ActivityEvent) => void;

const listeners = new Set<ActivityListener>();

export function subscribeActivity(listener: ActivityListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishActivity(event: ActivityEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener failures to avoid blocking event fan-out.
    }
  }
}

