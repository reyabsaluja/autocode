import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z, type ZodTypeAny } from 'zod';

import { parseIpcPayload } from '../../shared/ipc/validation';

type MaybePromise<T> = Promise<T> | T;

interface ValidatedIpcNoInputOptions<OutputSchema extends ZodTypeAny> {
  handler: (
    event: IpcMainInvokeEvent
  ) => MaybePromise<z.input<OutputSchema> | z.output<OutputSchema>>;
  outputSchema: OutputSchema;
}

interface ValidatedIpcWithInputOptions<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
> {
  handler: (
    event: IpcMainInvokeEvent,
    input: z.output<InputSchema>
  ) => MaybePromise<z.input<OutputSchema> | z.output<OutputSchema>>;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
}

export function handleValidatedIpc<OutputSchema extends ZodTypeAny>(
  channel: string,
  options: ValidatedIpcNoInputOptions<OutputSchema>
): void;
export function handleValidatedIpc<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
>(
  channel: string,
  options: ValidatedIpcWithInputOptions<InputSchema, OutputSchema>
): void;
export function handleValidatedIpc<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
>(
  channel: string,
  options:
    | ValidatedIpcNoInputOptions<OutputSchema>
    | ValidatedIpcWithInputOptions<InputSchema, OutputSchema>
): void {
  ipcMain.handle(channel, async (event, rawInput) => {
    if ('inputSchema' in options) {
      const input = parseIpcPayload(options.inputSchema, rawInput, channel, 'request');
      const result = await options.handler(event, input);

      return parseIpcPayload(options.outputSchema, result, channel, 'response');
    }

    const result = await options.handler(event);
    return parseIpcPayload(options.outputSchema, result, channel, 'response');
  });
}
