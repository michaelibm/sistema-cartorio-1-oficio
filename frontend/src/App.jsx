import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Protocolos from './pages/Protocolos';
import Servicos from './pages/Servicos';
import Funcionarios from './pages/Funcionarios';
import Relatorios from './pages/Relatorios';
import Configuracoes from './pages/Configuracoes';
import Painel from './pages/Painel';

import Sidebar from './components/Sidebar';
import './styles/App.css';

function App() {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const usuarioSalvo = localStorage.getItem('usuario');

    if (token && usuarioSalvo) {
      try {
        setUsuario(JSON.parse(usuarioSalvo));
      } catch {
        localStorage.removeItem('usuario');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const handleLogin = (token, usuarioData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('usuario', JSON.stringify(usuarioData));
    setUsuario(usuarioData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setUsuario(null);
  };

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  // Rota pública - sem login
  if (window.location.pathname === '/painel') {
    return (
      <Router>
        <Routes>
          <Route path="/painel" element={<Painel />} />
        </Routes>
      </Router>
    );
  }

  if (!usuario) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="app">
        <Sidebar 
          usuario={usuario} 
          onLogout={handleLogout}
          onToggle={setSidebarCollapsed}
        />
        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Routes>
            <Route path="/" element={<Dashboard usuario={usuario} />} />
            <Route path="/protocolos" element={<Protocolos usuario={usuario} />} />
            <Route path="/servicos" element={<Servicos usuario={usuario} />} />
            <Route path="/funcionarios" element={<Funcionarios usuario={usuario} />} />
            <Route path="/relatorios" element={<Relatorios usuario={usuario} />} />
            <Route path="/configuracoes" element={<Configuracoes usuario={usuario} />} />
            <Route path="/painel" element={<Painel />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
