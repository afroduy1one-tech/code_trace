import { api } from './client'

export function getProjects() {
  return api('/projects')
}

export function getProject(id) {
  return api(`/projects/${id}`)
}

export function deleteProject(id) {
  return api(`/projects/${id}`, {
    method: 'DELETE',
  })
}
