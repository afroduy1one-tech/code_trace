import { api } from './client'

// Запуск анализа ZIP-архива
export function runArchive(formData) {
  return api('/analysis/run', {
    method: 'POST',
    body: formData,
  })
}

// Запуск анализа GitHub-репозитория
export function runGithub(data) {
  return api('/analysis/run-url', {
    method: 'POST',
    body: data,
  })
}

// Демонстрационный анализ
export function runDemo() {
  return api('/analysis/run-demo', {
    method: 'POST',
  })
}

// Получение результатов анализа
export function getAnalysis(id) {
  return api(`/analysis/${id}`)
}

// Сравнение двух запусков
export function compareAnalyses(leftId, rightId) {
  return api(`/analysis/compare/${leftId}/${rightId}`)
}

// Подключение к потоку прогресса
export function subscribeToProgress(token, onProgress, onError) {
  const source = new EventSource(
    `/api/analysis/progress/${encodeURIComponent(token)}`
  )

  source.onmessage = (event) => {
    try {
      onProgress(JSON.parse(event.data))
    } catch {
      onError?.(new Error('Не удалось обработать данные прогресса'))
    }
  }

  source.onerror = () => {
    onError?.(new Error('Соединение с потоком прогресса прервано'))
  }

  return source
}
