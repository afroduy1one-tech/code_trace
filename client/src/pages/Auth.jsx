import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'

import { login, register } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import Header from '../components/Header'

import './Auth.css'


export default function Auth() {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({
    login: '',
    password: '',
    name: '',
  })
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const {
    login: setUser,
    user,
    loading: authLoading,
  } = useAuth()
  const navigate = useNavigate()

  function handleChange(event) {
    const { name, value } = event.target

    setForm((current) => ({
      ...current,
      [name]: value,
    }))
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setSubmitting(true)

    try {
      const data =
        mode === 'login'
          ? await login({
              login: form.login,
              password: form.password,
            })
          : await register(form)

      setUser(data)
      navigate('/projects')
    } catch (err) {
      setError(err.message || 'Не удалось выполнить запрос')
    } finally {
      setSubmitting(false)
    }
  }

  const isLogin = mode === 'login'
  
  if (authLoading) {
    return null
  }

  if (user) {
    return <Navigate to="/" replace />
  }

 return (
  <>
    <Header />

    <main className="auth-page">
      <section className="auth-panel">
        <span className="eyebrow">CODE TRACE / ACCOUNT</span>

        <h1>
          {isLogin ? 'С возвращением' : 'Создать аккаунт'}
        </h1>

        <p className="auth-panel__description">
          {isLogin
            ? 'Войдите, чтобы продолжить изучение проектов.'
            : 'Зарегистрируйтесь, чтобы сохранять проекты и результаты анализа.'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <label className="auth-form__field">
              <span>Имя</span>
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="Как к вам обращаться"
                maxLength={100}
              />
            </label>
          )}

          <label className="auth-form__field">
            <span>Логин</span>
            <input
              name="login"
              value={form.login}
              onChange={handleChange}
              placeholder="Введите логин"
              minLength={3}
              maxLength={50}
              required
              autoComplete="username"
            />
          </label>

          <label className="auth-form__field">
            <span>Пароль</span>
            <input
              type="password"
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Введите пароль"
              minLength={4}
              maxLength={100}
              required
              autoComplete={isLogin ? 'current-password' : 'new-password'}
            />
          </label>

          {error && (
            <p className="auth-form__error" role="alert">
              {error}
            </p>
          )}

          <button
            className="auth-form__submit"
            type="submit"
            disabled={submitting}
          >
            {submitting
              ? 'Подождите...'
              : isLogin
                ? 'Войти'
                : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="auth-panel__switch">
          {isLogin ? 'Ещё нет аккаунта?' : 'Уже есть аккаунт?'}
          <button
            type="button"
            onClick={() => {
              setMode(isLogin ? 'register' : 'login')
              setError('')
            }}
          >
            {isLogin ? 'Регистрация' : 'Войти'}
          </button>
        </div>

        <Link to="/" className="auth-panel__back">
          ← Вернуться на главную
        </Link>
      </section>
   </main>
  </>
)
}