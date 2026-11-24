import './Hero.css'

export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-section__content">
        <span className="eyebrow">CODE TRACE / EXPLORER</span>

        <h1 className="hero-section__title">
          Добро пожаловать
          <br />
          в чужой код
        </h1>

        <p className="hero-section__description">
          Разберитесь в структуре незнакомого проекта,
          найдите важные связи и получите маршрут
          для изучения кодовой базы.
        </p>

        <a href="/new" className="hero-section__action">
          Начать изучение <span>↗</span>
        </a>
      </div>

      <div className="hero-section__aside">
        <span className="eyebrow">01 / ABOUT THE PROCESS</span>
        <h2>Как это работает</h2>
        <p>
          Загрузите проект, исследуйте его архитектуру
          и двигайтесь по понятному маршруту.
        </p>
        <span className="hero-section__index">01—03</span>
      </div>
    </section>
  )
}
