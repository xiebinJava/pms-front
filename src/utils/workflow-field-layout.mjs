const projectPeopleBindings = new Set(['project.projectMembers', 'project.followers'])

export function isWorkflowFieldFullWidth(field) {
  if (typeof field?.fullWidth === 'boolean') return field.fullWidth

  return field?.type === 'TEXTAREA'
    || field?.type === 'ATTACHMENT'
    || (field?.type === 'PERSON_MULTI' && !projectPeopleBindings.has(field.binding))
}
