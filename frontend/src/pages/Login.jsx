import React, { useState, useEffect } from 'react';
import { login } from '../services/api';
import '../styles/Login.css';
import logo from '../styles/img/logo.png';

// Homenagem ao Mês das Mulheres — ativa permanentemente
const IS_WOMENS_MONTH = true;

// Pétalas flutuantes
const PETALS = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  left: `${Math.random() * 100}%`,
  delay: `${Math.random() * 8}s`,
  duration: `${6 + Math.random() * 6}s`,
  size: `${10 + Math.random() * 16}px`,
  opacity: 0.4 + Math.random() * 0.5,
  rotate: `${Math.random() * 360}deg`,
}));

function Petal({ left, delay, duration, size, opacity, rotate }) {
  return (
    <div style={{
      position: 'fixed',
      left,
      top: '-30px',
      width: size,
      height: size,
      opacity,
      animation: `petalFall ${duration} ${delay} infinite linear`,
      pointerEvents: 'none',
      zIndex: 0,
      transform: `rotate(${rotate})`,
      fontSize: size,
      userSelect: 'none',
    }}>
      🌸
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [showTribute, setShowTribute] = useState(IS_WOMENS_MONTH);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      const response = await login(email, senha);
      onLogin(response.token, response.usuario);
    } catch (error) {
      setErro(error.message || 'Erro ao fazer login');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=DM+Sans:wght@300;400;500&display=swap');

        @keyframes petalFall {
          0%   { transform: translateY(-30px) rotate(0deg) translateX(0); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 0.8; }
          100% { transform: translateY(110vh) rotate(720deg) translateX(40px); opacity: 0; }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmer {
          0%   { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(219, 39, 119, 0.15); }
          50%       { box-shadow: 0 0 0 12px rgba(219, 39, 119, 0); }
        }

        @keyframes ribbonSlide {
          from { transform: translateX(-100%); opacity: 0; }
          to   { transform: translateX(0); opacity: 1; }
        }

        .wm-login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
          background: linear-gradient(135deg, #1a0a14 0%, #2d0a22 40%, #1a0510 70%, #0d0a1a 100%);
        }

        .wm-bg-orbs {
          position: fixed; inset: 0; pointer-events: none; z-index: 0;
        }
        .wm-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
        }
        .wm-orb-1 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(219,39,119,0.18) 0%, transparent 70%);
          top: -100px; left: -100px;
        }
        .wm-orb-2 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%);
          bottom: -80px; right: -80px;
        }
        .wm-orb-3 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(167,139,250,0.1) 0%, transparent 70%);
          top: 40%; left: 60%;
        }

        .wm-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          margin: 1.5rem;
          animation: fadeSlideUp 0.7s ease both;
        }

        /* Faixa de homenagem */
        .wm-tribute {
          background: linear-gradient(135deg, #831843, #be185d, #db2777, #be185d, #831843);
          background-size: 200% auto;
          animation: shimmer 4s linear infinite, ribbonSlide 0.6s ease both;
          border-radius: 16px 16px 0 0;
          padding: 1.25rem 1.5rem;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .wm-tribute::before {
          content: '';
          position: absolute; inset: 0;
          background: repeating-linear-gradient(
            45deg,
            transparent,
            transparent 10px,
            rgba(255,255,255,0.03) 10px,
            rgba(255,255,255,0.03) 20px
          );
        }
        .wm-tribute-emoji {
          font-size: 1.5rem;
          display: block;
          margin-bottom: 0.25rem;
        }
        .wm-tribute-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.1rem;
          font-weight: 600;
          color: #fff;
          letter-spacing: 0.5px;
          margin: 0;
        }
        .wm-tribute-sub {
          font-size: 0.75rem;
          color: rgba(255,255,255,0.8);
          margin: 0.2rem 0 0;
          font-style: italic;
        }
        .wm-tribute-close {
          position: absolute;
          top: 0.5rem; right: 0.75rem;
          background: rgba(255,255,255,0.15);
          border: none;
          color: white;
          border-radius: 50%;
          width: 22px; height: 22px;
          font-size: 0.7rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: background 0.2s;
        }
        .wm-tribute-close:hover { background: rgba(255,255,255,0.3); }

        /* Card principal */
        .wm-main {
          background: rgba(255,255,255,0.04);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.08);
          border-top: none;
          border-radius: ${IS_WOMENS_MONTH ? '0 0 20px 20px' : '20px'};
          padding: 2rem 2rem 1.5rem;
        }
        .wm-main-solo {
          border-radius: 20px;
          border-top: 1px solid rgba(255,255,255,0.08);
        }

        .wm-logo-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 1.5rem;
          gap: 0.75rem;
        }
        .wm-logo {
          width: 64px; height: 64px;
          object-fit: contain;
          filter: drop-shadow(0 0 20px rgba(236,72,153,0.4));
          animation: pulseGlow 3s ease-in-out infinite;
          border-radius: 12px;
        }
        .wm-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.25rem;
          font-weight: 600;
          color: #f9fafb;
          text-align: center;
          margin: 0;
          line-height: 1.3;
        }
        .wm-subtitle {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.45);
          text-align: center;
          margin: 0.2rem 0 0;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }

        .wm-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(219,39,119,0.4), transparent);
          margin: 0 0 1.5rem;
        }

        .wm-field { margin-bottom: 1rem; }
        .wm-label {
          display: block;
          font-size: 0.75rem;
          font-weight: 500;
          color: rgba(255,255,255,0.5);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 0.4rem;
        }
        .wm-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 10px;
          padding: 0.75rem 1rem;
          color: #f9fafb;
          font-size: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.2s, background 0.2s;
        }
        .wm-input::placeholder { color: rgba(255,255,255,0.2); }
        .wm-input:focus {
          border-color: rgba(219,39,119,0.6);
          background: rgba(255,255,255,0.08);
        }

        .wm-alert {
          background: rgba(220,38,38,0.15);
          border: 1px solid rgba(220,38,38,0.3);
          border-radius: 8px;
          padding: 0.625rem 0.875rem;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .wm-btn {
          width: 100%;
          padding: 0.875rem;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: opacity 0.2s, transform 0.1s;
          background: linear-gradient(135deg, #9d174d, #db2777, #ec4899);
          color: white;
          letter-spacing: 0.3px;
        }
        .wm-btn:hover:not(:disabled) {
          opacity: 0.92;
          transform: translateY(-1px);
        }
        .wm-btn:active:not(:disabled) { transform: translateY(0); }
        .wm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .wm-footer {
          text-align: center;
          margin-top: 1.25rem;
          font-size: 0.72rem;
          color: rgba(255,255,255,0.25);
          line-height: 1.5;
        }
      `}</style>

      <div className="wm-login-container">
        {/* Orbs de fundo */}
        <div className="wm-bg-orbs">
          <div className="wm-orb wm-orb-1" />
          <div className="wm-orb wm-orb-2" />
          <div className="wm-orb wm-orb-3" />
        </div>

        {/* Pétalas flutuantes */}
        {IS_WOMENS_MONTH && PETALS.map(p => <Petal key={p.id} {...p} />)}

        <div className="wm-card">
          {/* Faixa homenagem */}
          {showTribute && (
            <div className="wm-tribute">
              <span className="wm-tribute-emoji">🌸 💜 🌺</span>
              <p className="wm-tribute-title">Feliz Mês das Mulheres</p>
              <p className="wm-tribute-sub">
                Em homenagem a todas as mulheres incríveis do nosso cartório
              </p>
              <button className="wm-tribute-close" onClick={() => setShowTribute(false)} title="Fechar">✕</button>
            </div>
          )}

          {/* Card do formulário */}
          <div className={`wm-main ${!showTribute ? 'wm-main-solo' : ''}`}>
            <div className="wm-logo-wrap">
              <img src={logo} alt="Logo Cartório" className="wm-logo" />
              <div>
                <h1 className="wm-title">Cartório 1º Ofício — AM</h1>
                <p className="wm-subtitle">Sistema de Produtividade</p>
              </div>
            </div>

            <div className="wm-divider" />

            {erro && <div className="wm-alert">⚠️ {erro}</div>}

            <form onSubmit={handleSubmit}>
              <div className="wm-field">
                <label className="wm-label" htmlFor="email">E-mail</label>
                <input
                  className="wm-input"
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  autoFocus
                />
              </div>

              <div className="wm-field">
                <label className="wm-label" htmlFor="senha">Senha</label>
                <input
                  className="wm-input"
                  type="password"
                  id="senha"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button className="wm-btn" type="submit" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="wm-footer">
              <p><strong>Versão 1.0</strong> · Cartório 1º Ofício de Imóveis de Manaus<br />
              Desenvolvedor: Michael Oliveira</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
