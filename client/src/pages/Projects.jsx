
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Header from '../components/Header'
import { getProjects } from '../api/projects'
import { useAuth } from '../context/AuthContext'

import './Projects.css'

function formatDate(value) {
  if (!value) return 'Пока нет запусков'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'Дата неизвестна'
  }

  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export default function Projects() {
  const { user, updateLevel } = useAuth()

  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [levelLoading, setLevelLoading] = useState(false)

  useEffect(() => {
    async function loadProjects() {
      try {
        const data = await getProjects()
        setProjects(data)
      } catch (err) {
        setError(err.message || 'Не удалось загрузить проекты')
      } finally {
        setLoading(false)
      }
    }

    loadProjects()
  }, [])

  async function handleLevelChange(level) {
    if (level === user?.level || levelLoading) return

    setLevelLoading(true)
    setError('')

    try {
      await updateLevel(level)
    } catch (err) {
      setError(err.message || 'Не удалось изменить уровень')
    } finally {
      setLevelLoading(false)
    }
  }

  const totalRuns = projects.reduce(
    (sum, project) => sum + Number(project.runs || 0),
    0
  )

  const completedProjects = projects.filter(
    (project) => project.last_status === 'completed'
  ).length

  return (
    <>
      <Header />

      <main className="projects-page">
        <div className="projects-heading">
          <div>
            <span className="eyebrow">ВАШЕ ПРОСТРАНСТВО</span>
            <h1>Мои проекты</h1>
            <p>Все проекты и история их анализа в одном месте.</p>
          </div>

          <Link to="/new" className="projects-create-button">
            Новый анализ <span>↗</span>
          </Link>
        </div>

        <section className="projects-stats">
          <div className="projects-stat">
            <span className="projects-stat-label">Всего проектов</span>
            <strong>{loading ? '—' : projects.length}</strong>
          </div>

          <div className="projects-stat">
            <span className="projects-stat-label">Запусков анализа</span>
            <strong>{loading ? '—' : totalRuns}</strong>
          </div>

          <div className="projects-stat">
            <span className="projects-stat-label">Завершённых проектов</span>
            <strong>{loading ? '—' : completedProjects}</strong>
          </div>

          <div className="projects-stat projects-level">
            <span className="projects-stat-label">
              Уровень подготовки
            </span>

            <div className="level-switch">
              <button
                type="button"
                className={user?.level === 'beginner' ? 'active' : ''}
                onClick={() => handleLevelChange('beginner')}
                disabled={levelLoading || loading}
              >
                Новичок
              </button>

              <button
                type="button"
                className={user?.level === 'experienced' ? 'active' : ''}
                onClick={() => handleLevelChange('experienced')}
                disabled={levelLoading || loading}
              >
                Опытный
              </button>
            </div>

            <span className="projects-level-hint">
              Влияет на порядок маршрута изучения
            </span>
          </div>
        </section>

        {error && (
          <div className="projects-error" role="alert">
            {error}
          </div>
        )}

        <section className="projects-list-section">
          <div className="projects-list-heading">
            <h2>Список проектов</h2>
            <span>{loading ? 'Загрузка...' : `${projects.length} проектов`}</span>
          </div>

          {loading ? (
            <div className="projects-message">
              Загружаем проекты...
            </div>
          ) : projects.length === 0 ? (
            <div className="projects-empty">
              <span className="eyebrow">ПОКА ЗДЕСЬ ПУСТО</span>
              <h3>Начните с первого анализа</h3>
              <p>
                Добавьте репозиторий GitHub или загрузите ZIP-архив
                проекта, чтобы исследовать его структуру.
              </p>
              <Link to="/new" className="projects-create-button">
                Создать первый анализ <span>↗</span>
              </Link>
            </div>
          ) : (
            <div className="projects-table-wrapper">
              <table className="projects-table">
                <thead>
                  <tr>
                    <th>Проект</th>
                    <th>Репозиторий</th>
                    <th>Запуски</th>
                    <th>Последний анализ</th>
                    <th>Статус</th>
                  </tr>
                </thead>

                <tbody>
                  {projects.map((project) => (
                    <tr key={project.id}>
                      <td className="project-name">
                        <Link to={`/project/${project.id}`}>
                            {project.name}
                        </Link>
                        </td>

                      <td>
                        {project.repository_url ? (
                          <a
                            href={project.repository_url}
                            target="_blank"
                            rel="noreferrer"
                            className="project-repository"
                          >
                            {project.repository_url.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <span className="project-muted">Локальный проект</span>
                        )}
                      </td>

                      <td>{Number(project.runs || 0)}</td>

                      <td>{formatDate(project.last_run)}</td>

                      <td>
                        <span
                          className={`project-status ${
                            project.last_status === 'completed'
                              ? 'completed'
                              : ''
                          }`}
                        >
                          {project.last_status === 'completed'
                            ? 'Завершён'
                            : project.last_status || 'Нет запусков'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="projects-footnote">
          Новый проект создаётся автоматически при запуске анализа.
          Для повторного анализа используйте существующий проект.
        </p>
      </main>
    </>
  )
}
