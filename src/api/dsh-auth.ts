import { http } from '/@/plugins/http'

export const DSH_AUTH_AGENT_ID = 'project_assistant'
export const DSH_AUTH_SCOPES = [
  'pms:project:read',
  'pms:task:read',
  'pms:query:read',
  'pms:task:write',
  'pms:command:preview',
  'pms:command:execute',
  'pms:workflow:write',
  'pms:project:write',
  'pms:workspace:embed',
] as const

export interface DshAuthorizationCodeRequest {
  dshSessionId: string
  agentId?: string
  scopes?: string[]
}

export interface DshAuthorizationCodeResponse {
  authorizationCode: string
  expiresInSeconds: number
  scopes: string[]
}

export function requestDshAuthorizationCode(
  request: DshAuthorizationCodeRequest,
): Promise<DshAuthorizationCodeResponse> {
  return http.post<DshAuthorizationCodeResponse>('/integration/dsh/v1/authorization-codes', {
    dshSessionId: request.dshSessionId,
    agentId: request.agentId || DSH_AUTH_AGENT_ID,
    scopes: request.scopes?.length ? request.scopes : [...DSH_AUTH_SCOPES],
  })
}
