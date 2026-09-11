import assert from 'node:assert/strict'
import test from 'node:test'
import {
  consumeOidcRedirect,
  isPublicAuthPath,
  ldapEnabled,
  localPasswordEnabled,
  oidcCallbackParams,
  oidcProvider,
  rememberOidcRedirect,
} from './sso.ts'

test('public auth paths include the OIDC callback', () => {
  assert.equal(isPublicAuthPath('/login'), true)
  assert.equal(isPublicAuthPath('/login/oidc/callback'), true)
  assert.equal(isPublicAuthPath('/dashboard'), false)
})

test('provider helpers keep local password as the default', () => {
  assert.equal(localPasswordEnabled(undefined), true)
  assert.equal(localPasswordEnabled([{ type: 'local', enabled: false }]), false)
  assert.equal(ldapEnabled([{ type: 'ldap', enabled: true, displayName: 'Directory' }]), true)
  assert.equal(oidcProvider([{ type: 'oidc', enabled: true, displayName: 'SSO' }])?.displayName, 'SSO')
  assert.equal(oidcProvider([{ type: 'oidc', enabled: false }]), null)
})

test('OIDC callback only accepts string query values', () => {
  assert.deepEqual(oidcCallbackParams({ code: 'c', state: 's' }), { code: 'c', state: 's', error: '' })
  assert.deepEqual(oidcCallbackParams({ code: ['c'], error: 'access_denied' }), { code: '', state: '', error: 'access_denied' })
})

test('OIDC redirect memory rejects open redirects', () => {
  const memory = new Map()
  globalThis.sessionStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  }
  rememberOidcRedirect('https://evil.example')
  assert.equal(consumeOidcRedirect(), '/')
  rememberOidcRedirect('/projects/1')
  assert.equal(consumeOidcRedirect(), '/projects/1')
})
