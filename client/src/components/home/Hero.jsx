
import './Hero.css'

const features = [
  {
    number: '01',
    title: 'Проекты',
    description: 'Загрузка и хранение программных проектов.',
    position: 'top-left',
  },
  {
    number: '02',
    title: 'Граф зависимостей',
    description: 'Связи и взаимосвязи между файлами проекта.',
    position: 'top-center',
  },
  {
    number: '03',
    title: 'Архитектурные проблемы',
    description: 'Поиск циклических зависимостей и проблемных участков.',
    position: 'top-right',
  },
  {
    number: '04',
    title: 'Маршрут изучения',
    description: 'Порядок чтения файлов для последовательного изучения проекта.',
    position: 'bottom-left',
  },
  {
    number: '05',
    title: 'Применённые правила',
    description: 'Критерии анализа и правила построения маршрута.',
    position: 'bottom-center',
  },
  {
    number: '06',
    title: 'История анализов',
    description: 'Сохранение результатов предыдущих проверок.',
    position: 'bottom-right',
  },
]

function DependencyIllustration() {
  return (
    <svg
      className="hero-diagram__svg"
      viewBox="0 0 500 500"
      role="img"
      aria-label="Схема взаимосвязей между файлами проекта"
    >
      <defs>
        <pattern
          id="diagram-grid"
          width="24"
          height="24"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="#fffaf0" opacity="0.16" />
        </pattern>
      </defs>

      <circle cx="250" cy="250" r="226" fill="url(#diagram-grid)" />

      <g className="diagram-lines">
        <path d="M250 250 L130 130 L82 190" />
        <path d="M250 250 L250 92" />
        <path d="M250 250 L370 130 L418 190" />
        <path d="M250 250 L130 370 L82 310" />
        <path d="M250 250 L250 408" />
        <path d="M250 250 L370 370 L418 310" />
        <path d="M130 130 L250 92 L370 130" />
        <path d="M130 370 L250 408 L370 370" />
        <path className="diagram-lines__accent" d="M82 190 Q250 20 418 190" />
      </g>

      <g className="diagram-nodes">
        <rect x="105" y="105" width="50" height="50" rx="4" />
        <rect x="225" y="67" width="50" height="50" rx="4" />
        <rect x="345" y="105" width="50" height="50" rx="4" />
        <rect x="57" y="165" width="50" height="50" rx="4" />
        <rect x="393" y="165" width="50" height="50" rx="4" />
        <rect x="105" y="345" width="50" height="50" rx="4" />
        <rect x="225" y="383" width="50" height="50" rx="4" />
        <rect x="345" y="345" width="50" height="50" rx="4" />
        <rect x="57" y="285" width="50" height="50" rx="4" />
        <rect x="393" y="285" width="50" height="50" rx="4" />
        <circle className="diagram-nodes__main" cx="250" cy="250" r="53" />
      </g>

      <g className="diagram-labels">
        <text x="250" y="245" textAnchor="middle">CODE</text>
        <text x="250" y="265" textAnchor="middle">TRACE</text>
      </g>
    </svg>
  )
}

export default function Hero() {
  return (
    <section className="hero">
      <div className="hero__intro">
        <span className="eyebrow">
          Анализ структуры программных проектов
        </span>

        <h1>code trace</h1>

        <p>Добро пожаловать в чужой код</p>
      </div>

      <div className="hero__composition">
        {features.map((feature) => (
          <article
            className={`hero-feature hero-feature--${feature.position}`}
            key={feature.number}
          >
            <span className="hero-feature__number">{feature.number}</span>
            <h2>{feature.title}</h2>
            <p>{feature.description}</p>
          </article>
        ))}

        <div className="hero-diagram">
          <div className="hero-diagram__inner">
            <DependencyIllustration />
          </div>
        </div>
      </div>

      <div className="hero__caption">
        Экскурсовод по коду · структура и взаимосвязи файлов
      </div>
    </section>
  )
}
