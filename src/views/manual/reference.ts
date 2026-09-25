export type ReferenceDocumentId = 'business-rules' | 'design-system'

export type ReferenceSection = {
  id: string
  titleKey: string
  summaryKey: string
  rulesKey: string
  examplesKey: string
}

export type ReferenceDocument = {
  id: ReferenceDocumentId
  titleKey: string
  eyebrowKey: string
  leadKey: string
  purposeKey: string
  scopeKey: string
  sourceKey: string
  sections: ReferenceSection[]
}

const section = (documentId: ReferenceDocumentId, id: string): ReferenceSection => ({
  id,
  titleKey: `manual.references.${documentId === 'business-rules' ? 'businessRules' : 'designSystem'}.sections.${id}.title`,
  summaryKey: `manual.references.${documentId === 'business-rules' ? 'businessRules' : 'designSystem'}.sections.${id}.summary`,
  rulesKey: `manual.references.${documentId === 'business-rules' ? 'businessRules' : 'designSystem'}.sections.${id}.rules`,
  examplesKey: `manual.references.${documentId === 'business-rules' ? 'businessRules' : 'designSystem'}.sections.${id}.examples`,
})

export const referenceDocuments: Record<ReferenceDocumentId, ReferenceDocument> = {
  'business-rules': {
    id: 'business-rules',
    titleKey: 'manual.references.businessRules.title',
    eyebrowKey: 'manual.references.businessRules.eyebrow',
    leadKey: 'manual.references.businessRules.lead',
    purposeKey: 'manual.references.businessRules.purpose',
    scopeKey: 'manual.references.businessRules.scope',
    sourceKey: 'manual.references.businessRules.source',
    sections: ['identity', 'organization', 'authorization', 'lifecycle', 'import', 'audit', 'recovery'].map((id) => section('business-rules', id)),
  },
  'design-system': {
    id: 'design-system',
    titleKey: 'manual.references.designSystem.title',
    eyebrowKey: 'manual.references.designSystem.eyebrow',
    leadKey: 'manual.references.designSystem.lead',
    purposeKey: 'manual.references.designSystem.purpose',
    scopeKey: 'manual.references.designSystem.scope',
    sourceKey: 'manual.references.designSystem.source',
    sections: ['principles', 'tokens', 'typography', 'color', 'layout', 'components', 'states', 'responsive', 'accessibility', 'governance'].map((id) => section('design-system', id)),
  },
}
