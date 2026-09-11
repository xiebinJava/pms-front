import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const personSelect = fs.readFileSync(new URL('./components/PersonSelect.vue', import.meta.url), 'utf8')
const workbenches = [
  './components/SolutionDesignWorkbench.vue',
  './components/PlanResourceRiskWorkbench.vue',
  './components/DevelopmentControlWorkbench.vue',
  './components/KnowledgeStandardWorkbench.vue',
  './components/TaskKanban.vue',
  './components/Members.vue',
  './index.vue',
  '../../admin/org/index.vue',
  '../../feedback/index.vue',
]

test('person select opens recent people and searches only after typing', () => {
  assert.match(personSelect, /searchUsers/)
  assert.match(personSelect, /readRecentPeople/)
  assert.match(personSelect, /rememberRecentPeople/)
  assert.match(personSelect, /listPersonSelectOptions/)
  assert.match(personSelect, /pickFallbackPeople/)
  assert.match(personSelect, /fillOpenOptions/)
  assert.match(personSelect, /searchUsers\(''\)/)
  assert.match(personSelect, /searchPersonHint/)
  assert.match(personSelect, /noMatchingPerson/)
  assert.match(personSelect, /dropdownVisibleChange/)
  assert.match(personSelect, /250/)
  assert.doesNotMatch(personSelect, /runSearch\(''\)/)
  assert.match(personSelect, /!keyword\.trim\(\)/)
  assert.doesNotMatch(personSelect, /@openChange/)
  assert.match(personSelect, /closable && \(multiple \|\| allowClear\)/)
  assert.match(personSelect, /selectedValues\.value\.forEach/)
  assert.match(personSelect, /searchKeyword \|\| undefined/)
  assert.match(personSelect, /REMEMBER_PERSON_OPTION/)
  assert.match(personSelect, /rememberPersonOption/)
  assert.match(personSelect, /person-select--multiple/)
  assert.match(personSelect, /flex-wrap:\s*nowrap/)
  assert.match(personSelect, /max-height:\s*36px/)
})

test('all person pickers use the shared searchable person select', () => {
  for (const file of workbenches) {
    const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.match(source, /PersonSelect/, file)
  }
})
