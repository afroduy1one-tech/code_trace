import './ProblemsList.css'

export default function ProblemsList({ problems }) {
  if (!problems.length) {
    return (
      <div className="problems-empty">
        <span className="eyebrow">РЕЗУЛЬТАТ ПРОВЕРКИ</span>
        <h2>Проблем не обнаружено</h2>
        <p>Архитектурных проблем в этом анализе нет.</p>
      </div>
    )
  }

  return (
    <div className="problems-list">
      <div className="problems-summary">
        <span className="eyebrow">РЕЗУЛЬТАТ ПРОВЕРКИ</span>
        <h2>Обнаружено проблем: {problems.length}</h2>
        <p>
          Анализатор выявил следующие особенности структуры проекта.
        </p>
      </div>

      {problems.map((problem, index) => (
        <article className="problem-card" key={problem.id ?? index}>
          <div className="problem-card-head">
            <span className="problem-number">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="problem-label">
              Архитектурная проблема
            </span>
          </div>

          <p>{problem.description}</p>
        </article>
      ))}
    </div>
  )
}