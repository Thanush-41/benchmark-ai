import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import './App.css'
import Dashboard from './pages/Dashboard'
import Evaluation from './pages/Evaluation'
import Upload from './pages/Upload'

function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Benchmark AI</p>
            <h1>LLM evaluation studio</h1>
          </div>
          <nav className="nav-links">
            <NavLink to="/">Dashboard</NavLink>
            <NavLink to="/upload">Upload</NavLink>
          </nav>
        </header>

        <main className="page-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/evaluations/:id" element={<Evaluation />} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}

export default App
