import { describe, expect, it } from 'vitest'

import { canonicalConditionHandleId, edgeOptionsForConnection } from './edges'

describe('workflow edge logic', () => {
  it('canonicalizes localized condition branch handles', () => {
    expect(canonicalConditionHandleId('是')).toBe('yes')
    expect(canonicalConditionHandleId('否')).toBe('no')
  })

  it('labels yes/no condition handles in Traditional Chinese', () => {
    expect(edgeOptionsForConnection('condition', 'yes').label).toBe('是')
    expect(edgeOptionsForConnection('condition', 'no').label).toBe('否')
  })

  it('preserves custom condition branch labels', () => {
    expect(edgeOptionsForConnection('condition', 'needs-review', undefined, [
      { id: 'needs-review', label: '需要人工複核' },
    ]).label).toBe('需要人工複核')
  })

  it('does not label non-condition connections by default', () => {
    expect(edgeOptionsForConnection('ai_task', 'bottom').label).toBeUndefined()
  })
})
