import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Sidebar from '@common/SideBar'
import Upload from './pages/Upload'
import CRM from './pages/CRM'
import './App.css'

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Upload />} />
            <Route path="/crm" element={<CRM />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
