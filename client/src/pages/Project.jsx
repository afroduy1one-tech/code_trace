
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import Header from '../components/Header'
import { deleteProject, getProject } from '../api/projects'

import './Project.css'

function formatDate(value) {
  if (!value) return '—'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Дата неизвестна'
  }

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

export default function Project() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [project, setProject] = useState(null)
  const [runs, setRuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    async function loadProject() {
      setLoading(true)
      setError('')

      try {
        const data = await getProject(id)

        setProject(data.project)
        setRuns(data.runs)
      } catch (err) {
        setError(err.message || 'Не удалось загрузить проект')
      } finally {
        setLoading(false)
      }
    }

    loadProject()
  }, [id])

  async function handleDelete() {
    const confirmed = window.confirm(
      'Удалить проект вместе со всеми запусками анализа? Это действие нельзя отменить.'
    )

    if (!confirmed || deleting) return

    setDeleting(true)
    setError('')

    try {
      await deleteProject(id)
      navigate('/projects', { replace: true })
    } catch (err) {
      setError(err.message || 'Не удалось удалить проект')
      setDeleting(false)
    }
  }

  const lastRun = runs[0]
  const previousRun = runs[1]

  if (loading) {
    return (
      <>
        <Header />
        <main className="project-page">
          <p className="project-message">Загружаем проект...</p>
        </main>
      </>
    )
  }

  if (error && !project) {
    return (
      <>
        <Header />
        <main className="project-page">
          <p className="project-error">{error}</p>
          <Link to="/projects" className="project-back-link">
            ← Вернуться к проектам
          </Link>
        </main>
      </>
    )
  }

  if (!project) return null

  return (
    <>
      <Header />

      <main className="project-page">
        <nav className="project-breadcrumbs">
          <Link to="/projects">Мои проекты</Link>
          <span>/</span>
          <span>{project.name}</span>
        </nav>

        <section className="project-heading">
          <div>
            <span className="eyebrow">ПРОЕКТ</span>
            <h1>{project.name}</h1>

            <p className="project-repository">
              {project.repository_url || 'Локальный проект'}
            </p>
          </div>

          <span className="project-runs-count">
            {runs.length} запусков
          </span>
        </section>

        <section className="project-actions">
          <Link
            to={`/new?mode=repeat&project=${project.id}`}
            className="project-action-primary"
          >
            Повторный анализ <span>↗</span>
          </Link>

          {lastRun && (
            <Link
              to={`/analysis/${lastRun.id}`}
              className="project-action"
            >
              Открыть последние результаты →
            </Link>
          )}

          {lastRun && previousRun && (
            <Link
              to={`/analysis/${lastRun.id}/diff/${previousRun.id}`}
              className="project-action"
            >
              Сравнить запуски →
            </Link>
          )}

          <button
            type="button"
            className="project-delete-button"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Удаление...' : 'Удалить проект'}
          </button>
        </section>

        {error && (
          <p className="project-error" role="alert">
            {error}
          </p>
        )}

        <section className="project-runs-section">
          <div className="project-section-heading">
            <h2>Запуски анализа</h2>
            <span>ИСТОРИЯ ПРОЕКТА</span>
          </div>

          {runs.length === 0 ? (
            <div className="project-empty">
              <h3>Пока нет запусков</h3>
              <p>Запустите первый анализ этого проекта.</p>
            </div>
          ) : (
            <div className="project-runs-table-wrapper">
              <table className="project-runs-table">
                <thead>
                  <tr>
                    <th>Номер</th>
                    <th>Дата запуска</th>
                    <th>Статус</th>
                    <th></th>
                  </tr>
                </thead>

                <tbody>
                  {runs.map((run, index) => (
                    <tr key={run.id}>
                      <td>#{run.id}</td>
                      <td>{formatDate(run.analyzed_at)}</td>
                      <td>
                        <span
                          className={`project-run-status status-${run.status}`}
                        >
                          {getStatusLabel(run.status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          to={`/analysis/${run.id}`}
                          className="project-open-run"
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

        <Link to="/projects" className="project-back-link">
          ← Все проекты
        </Link>
      </main>
    </>
  )
}
