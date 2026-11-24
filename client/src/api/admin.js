import { api } from './client'

export function getAdminStats() {
  return api('/admin/stats')
}

export function updateUser(id, data) {
  return api(`/admin/users/${id}`, {
    method: 'PATCH',
    body: data,
  })
}

export function deleteUser(id) {
  return api(`/admin/users/${id}`, {
    method: 'DELETE',
  })
}

export function deleteProject(id) {
  return api(`/admin/projects/${id}`, {
    method: 'DELETE',
  })
}

export function deleteAnalysis(id) {
  return api(`/admin/analysis/${id}`, {
    method: 'DELETE',
  })
}
