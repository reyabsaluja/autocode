import { ZodError, z, type ZodTypeAny } from 'zod';

type IpcPayloadDirection = 'request' | 'response';

export function parseIpcPayload<Schema extends ZodTypeAny>(
  schema: Schema,
  payload: unknown,
  channel: string,
  direction: IpcPayloadDirection
): z.output<Schema> {
  try {
    return schema.parse(payload);
  } catch (error) {
    if (error instanceof ZodError) {
      const details = error.issues
        .map((issue) => `${issue.path.length > 0 ? issue.path.join('.') : '<root>'}: ${issue.message}`)
        .join('; ');

      throw new Error(`IPC ${direction} validation failed for "${channel}". ${details}`);
    }

    throw error;
  }
}
