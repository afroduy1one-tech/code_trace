import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import Header from '../components/Header'
import { getAnalysis } from '../api/analysis'
import DependencyGraph from '../components/analysis/DependencyGraph'
import ProblemsList from '../components/analysis/ProblemsList'
import RouteList from '../components/analysis/RouteList'
import RulesList from '../components/analysis/RulesList'

import './Analysis.css'

const tabs = [
  { id: 'graph', label: 'Граф зависимостей' },
  { id: 'problems', label: 'Архитектурные проблемы' },
  { id: 'route', label: 'Маршрут изучения' },
  { id: 'rules', label: 'Применённые правила' },
]

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

export default function Analysis() {
  const { id } = useParams()

  const [data, setData] = useState(null)
  const [activeTab, setActiveTab] = useState('graph')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadAnalysis() {
      setLoading(true)
      setError('')

      try {
        const result = await getAnalysis(id)
        setData(result)
      } catch (err) {
        setError(err.message || 'Не удалось загрузить результаты анализа')
      } finally {
        setLoading(false)
      }
    }

    loadAnalysis()
  }, [id])

  if (loading) {
    return (
      <>
        <Header />
        <main className="analysis-page">
          <p className="analysis-message">Загружаем результаты анализа...</p>
        </main>
      </>
    )
  }

  if (error || !data) {
    return (
      <>
        <Header />
        <main className="analysis-page">
          <p className="analysis-error" role="alert">
            {error || 'Данные анализа не найдены'}
          </p>
          <Link to="/projects" className="analysis-back-link">
            ← Вернуться к проектам
          </Link>
        </main>
      </>
    )
  }

  const { analysis, project, files, links, results, rules, route } = data
  const problems = results.filter(
    (result) => result.result_type === 'problem'
  )

  return (
    <>
      <Header />

      <main className="analysis-page">
        <div className="analysis-breadcrumbs">
          <Link to="/projects">Проекты</Link>
          <span>/</span>
          <Link to={`/project/${analysis.project_id}`}>
            {project.name}
          </Link>
          <span>/</span>
          <span>Запуск #{analysis.id}</span>
        </div>

        <section className="analysis-heading">
          <div>
            <span className="eyebrow">РЕЗУЛЬТАТЫ АНАЛИЗА</span>
            <h1>{project.name}</h1>
            <p>Запуск #{analysis.id}</p>
          </div>

          <div className="analysis-meta">
            <span className={`analysis-status status-${analysis.status}`}>
              {getStatusLabel(analysis.status)}
            </span>
            <span>{formatDate(analysis.analyzed_at)}</span>
          </div>
        </section>

        <nav className="analysis-tabs" aria-label="Разделы анализа">
          {tabs.map((tab) => {
            let count = null

            if (tab.id === 'problems') count = problems.length
            if (tab.id === 'route') count = route.steps.length
            if (tab.id === 'rules') count = rules.length

            return (
              <button
                key={tab.id}
                type="button"
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
                {count !== null && <span>{count}</span>}
              </button>
            )
          })}
        </nav>

        <section className="analysis-content">
          <div className="analysis-main">
            {activeTab === 'graph' && (
                <DependencyGraph
                    files={files}
                    links={links}
                    route={route}
                    analysisId={analysis.id}
                />
                )}

                {activeTab === 'problems' && (
                <ProblemsList problems={problems} />
                
                )}

                {activeTab === 'route' && (
                <RouteList
                    route={route}
                    analysisId={analysis.id}
                />
                )}

                {activeTab === 'rules' && (
                <RulesList rules={rules} />
                )}

                {activeTab === 'rules' && (
                <div className="analysis-placeholder">
                    <span className="eyebrow">
                    {files.length} ФАЙЛОВ · {links.length} СВЯЗЕЙ
                    </span>

                    <h2>
                    {tabs.find((tab) => tab.id === activeTab)?.label}
                    </h2>

                    <p>Этот раздел подключим следующим этапом.</p>
                </div>
                )}
        </div>

          <aside className="analysis-sidebar">
            <span className="eyebrow">МАРШРУТ ИЗУЧЕНИЯ</span>
            <h2>Порядок чтения</h2>

            <div className="analysis-route-preview">
              {route.steps.map((step, index) => (
                <div className="analysis-route-item" key={index}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <p>{step.text}</p>
                </div>
              ))}
            </div>

            {route.steps.length > 0 && (
              <Link
                to={`/analysis/${analysis.id}/step/0`}
                className="analysis-route-link"
              >
                Открыть первый шаг →
              </Link>
            )}
          </aside>
        </section>
      </main>
    </>
  )
}