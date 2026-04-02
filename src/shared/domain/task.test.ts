import { describe, expect, test } from 'bun:test';

import {
  canTransitionTaskStatus,
  getTaskTransitionActionLabel,
  getTaskTransitionTargets
} from './task';

describe('task lifecycle rules', () => {
  test('allows product workflow transitions into review and completion', () => {
    expect(canTransitionTaskStatus('ready', 'needs_review')).toBe(true);
    expect(canTransitionTaskStatus('needs_review', 'completed')).toBe(true);
    expect(canTransitionTaskStatus('completed', 'in_progress')).toBe(true);
  });

  test('blocks invalid status jumps', () => {
    expect(canTransitionTaskStatus('archived', 'completed')).toBe(false);
    expect(canTransitionTaskStatus('in_progress', 'in_progress')).toBe(false);
  });

  test('returns action labels that match the workflow UI', () => {
    expect(getTaskTransitionTargets('needs_review')).toEqual([
      'in_progress',
      'completed',
      'archived'
    ]);
    expect(getTaskTransitionActionLabel('archived', 'ready')).toBe('Restore');
    expect(getTaskTransitionActionLabel('ready', 'needs_review')).toBe('Mark for review');
  });
});
