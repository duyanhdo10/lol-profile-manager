import type { LcuBridge } from '../shared/models';

declare global {
  interface Window {
    lpm: LcuBridge;
  }
}

export {};
