import {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react'

import {
  getCurrentUser,
  logout as logoutRequest,
} from '../api/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadUser() {
      try {
        const data = await getCurrentUser()

        if (!cancelled) {
          setUser(data.user ?? data)
        }
      } catch (error) {
        if (!cancelled && error.status !== 401) {
          console.error('Ошибка загрузки пользователя:', error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadUser()

    return () => {
      cancelled = true
    }
  }, [])

  async function logout() {
    await logoutRequest()
    setUser(null)
  }

  function login(userData) {
    setUser(userData.user ?? userData)
  }

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    login,
    logout,
    setUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth должен использоваться внутри AuthProvider')
  }

  return context
}
