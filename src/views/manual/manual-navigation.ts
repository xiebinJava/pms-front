export type ManualSectionPosition = {
  id: string
  top: number
}

/**
 * Pick the last section whose top edge has crossed the reading anchor.
 * Keeping this calculation pure makes the scroll/highlight contract easy to
 * verify without mounting the full Vue page.
 */
export function pickActiveManualSection(
  sections: ManualSectionPosition[],
  anchor = 160,
): string | null {
  if (!sections.length) return null

  const current = sections.filter((section) => section.top <= anchor).at(-1)
  return current?.id ?? sections[0].id
}
