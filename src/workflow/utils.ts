import { localizeWorkflowText } from './localization'

export function parseInputList(value: string): string | string[] {
  const parts = value.split(',').map((item) => item.trim()).filter(Boolean)
  return parts.length > 1 ? parts : value.trim()
}

export function normalizeInput(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.join(', ')
  return value ?? ''
}

export function normalizeTextBlock(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value.map((item) => localizeWorkflowText(item)).join('\n')
  return value ? localizeWorkflowText(value) : ''
}

export function parseLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

export function sanitizeStepId(value: string): string {
  const safe = value.trim().replace(/[^A-Za-z0-9_-]/g, '_').replace(/_+/g, '_')
  return safe || 'step'
}
