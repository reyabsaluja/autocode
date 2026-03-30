import type { AutocodeApi } from '@shared/contracts/electron-api';

function getApi(): AutocodeApi {
  if (!window.autocode) {
    throw new Error('Autocode preload API is not available.');
  }

  return window.autocode;
}

export const autocodeApi = getApi();

