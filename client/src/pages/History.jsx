import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Header from '../components/Header'
import { getProjects, getProject } from '../api/projects'

import './History.css'

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'Дата неизвестна'

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getStatusLabel(status) {
  const labels = {
    completed: 'Завершён',
    processing: 'Выполняется',
    pending: 'Ожидает запуска',
    failed: 'Ошибка',
  }

  return labels[status] || status || 'Неизвестно'
}

export default function History() {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadHistory() {
      try {
        const projects = await getProjects()

        const projectRuns = await Promise.all(
          projects.map(async (project) => {
            const data = await getProject(project.id)

            return data.runs.map((run) => ({
              ...run,
              projectId: project.id,
              projectName: project.name,
            }))
          })
        )

        const allRuns = projectRuns
          .flat()
          .sort((a, b) => b.id - a.id)

        setHistory(allRuns)
      } catch (err) {
        setError(err.message || 'Не удалось загрузить историю')
      } finally {
        setLoading(false)
      }
    }

    loadHistory()
  }, [])

  return (
    <>
      <Header />

      <main className="history-page">
        <div className="history-heading">
          <div>
            <span className="eyebrow">ИСТОРИЯ РАБОТЫ</span>
            <h1>История запусков</h1>
            <p>Все проведённые анализы ваших проектов.</p>
          </div>

          <Link to="/projects" className="history-back-link">
            Мои проекты <span>↗</span>
          </Link>
        </div>

        <section className="history-section">
          <div className="history-section-heading">
            <h2>Все запуски</h2>
            <span>
              {loading ? 'Загрузка...' : `${history.length} запусков`}
            </span>
          </div>

          {error && (
            <p className="history-error" role="alert">
              {error}
            </p>
          )}

          {loading ? (
            <div className="history-message">
              Загружаем историю...
            </div>
          ) : history.length === 0 ? (
            <div className="history-empty">
              <span className="eyebrow">ПОКА НЕТ ЗАПУСКОВ</span>
              <h3>История начнётся с первого анализа</h3>
              <p>
                Запустите анализ проекта, и здесь появятся его результаты.
              </p>
              <Link to="/projects" className="history-back-link">
                Перейти к проектам →
              </Link>
            </div>
          ) : (
            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>Запуск</th>
                    <th>Проект</th>
                    <th>Дата</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {history.map((run) => (
                    <tr key={run.id}>
                      <td className="history-run-id">#{run.id}</td>

                      <td>
                        <Link
                          to={`/project/${run.projectId}`}
                          className="history-project-link"
                        >
                          {run.projectName}
                        </Link>
                      </td>

                      <td>{formatDate(run.analyzed_at)}</td>

                      <td>
                        <span
                          className={`history-status status-${run.status}`}
                        >
                          {getStatusLabel(run.status)}
                        </span>
                      </td>

                      <td>
                        <Link
                          to={`/analysis/${run.id}`}
                          className="history-open-link"
                        >
                          Открыть →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </>
  )
}