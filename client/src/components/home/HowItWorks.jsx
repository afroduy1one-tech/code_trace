
import { useState } from 'react'
import { Link } from 'react-router-dom'

import './HowItWorks.css'

export default function HowItWorks() {
  const [repositoryUrl, setRepositoryUrl] = useState('')

  function handleSubmit(event) {
    event.preventDefault()

    if (!repositoryUrl.trim()) return

    const params = new URLSearchParams({
      repository: repositoryUrl.trim(),
    })

    window.location.href = `/new?${params.toString()}`
  }

  return (
    <section className="upload-section">
      <div className="upload-section__heading">
        <span className="eyebrow">НАЧАТЬ ИССЛЕДОВАНИЕ</span>
        <h2>С чего начнём?</h2>
        <p>
          Добавьте ссылку на GitHub-репозиторий, чтобы
          исследовать структуру проекта.
        </p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label htmlFor="repository-url">
          Ссылка на GitHub
        </label>

        <div className="upload-form__controls">
          <input
            id="repository-url"
            type="url"
            placeholder="https://github.com/username/project"
            value={repositoryUrl}
            onChange={(event) => setRepositoryUrl(event.target.value)}
            required
          />

          <button type="submit">
            Загрузить проект <span aria-hidden="true">↗</span>
          </button>
        </div>

        <p className="upload-form__note">
          Или <Link to="/new">перейдите к загрузке ZIP-архива</Link>
          {' '}· поддержка GitHub-репозиториев
        </p>
      </form>
    </section>
  )
}
