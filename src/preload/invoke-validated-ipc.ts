import { ipcRenderer } from 'electron';
import { z, type ZodTypeAny } from 'zod';

import { parseIpcPayload } from '../shared/ipc/validation';

interface InvokeValidatedIpcNoInputOptions<OutputSchema extends ZodTypeAny> {
  outputSchema: OutputSchema;
}

interface InvokeValidatedIpcWithInputOptions<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
> {
  input: z.output<InputSchema>;
  inputSchema: InputSchema;
  outputSchema: OutputSchema;
}

export function invokeValidatedIpc<OutputSchema extends ZodTypeAny>(
  channel: string,
  options: InvokeValidatedIpcNoInputOptions<OutputSchema>
): Promise<z.output<OutputSchema>>;
export function invokeValidatedIpc<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
>(
  channel: string,
  options: InvokeValidatedIpcWithInputOptions<InputSchema, OutputSchema>
): Promise<z.output<OutputSchema>>;
export async function invokeValidatedIpc<
  InputSchema extends ZodTypeAny,
  OutputSchema extends ZodTypeAny
>(
  channel: string,
  options:
    | InvokeValidatedIpcNoInputOptions<OutputSchema>
    | InvokeValidatedIpcWithInputOptions<InputSchema, OutputSchema>
): Promise<z.output<OutputSchema>> {
  if ('inputSchema' in options) {
    parseIpcPayload(options.inputSchema, options.input, channel, 'request');
    const result = await ipcRenderer.invoke(channel, options.input);

    return parseIpcPayload(options.outputSchema, result, channel, 'response');
  }

  const result = await ipcRenderer.invoke(channel);
  return parseIpcPayload(options.outputSchema, result, channel, 'response');
}
