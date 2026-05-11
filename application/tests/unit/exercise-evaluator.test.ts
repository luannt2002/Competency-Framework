import { describe, it, expect } from 'vitest';
import { evaluateExercise } from '@/lib/learn/exercise-evaluator';

describe('exercise-evaluator', () => {
  describe('mcq', () => {
    const payload = {
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
      ],
      correctId: 'b',
    };

    it('returns true when answer matches correctId', () => {
      expect(evaluateExercise('mcq', payload, 'b')).toBe(true);
    });
    it('returns false on wrong answer', () => {
      expect(evaluateExercise('mcq', payload, 'a')).toBe(false);
    });
    it('returns false on non-string answer', () => {
      expect(evaluateExercise('mcq', payload, null)).toBe(false);
      expect(evaluateExercise('mcq', payload, ['b'])).toBe(false);
    });
  });

  describe('mcq_multi', () => {
    const payload = {
      options: [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
      ],
      correctIds: ['a', 'c'],
    };

    it('matches when set equal', () => {
      expect(evaluateExercise('mcq_multi', payload, ['a', 'c'])).toBe(true);
      expect(evaluateExercise('mcq_multi', payload, ['c', 'a'])).toBe(true);
    });
    it('rejects partial match', () => {
      expect(evaluateExercise('mcq_multi', payload, ['a'])).toBe(false);
    });
    it('rejects superset', () => {
      expect(evaluateExercise('mcq_multi', payload, ['a', 'b', 'c'])).toBe(false);
    });
  });

  describe('fill_blank', () => {
    const payload = {
      template: 'use ___ + ___ as backend',
      blanks: [
        { id: 1, accepts: ['S3', 's3'], matchKind: 'exact_ci' as const },
        { id: 2, accepts: ['DynamoDB'], matchKind: 'exact_ci' as const },
      ],
    };

    it('passes case-insensitive match', () => {
      expect(evaluateExercise('fill_blank', payload, { '1': 's3', '2': 'dynamodb' })).toBe(true);
    });
    it('fails if any blank wrong', () => {
      expect(evaluateExercise('fill_blank', payload, { '1': 'S3', '2': 'redis' })).toBe(false);
    });
    it('handles empty blank as wrong', () => {
      expect(evaluateExercise('fill_blank', payload, { '1': '', '2': 'DynamoDB' })).toBe(false);
    });
  });

  describe('order_steps', () => {
    const payload = {
      steps: [
        { id: '1', text: 'init' },
        { id: '2', text: 'plan' },
        { id: '3', text: 'apply' },
      ],
      correctOrder: ['1', '2', '3'],
    };

    it('passes exact order', () => {
      expect(evaluateExercise('order_steps', payload, ['1', '2', '3'])).toBe(true);
    });
    it('fails reorder', () => {
      expect(evaluateExercise('order_steps', payload, ['1', '3', '2'])).toBe(false);
    });
    it('fails length mismatch', () => {
      expect(evaluateExercise('order_steps', payload, ['1', '2'])).toBe(false);
    });
  });

  describe('type_answer', () => {
    it('regex match', () => {
      const p = { accepts: ['^aws\\s+sts\\s+get-caller-identity$'], matchKind: 'regex' as const };
      expect(evaluateExercise('type_answer', p, 'aws sts get-caller-identity')).toBe(true);
      expect(evaluateExercise('type_answer', p, 'aws  sts  get-caller-identity')).toBe(true);
      expect(evaluateExercise('type_answer', p, 'aws sts identity')).toBe(false);
    });
    it('trims whitespace', () => {
      const p = { accepts: ['hello'], matchKind: 'exact_ci' as const };
      expect(evaluateExercise('type_answer', p, '  HELLO  ')).toBe(true);
    });
  });

  describe('code_block_review', () => {
    const payload = {
      code: 'resource "x" {}',
      question: 'Issue?',
      options: [
        { id: 'a', text: 'a' },
        { id: 'b', text: 'b' },
      ],
      correctId: 'b',
    };
    it('works like mcq', () => {
      expect(evaluateExercise('code_block_review', payload, 'b')).toBe(true);
      expect(evaluateExercise('code_block_review', payload, 'a')).toBe(false);
    });
  });
});
