import { ipcRenderer, type IpcRendererEvent } from 'electron';
import { type ZodTypeAny } from 'zod';

import { parseIpcPayload } from '../shared/ipc/validation';

export function subscribeValidatedIpc<OutputSchema extends ZodTypeAny>(
  channel: string,
  outputSchema: OutputSchema,
  listener: (payload: OutputSchema['_output']) => void
): () => void {
  const wrappedListener = (_event: IpcRendererEvent, payload: unknown) => {
    listener(parseIpcPayload(outputSchema, payload, channel, 'response'));
  };

  ipcRenderer.on(channel, wrappedListener);
  return () => {
    ipcRenderer.off(channel, wrappedListener);
  };
}
