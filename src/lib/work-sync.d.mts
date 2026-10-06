export type WorkSyncState = 'connecting' | 'current' | 'offline' | 'expired';
export type WorkSync = {
  start(): void; refresh(): Promise<boolean>; reconnect(): void;
  setAvailable(visible: boolean, online: boolean): void;
  suspend(): void; resume(): void; expire(): void; dispose(): void;
};
export function createWorkSync<T>(options: {
  read(signal: AbortSignal): Promise<T>;
  onData(data: T, explicit: boolean): void;
  onError(error: unknown, explicit: boolean): void;
  onState(state: WorkSyncState): void;
  interval?: number; maxDelay?: number;
  setTimer?: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
}): WorkSync;
