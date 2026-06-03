import { describe, expect, it } from 'vitest'

import { parseInputList, sanitizeStepId } from './utils'

describe('workflow utils', () => {
  it('sanitizes step ids by replacing invalid characters and collapsing underscores', () => {
    expect(sanitizeStepId('  review step / v1 ✅  ')).toBe('review_step_v1_')
  })

  it('falls back to step when sanitized id is empty', () => {
    expect(sanitizeStepId('   ')).toBe('step')
  })

  it('parses comma-separated input as an array', () => {
    expect(parseInputList('ticket, context, diff')).toEqual(['ticket', 'context', 'diff'])
  })

  it('keeps a single input as a string', () => {
    expect(parseInputList(' ticket ')).toBe('ticket')
  })
})
