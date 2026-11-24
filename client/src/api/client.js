let csrfToken = null

async function ensureCsrf() {
  if (csrfToken) return csrfToken

  const response = await fetch('/api/csrf', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Не удалось получить CSRF-токен')
  }

  const data = await response.json()
  csrfToken = data.token

  return csrfToken
}

export function resetCsrf() {
  csrfToken = null
}

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = new Headers(options.headers)
  let body = options.body

  if (body && !(body instanceof FormData) && typeof body !== 'string') {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(body)
  }

  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('X-CSRF-Token', await ensureCsrf())
  }

  const response = await fetch(`/api${path}`, {
    ...options,
    method,
    headers,
    body,
    credentials: 'include',
  })

  const text = await response.text()
  let data = null

  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.error || `Ошибка запроса: ${response.status}`
    )

    error.status = response.status
    error.data = data

    throw error
  }

  return data
}
