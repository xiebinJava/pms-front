import { http } from '/@/plugins/http'
import type { User } from '/@/types/domain'

export interface CliAuthorizeApproval {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
  codeChallengeMethod: 'S256'
}

export interface CliAuthorizeResult {
  authorizationCode: string
  redirectUri: string
  state: string
  expiresInSeconds: number
}

export function approveCliAuthorization(request: CliAuthorizeApproval): Promise<CliAuthorizeResult> {
  return http.post('/integration/cli/v1/authorize/approve', request)
}

export interface CliTokenResult {
  accessToken: string
  refreshToken: string
  expiresInSeconds: number
  user: User
}
