import { Link } from 'react-router-dom'
import './RouteList.css'

function getRouteGroup(text) {
  if (text.includes('Начните с подтверждённой точки входа')) return 'Точка входа'
  if (text.includes('Возможная точка входа')) return 'Возможная точка входа'
  if (text.includes('Изучите центральный файл')) return 'Центральный файл'
  if (text.includes('Прочитайте вместе')) return 'Циклическая зависимость'
  if (text.includes('Завершите чтение')) return 'Завершающие файлы'
  return 'Дополнительные файлы'
}

export default function RouteList({ route, analysisId }) {
  if (!route.steps.length) {
    return (
      <div className="route-empty">
        <h2>Маршрут не сформирован</h2>
        <p>Для этого анализа нет доступных шагов изучения.</p>
      </div>
    )
  }

  return (
    <div className="route-list-page">
      <div className="route-list-heading">
        <span className="eyebrow">ПЛАН ИЗУЧЕНИЯ</span>
        <h2>Последовательность чтения</h2>
        <p>
          Маршрут построен на основе структуры зависимостей
          между файлами проекта.
        </p>
      </div>

      <div className="route-list-items">
        {route.steps.map((step, index) => (
          <article className="route-list-card" key={index}>
            <div className="route-list-number">
              {String(index + 1).padStart(2, '0')}
            </div>

            <div className="route-list-body">
              <span className="route-list-group">
                {getRouteGroup(step.text)}
              </span>

              <p>{step.text}</p>
            </div>

            <Link
              to={`/analysis/${analysisId}/step/${index}`}
              className="route-list-open"
            >
              Открыть
              <span>↗</span>
            </Link>
          </article>
        ))}
      </div>
    </div>
  )
}