/// <reference types="vite/client" />

import type { AutocodeApi } from '@shared/contracts/electron-api';

declare global {
  interface Window {
    autocode: AutocodeApi;
  }
}

export {};
