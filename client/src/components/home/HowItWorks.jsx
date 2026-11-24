import './HowItWorks.css'

const steps = [
  {
    number: '01',
    title: 'Загрузите проект',
    description:
      'Добавьте GitHub-ссылку или загрузите ZIP-архив с исходным кодом.',
  },
  {
    number: '02',
    title: 'Исследуйте структуру',
    description:
      'Посмотрите граф зависимостей, найдите центральные файлы и архитектурные проблемы.',
  },
  {
    number: '03',
    title: 'Следуйте маршруту',
    description:
      'Изучайте код последовательно, переходя от важных файлов к зависимым модулям.',
  },
]

export default function HowItWorks() {
  return (
    <section className="how-section">
      <div className="how-section__heading">
        <span className="eyebrow">02 / THE PROCESS</span>
        <h2>От незнакомого проекта<br />к понятной структуре</h2>
      </div>

      <div className="how-section__steps">
        {steps.map((step) => (
          <article className="how-step" key={step.number}>
            <span className="how-step__number">{step.number}</span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
