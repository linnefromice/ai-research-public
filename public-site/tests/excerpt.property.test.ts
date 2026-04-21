/**
 * Property-based tests for excerpt extraction
 *
 * Run with: npx vitest run tests/excerpt.property.test.ts
 * Requires: fast-check + vitest (install if running this test)
 */

// @ts-nocheck - fast-check optional dependency

// Conditional imports to avoid breaking builds when fast-check isn't installed
let fc: any; let test: any; let expect: any;
try {
  fc = require('fast-check');
  const vitest = require('vitest');
  test = vitest.test;
  expect = vitest.expect;
} catch { /* skip if not installed */ }

if (fc && test) {
  const { getExcerpt } = require('../src/lib/excerpt');

  test('getExcerpt never throws for arbitrary markdown', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 5000 }), (markdown) => {
        const result = getExcerpt(markdown);
        expect(typeof result).toBe('string');
      }),
      { numRuns: 100 }
    );
  });

  test('getExcerpt always returns string shorter than input + fixed overhead', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 5000 }), (markdown) => {
        const result = getExcerpt(markdown);
        expect(result.length).toBeLessThanOrEqual(markdown.length + 10);
      }),
      { numRuns: 50 }
    );
  });
}
