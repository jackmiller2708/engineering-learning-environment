// Test support only. In-memory and failing stand-ins for the webview's localStorage.
import type { PointerStorage } from './last-lab-pointer';

export function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } satisfies PointerStorage & { data: Map<string, string> };
}

export function throwingStorage(): PointerStorage {
  const boom = () => {
    throw new DOMException('storage is not available', 'SecurityError');
  };
  return { getItem: boom, setItem: boom, removeItem: boom };
}
