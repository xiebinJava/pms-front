export function getWorkflowTemplateVersionOptions(templates, projectTypeId, defaultVersionId) {
  return templates
    .filter((template) => template.projectTypeId === projectTypeId)
    .flatMap((template) => (template.publishedVersions || []).map((version) => ({
      ...version,
      templateName: template.name,
      isDefault: version.id === defaultVersionId,
    })))
}
