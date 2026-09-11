import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { designTokens } from './design-system.ts'

const globalStyles = fs.readFileSync(new URL('./pms-theme.css', import.meta.url), 'utf8')

test('matches the PMS visual token contract', () => {
  assert.equal(designTokens.primary, '#0A5DC2')
  assert.equal(designTokens.primaryDark, '#0847A0')
  assert.equal(designTokens.primarySoft, '#EAF2FC')
  assert.equal(designTokens.background, '#F7F8FA')
  assert.equal(designTokens.surface, '#FFFFFF')
  assert.equal(designTokens.surfaceMuted, '#F8FAFC')
  assert.equal(designTokens.border, '#E1E6ED')
  assert.equal(designTokens.borderStrong, '#CBD4DF')
  assert.equal(designTokens.text, '#18212E')
  assert.equal(designTokens.radius, 8)
  assert.equal(designTokens.controlHeight, 36)
  assert.equal(designTokens.controlHeightCompact, 32)
  assert.equal(designTokens.focusRing, '0 0 0 3px rgb(10 93 194 / 14%)')
  assert.equal(designTokens.motionFast, '120ms')
  assert.match(designTokens.shadowSm, /0 1px 2px/)
  assert.match(designTokens.shadowInteractive, /0 4px 14px/)
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

test('exposes shared PMS theme visual primitives', () => {
  assert.match(globalStyles, /\.pms-panel(?:\s*,|\s*\{)/)
  assert.match(globalStyles, /\.pms-page-header(?:\s*,|\s*\{)/)
  assert.match(globalStyles, /\.pms-button--primary(?:\s*,|\s*\{)/)
  assert.match(globalStyles, /\.pms-state-card\s*\{/)
  assert.match(globalStyles, /--pms-control-height-compact:\s*32px/)
  assert.match(globalStyles, /--pms-focus-ring:\s*0 0 0 3px rgb\(10 93 194 \/ 14%\)/)
  assert.match(globalStyles, /--pms-motion-fast:\s*120ms/)
  assert.match(globalStyles, /\.pms-interactive-surface\s*\{/)
})
