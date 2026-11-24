
import { Navigate, Route, Routes } from 'react-router-dom'

import Home from './pages/Home'
import Auth from './pages/Auth'
import Projects from './pages/Projects'
import ProtectedRoute from './components/ProtectedRoute'
import Project from './pages/Project'
import History from './pages/History'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Auth />} />

      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <Projects />
          </ProtectedRoute>
        }
      />

      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <History />
          </ProtectedRoute>
        }
      />

      <Route
        path="/project/:id"
        element={
          <ProtectedRoute>
            <Project />
          </ProtectedRoute>
        }
      />


      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
