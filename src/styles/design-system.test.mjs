import assert from 'node:assert/strict'
import test from 'node:test'
import { designTokens } from './design-system.ts'

test('matches the PMS visual token contract', () => {
  assert.equal(designTokens.primary, '#0A5DC2')
  assert.equal(designTokens.background, '#F7F8FA')
  assert.equal(designTokens.surface, '#FFFFFF')
  assert.equal(designTokens.border, '#E1E6ED')
  assert.equal(designTokens.text, '#18212E')
  assert.equal(designTokens.radius, 8)
  assert.equal(designTokens.controlHeight, 36)
  assert.deepEqual(designTokens.fontSize, {
    body: 13,
    compact: 12,
    caption: 11,
    section: 15,
    title: 20,
    display: 22,
  })
  assert.equal(designTokens.lineHeight.normal, 1.45)
})
