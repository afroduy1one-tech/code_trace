
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

import './Header.css'

export default function Header() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    try {
      await logout()
      navigate('/')
    } catch (error) {
      console.error('Ошибка выхода:', error)
    }
  }

  return (
    <header className="site-header">
      <Link to="/" className="site-header__logo">
        CODE TRACE
      </Link>

      <nav className="site-header__nav">
        <NavLink to="/" end>
          Главная
        </NavLink>

        {user && (
          <>
            <NavLink to="/projects">Проекты</NavLink>
            <NavLink to="/history">История</NavLink>
            {user.role === 'admin' && (
              <NavLink to="/admin">Администрирование</NavLink>
            )}
          </>
        )}
      </nav>

      <div className="site-header__account">
        {loading ? null : user ? (
          <>
            <span className="site-header__username">
              {user.name || user.login}
            </span>
            <button
              type="button"
              className="site-header__logout"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </>
        ) : (
          <Link to="/login" className="site-header__login">
            Войти <span aria-hidden="true">↗</span>
          </Link>
        )}
      </div>
    </header>
  )
}
