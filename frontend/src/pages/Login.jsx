import { useState } from 'react';
import { login } from '../services/api';
import '../styles/Login.css';
import logo from '../styles/img/logo.png';

const PETALS = Array.from({ length: 22 }, (_, i) => ({
  id: i,
  left:     `${Math.random() * 100}%`,
  delay:    `${Math.random() * 10}s`,
  duration: `${7 + Math.random() * 7}s`,
  size:     `${14 + Math.random() * 18}px`,
  opacity:  0.5 + Math.random() * 0.4,
  swing:    `${20 + Math.random() * 40}px`,
  emoji:    ['🌹','🌸','🌺','💐','🪷'][Math.floor(Math.random() * 5)],
}));

function Petal({ left, delay, duration, size, opacity, swing, emoji }) {
  return (
    <div style={{
      position: 'fixed', left, top: '-40px',
      fontSize: size, opacity,
      animation: `petalFall ${duration} ${delay} infinite ease-in-out`,
      pointerEvents: 'none', zIndex: 0, userSelect: 'none',
      '--swing': swing,
    }}>
      {emoji}
    </div>
  );
}

function Login({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [senha, setSenha]       = useState('');
  const [erro, setErro]         = useState('');
  const [carregando, setCarregando] = useState(false);
  const [fechou, setFechou]     = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const r = await login(email, senha);
      onLogin(r.token, r.usuario);
    } catch (err) {
      setErro(err.message || 'Erro ao fazer login');
    } finally { setCarregando(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&family=DM+Sans:wght@300;400;500;600&display=swap');

        * { box-sizing: border-box; }

        @keyframes petalFall {
          0%   { transform: translateY(-40px) translateX(0) rotate(0deg);   opacity: 0; }
          10%  { opacity: 1; }
          50%  { transform: translateY(45vh)  translateX(var(--swing, 30px)) rotate(180deg); }
          90%  { opacity: 0.7; }
          100% { transform: translateY(105vh) translateX(0) rotate(360deg); opacity: 0; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(32px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @keyframes shimmerGold {
          0%   { background-position: -300% center; }
          100% { background-position: 300% center; }
        }

        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,167,100,0.2), 0 0 30px rgba(180,60,90,0.15); }
          50%       { box-shadow: 0 0 0 14px rgba(212,167,100,0), 0 0 50px rgba(180,60,90,0.25); }
        }

        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          15%       { transform: scale(1.15); }
          30%       { transform: scale(1); }
          45%       { transform: scale(1.08); }
        }

        @keyframes ribbonIn {
          from { transform: translateY(-20px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }

        @keyframes orbFloat {
          0%, 100% { transform: translateY(0) scale(1); }
          50%       { transform: translateY(-30px) scale(1.05); }
        }

        .dm-login-wrap {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'DM Sans', sans-serif;
          background:
            radial-gradient(ellipse at 20% 20%, rgba(180,50,80,0.35) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 80%, rgba(140,40,70,0.28) 0%, transparent 55%),
            radial-gradient(ellipse at 50% 50%, rgba(100,20,45,0.4) 0%, transparent 70%),
            linear-gradient(160deg, #1c0610 0%, #3a0e22 35%, #240910 65%, #120408 100%);
        }

        /* Orbs decorativos */
        .dm-orb {
          position: fixed;
          border-radius: 50%;
          pointer-events: none;
          z-index: 0;
          filter: blur(90px);
        }
        .dm-orb-1 {
          width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(212,100,130,0.22) 0%, transparent 70%);
          top: -150px; left: -150px;
          animation: orbFloat 8s ease-in-out infinite;
        }
        .dm-orb-2 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(212,167,100,0.15) 0%, transparent 70%);
          bottom: -100px; right: -100px;
          animation: orbFloat 10s ease-in-out infinite reverse;
        }
        .dm-orb-3 {
          width: 280px; height: 280px;
          background: radial-gradient(circle, rgba(236,100,140,0.12) 0%, transparent 70%);
          top: 45%; left: 65%;
          animation: orbFloat 7s ease-in-out infinite 2s;
        }

        /* Linha dourada decorativa */
        .dm-gold-line {
          position: fixed;
          top: 0; bottom: 0;
          left: 50%;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(212,167,100,0.08) 30%, rgba(212,167,100,0.12) 50%, rgba(212,167,100,0.08) 70%, transparent);
          pointer-events: none;
          z-index: 0;
        }

        .dm-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 430px;
          margin: 1.5rem;
          animation: fadeUp 0.75s cubic-bezier(0.22,1,0.36,1) both;
        }

        /* Banner homenagem */
        .dm-banner {
          border-radius: 20px 20px 0 0;
          padding: 1.5rem 1.75rem 1.25rem;
          text-align: center;
          position: relative;
          overflow: hidden;
          animation: ribbonIn 0.6s 0.3s ease both;
          background: linear-gradient(
            135deg,
            #6b1530 0%, #9b2345 20%, #c4375a 40%,
            #d4876a 50%, #c4375a 60%, #9b2345 80%, #6b1530 100%
          );
          background-size: 300% auto;
          animation: ribbonIn 0.6s 0.3s ease both, shimmerGold 6s linear infinite;
          border-bottom: 1px solid rgba(212,167,100,0.3);
        }
        .dm-banner::before {
          content: '';
          position: absolute; inset: 0;
          background:
            repeating-linear-gradient(
              45deg,
              transparent, transparent 12px,
              rgba(255,255,255,0.025) 12px,
              rgba(255,255,255,0.025) 24px
            );
        }
        .dm-banner::after {
          content: '';
          position: absolute;
          bottom: 0; left: 10%; right: 10%; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,167,100,0.6), transparent);
        }

        .dm-heart {
          font-size: 2rem;
          display: block;
          margin-bottom: 0.4rem;
          animation: heartbeat 2s ease-in-out infinite;
          filter: drop-shadow(0 2px 12px rgba(255,100,120,0.5));
        }
        .dm-banner-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.45rem;
          font-weight: 700;
          font-style: italic;
          color: #fff;
          margin: 0 0 0.3rem;
          text-shadow: 0 2px 12px rgba(0,0,0,0.4);
          letter-spacing: 0.5px;
        }
        .dm-banner-quote {
          font-size: 0.8rem;
          color: rgba(255,255,255,0.85);
          margin: 0;
          font-style: italic;
          line-height: 1.5;
          letter-spacing: 0.2px;
        }
        .dm-banner-flowers {
          font-size: 1.1rem;
          margin-top: 0.6rem;
          display: block;
          letter-spacing: 0.3rem;
          filter: drop-shadow(0 2px 6px rgba(255,180,180,0.4));
        }
        .dm-banner-close {
          position: absolute;
          top: 0.6rem; right: 0.75rem;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          color: rgba(255,255,255,0.7);
          border-radius: 50%;
          width: 24px; height: 24px;
          font-size: 0.65rem;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.2s;
        }
        .dm-banner-close:hover {
          background: rgba(255,255,255,0.25);
          color: white;
        }

        /* Card formulário */
        .dm-form-card {
          background: rgba(255,255,255,0.035);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border: 1px solid rgba(255,255,255,0.07);
          border-top: none;
          border-radius: 0 0 22px 22px;
          padding: 2rem 2rem 1.5rem;
        }
        .dm-form-card.solo {
          border-radius: 22px;
          border-top: 1px solid rgba(255,255,255,0.07);
        }

        .dm-logo-area {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.875rem;
          margin-bottom: 1.5rem;
        }
        .dm-logo {
          width: 68px; height: 68px;
          object-fit: contain;
          border-radius: 16px;
          padding: 6px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(212,167,100,0.2);
          animation: glowPulse 4s ease-in-out infinite;
        }
        .dm-logo-title {
          font-family: 'Playfair Display', serif;
          font-size: 1.2rem;
          font-weight: 600;
          color: #f5e6d3;
          text-align: center;
          margin: 0;
          line-height: 1.3;
        }
        .dm-logo-sub {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.35);
          text-align: center;
          margin: 0.15rem 0 0;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .dm-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(212,167,100,0.35), transparent);
          margin: 0 0 1.5rem;
        }

        .dm-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 600;
          color: rgba(245,230,211,0.45);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.4rem;
        }
        .dm-input {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          padding: 0.8rem 1rem;
          color: #f5e6d3;
          font-size: 0.9rem;
          font-family: 'DM Sans', sans-serif;
          outline: none;
          transition: border-color 0.25s, background 0.25s, box-shadow 0.25s;
          margin-bottom: 1rem;
        }
        .dm-input::placeholder { color: rgba(255,255,255,0.18); }
        .dm-input:focus {
          border-color: rgba(212,167,100,0.5);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 0 0 3px rgba(212,167,100,0.08);
        }

        .dm-alert {
          background: rgba(220,38,38,0.12);
          border: 1px solid rgba(220,38,38,0.25);
          border-radius: 8px;
          padding: 0.625rem 0.875rem;
          color: #fca5a5;
          font-size: 0.85rem;
          margin-bottom: 1rem;
        }

        .dm-btn {
          width: 100%;
          padding: 0.9rem;
          border: none;
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 0.25rem;
          letter-spacing: 0.5px;
          transition: all 0.25s;
          position: relative;
          overflow: hidden;
          background: linear-gradient(
            135deg,
            #7c1a35 0%, #b03050 30%, #c84060 50%, #d4876a 70%, #b03050 85%, #7c1a35 100%
          );
          background-size: 250% auto;
          color: #fff5ee;
          text-shadow: 0 1px 3px rgba(0,0,0,0.3);
          box-shadow: 0 4px 20px rgba(180,50,80,0.35), 0 1px 0 rgba(255,255,255,0.1) inset;
          animation: shimmerGold 5s linear infinite;
        }
        .dm-btn:hover:not(:disabled) {
          background-size: 180% auto;
          box-shadow: 0 6px 28px rgba(180,50,80,0.5), 0 1px 0 rgba(255,255,255,0.15) inset;
          transform: translateY(-2px);
        }
        .dm-btn:active:not(:disabled) { transform: translateY(0); }
        .dm-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .dm-footer {
          text-align: center;
          margin-top: 1.5rem;
          font-size: 0.7rem;
          color: rgba(255,255,255,0.2);
          line-height: 1.6;
        }
        .dm-footer strong { color: rgba(212,167,100,0.5); }
      `}</style>

      <div className="dm-login-wrap">
        <div className="dm-orb dm-orb-1"/>
        <div className="dm-orb dm-orb-2"/>
        <div className="dm-orb dm-orb-3"/>
        <div className="dm-gold-line"/>

        {/* Pétalas flutuantes */}
        {PETALS.map(p => <Petal key={p.id} {...p}/>)}

        <div className="dm-card">

          {/* Banner Dia das Mães */}
          {!fechou && (
            <div className="dm-banner">
              <button className="dm-banner-close" onClick={() => setFechou(true)} title="Fechar">✕</button>
              <span className="dm-heart">💝</span>
              <p className="dm-banner-title">Feliz Dia das Mães!</p>
              <p className="dm-banner-quote">
                "O amor de mãe é o único amor que antecede o nascimento<br/>
                e nunca deixa de existir."
              </p>
              <span className="dm-banner-flowers">🌹 🌸 🪷 🌸 🌹</span>
            </div>
          )}

          {/* Card do formulário */}
          <div className={`dm-form-card${fechou ? ' solo' : ''}`}>
            <div className="dm-logo-area">
              <img src={logo} alt="Logo Cartório" className="dm-logo"/>
              <div>
                <h1 className="dm-logo-title">Cartório 1º Ofício — AM</h1>
                <p className="dm-logo-sub">Sistema de Produtividade</p>
              </div>
            </div>

            <div className="dm-divider"/>

            {erro && <div className="dm-alert">⚠️ {erro}</div>}

            <form onSubmit={handleSubmit}>
              <label className="dm-label" htmlFor="email">E-mail</label>
              <input
                className="dm-input" type="email" id="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com" required autoFocus
              />
              <label className="dm-label" htmlFor="senha">Senha</label>
              <input
                className="dm-input" type="password" id="senha"
                value={senha} onChange={e => setSenha(e.target.value)}
                placeholder="••••••••" required
              />
              <button className="dm-btn" type="submit" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <div className="dm-footer">
              <strong>Versão 1.0</strong> · Cartório 1º Ofício de Imóveis de Manaus<br/>
              Desenvolvedor: Michael Oliveira
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
