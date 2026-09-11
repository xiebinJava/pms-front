import type { NodeKnowledgeAction, NodeKnowledgeAsset, NodeKnowledgeActionStatus } from '/@/types/domain'

export function getKnowledgeAssetSummary(assets: Pick<NodeKnowledgeAsset, 'name' | 'status'>[]) {
  return {
    total: assets.length,
    ready: assets.filter((asset) => asset.status === 'UPDATED' || asset.status === 'RETAINED').length,
  }
}

export function getKnowledgeActionSummary(actions: Pick<NodeKnowledgeAction, 'title' | 'status'>[]) {
  return {
    total: actions.length,
    completed: actions.filter((action) => action.status === 'DONE').length,
  }
}

export function getKnowledgeStatusLabel(status: NodeKnowledgeActionStatus): string {
  return {
    NOT_STARTED: '待开始',
    IN_PROGRESS: '进行中',
    DONE: '已完成',
  }[status]
}
