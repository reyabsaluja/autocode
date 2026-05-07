import { describe, expect, test } from 'bun:test';

import { isEnvKeyDenied, mergeCustomEnvVars } from './agent-session-provider';

describe('isEnvKeyDenied', () => {
  test('blocks security-sensitive env vars', () => {
    expect(isEnvKeyDenied('LD_PRELOAD')).toBe(true);
    expect(isEnvKeyDenied('NODE_OPTIONS')).toBe(true);
    expect(isEnvKeyDenied('DYLD_INSERT_LIBRARIES')).toBe(true);
    expect(isEnvKeyDenied('DYLD_LIBRARY_PATH')).toBe(true);
    expect(isEnvKeyDenied('LD_LIBRARY_PATH')).toBe(true);
    expect(isEnvKeyDenied('ELECTRON_RUN_AS_NODE')).toBe(true);
    expect(isEnvKeyDenied('NODE_PATH')).toBe(true);
  });

  test('allows normal env vars', () => {
    expect(isEnvKeyDenied('PATH')).toBe(false);
    expect(isEnvKeyDenied('HOME')).toBe(false);
    expect(isEnvKeyDenied('AWS_REGION')).toBe(false);
    expect(isEnvKeyDenied('MY_CUSTOM_VAR')).toBe(false);
  });
});

describe('mergeCustomEnvVars', () => {
  test('sets simple key=value pairs', () => {
    const result = mergeCustomEnvVars({ PATH: '/usr/bin' }, 'FOO=bar\nBAZ=qux');
    expect(result.FOO).toBe('bar');
    expect(result.BAZ).toBe('qux');
    expect(result.PATH).toBe('/usr/bin');
  });

  test('handles export prefix', () => {
    const result = mergeCustomEnvVars({}, 'export MY_VAR=hello');
    expect(result.MY_VAR).toBe('hello');
  });

  test('handles unset', () => {
    const result = mergeCustomEnvVars({ REMOVE_ME: 'yes', KEEP: 'yes' }, 'unset REMOVE_ME');
    expect(result.REMOVE_ME).toBe(undefined);
    expect(result.KEEP).toBe('yes');
  });

  test('skips comments and empty lines', () => {
    const result = mergeCustomEnvVars({}, '# comment\n\nFOO=bar');
    expect(result.FOO).toBe('bar');
    expect(Object.keys(result).length).toBe(1);
  });

  test('blocks denied keys from being set', () => {
    const result = mergeCustomEnvVars({}, 'LD_PRELOAD=/evil.so\nNODE_OPTIONS=--inspect\nFOO=bar');
    expect(result.LD_PRELOAD).toBe(undefined);
    expect(result.NODE_OPTIONS).toBe(undefined);
    expect(result.FOO).toBe('bar');
  });

  test('blocks denied keys from being unset', () => {
    const result = mergeCustomEnvVars(
      { NODE_OPTIONS: '--max-old-space-size=4096' },
      'unset NODE_OPTIONS'
    );
    expect(result.NODE_OPTIONS).toBe('--max-old-space-size=4096');
  });
});
