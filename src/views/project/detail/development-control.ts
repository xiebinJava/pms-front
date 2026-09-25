import type {
  NodeDevelopmentStory,
  NodeDevelopmentStoryStatus,
  NodeDevelopmentSummary,
  NodeDevelopmentTopic,
  NodeDevelopmentTopicStatus,
} from '/@/types/domain'

export type DevelopmentStory = NodeDevelopmentStory
export type DevelopmentStoryStatus = NodeDevelopmentStoryStatus
export type DevelopmentTopic = NodeDevelopmentTopic
export type DevelopmentTopicStatus = NodeDevelopmentTopicStatus
export type DevelopmentSummary = NodeDevelopmentSummary

export function resolveSelectedTopicId(
  topics: DevelopmentTopic[],
  selectedTopicId?: number,
  selectedTopicTitle?: string,
): number | undefined {
  const selectedById = topics.find((topic) => topic.id === selectedTopicId)
  if (selectedById?.id != null) return selectedById.id
  const selectedByTitle = selectedTopicTitle
    ? topics.find((topic) => topic.title === selectedTopicTitle)
    : undefined
  return selectedByTitle?.id ?? topics[0]?.id
}

export function getTopicProgress(topic: DevelopmentTopic): number {
  if (!topic.stories.length) return 0
  return Math.round(topic.stories.reduce((total, story) => total + getStoryProgress(story), 0) / topic.stories.length)
}

export function getStoryProgress(story: Pick<DevelopmentStory, 'status' | 'progress'>): number {
  if (story.status === 'DONE') return 100
  if (story.status === 'NOT_STARTED') return 0
  return Math.min(100, Math.max(0, story.progress ?? 0))
}

export function getDevelopmentSummary(topics: DevelopmentTopic[]): DevelopmentSummary {
  const stories = topics.flatMap((topic) => topic.stories)
  const progress = stories.length
    ? Math.round(stories.reduce((total, story) => total + getStoryProgress(story), 0) / stories.length)
    : 0

  return {
    topicCount: topics.length,
    storyCount: stories.length,
    completedStoryCount: stories.filter((story) => story.status === 'DONE').length,
    blockedStoryCount: stories.filter((story) => story.status === 'BLOCKED').length,
    progress,
  }
}

export function getDerivedTopicStatus(stories: DevelopmentStory[]): DevelopmentTopicStatus {
  if (!stories.length) return 'NOT_STARTED'
  if (stories.every((story) => story.status === 'DONE')) return 'DONE'
  if (stories.some((story) => story.status !== 'NOT_STARTED')) return 'IN_PROGRESS'
  return 'NOT_STARTED'
}

/** Project-row status follows the same story-derived rules as topic status, so it stays aligned with summary progress. */
export function getDerivedProjectStatus(topics: DevelopmentTopic[]): DevelopmentTopicStatus {
  if (!topics.length) return 'NOT_STARTED'
  return getDerivedTopicStatus(topics.flatMap((topic) => topic.stories))
}

export function getProjectStatusPresentation(
  status: DevelopmentTopicStatus,
): { label: string; className: string } {
  if (status === 'DONE') return { label: '已完成', className: 'done' }
  if (status === 'IN_PROGRESS') return { label: '开发中', className: 'in-progress' }
  return { label: '未开始', className: 'not-started' }
}
