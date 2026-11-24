import { api, resetCsrf } from './client'

export function getCurrentUser() {
  return api('/auth/me')
}

export function register(data) {
  return api('/auth/register', {
    method: 'POST',
    body: data,
  })
}

export function login(data) {
  return api('/auth/login', {
    method: 'POST',
    body: data,
  })
}

export async function logout() {
  try {
    return await api('/auth/logout', {
      method: 'POST',
    })
  } finally {
    resetCsrf()
  }
}

export function updateUserLevel(level) {
  return api('/auth/level', {
    method: 'PATCH',
    body: { level },
  })
}
