import './RulesList.css'

export default function RulesList({ rules }) {
  if (!rules.length) {
    return (
      <div className="rules-empty">
        <span className="eyebrow">ЖУРНАЛ АНАЛИЗА</span>
        <h2>Правила не срабатывали</h2>
        <p>Для этого запуска нет записей о применённых правилах.</p>
      </div>
    )
  }

  return (
    <div className="rules-list">
      <div className="rules-list-heading">
        <span className="eyebrow">ЖУРНАЛ АНАЛИЗА</span>
        <h2>Применённые правила</h2>
        <p>
          Всего срабатываний: {rules.length}
        </p>
      </div>

      <div className="rules-list-items">
        {rules.map((rule, index) => (
          <article className="rules-list-card" key={`${rule.rule_code}-${index}`}>
            <div className="rules-list-card-head">
              <span className="rules-list-number">
                {String(index + 1).padStart(2, '0')}
              </span>

              <code className="rules-list-code">
                {rule.rule_code}
              </code>

              <span className="rules-list-status">
                Сработало
              </span>
            </div>

            <p>{rule.result_description}</p>
          </article>
        ))}
      </div>
    </div>
  )
}