import { useState } from 'react';
import { login } from '../services/api';

const BARS = [
  { label: 'Jan', v: 62 }, { label: 'Fev', v: 78 }, { label: 'Mar', v: 55 },
  { label: 'Abr', v: 91 }, { label: 'Mai', v: 74 }, { label: 'Jun', v: 88 },
  { label: 'Jul', v: 47 }, { label: 'Ago', v: 95 }, { label: 'Set', v: 83 },
  { label: 'Out', v: 70 }, { label: 'Nov', v: 61 }, { label: 'Dez', v: 79 },
];

const STATS = [
  { icon: '📋', label: 'Protocolos', value: '1.284' },
  { icon: '✅', label: 'Concluídos', value: '947'   },
  { icon: '⏱️', label: 'Prazo Médio', value: '4,2d'  },
  { icon: '👥', label: 'Usuários',    value: '18'    },
];

function Login({ onLogin }) {
  const [email, setEmail]           = useState('');
  const [senha, setSenha]           = useState('');
  const [erro, setErro]             = useState('');
  const [carregando, setCarregando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro(''); setCarregando(true);
    try {
      const r = await login(email, senha);
      onLogin(r.token, r.usuario);
    } catch (err) {
      setErro(err.message || 'Credenciais inválidas');
    } finally { setCarregando(false); }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .login-root {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', system-ui, sans-serif;
          background: #0f172a;
        }

        /* ── Lado esquerdo ── */
        .login-left {
          flex: 1;
          background: linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f1a2e 100%);
          padding: 3rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          position: relative;
          overflow: hidden;
        }
        .login-left::before {
          content: '';
          position: absolute;
          width: 600px; height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%);
          top: -200px; right: -200px;
          pointer-events: none;
        }
        .login-left::after {
          content: '';
          position: absolute;
          width: 400px; height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%);
          bottom: -100px; left: -100px;
          pointer-events: none;
        }

        .login-brand {
          display: flex;
          align-items: center;
          gap: 0.875rem;
          position: relative;
          z-index: 1;
        }
        .login-brand-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.3rem;
          box-shadow: 0 4px 20px rgba(99,102,241,0.4);
        }
        .login-brand-name {
          font-size: 1.1rem;
          font-weight: 700;
          color: #f1f5f9;
          letter-spacing: -0.3px;
        }
        .login-brand-sub {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 500;
          margin-top: 1px;
        }

        /* Headline */
        .login-headline {
          position: relative;
          z-index: 1;
        }
        .login-headline h2 {
          font-size: 2.4rem;
          font-weight: 800;
          color: #f1f5f9;
          line-height: 1.15;
          letter-spacing: -1px;
          margin-bottom: 0.875rem;
        }
        .login-headline h2 span {
          background: linear-gradient(135deg, #6366f1, #818cf8);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .login-headline p {
          color: #64748b;
          font-size: 0.95rem;
          line-height: 1.65;
          max-width: 400px;
        }

        /* Stats */
        .login-stats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.875rem;
          position: relative;
          z-index: 1;
        }
        .login-stat-card {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 14px;
          padding: 1rem 1.25rem;
          backdrop-filter: blur(8px);
          transition: background 0.2s;
        }
        .login-stat-card:hover { background: rgba(255,255,255,0.07); }
        .login-stat-icon { font-size: 1.3rem; margin-bottom: 0.5rem; }
        .login-stat-value {
          font-size: 1.6rem;
          font-weight: 800;
          color: #f1f5f9;
          letter-spacing: -0.5px;
          line-height: 1;
        }
        .login-stat-label {
          font-size: 0.72rem;
          color: #64748b;
          font-weight: 500;
          margin-top: 0.25rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* Gráfico de barras */
        .login-chart-wrap {
          position: relative;
          z-index: 1;
        }
        .login-chart-title {
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.6px;
          margin-bottom: 0.875rem;
        }
        .login-chart {
          display: flex;
          align-items: flex-end;
          gap: 5px;
          height: 72px;
        }
        .login-bar-wrap {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          height: 100%;
          justify-content: flex-end;
        }
        .login-bar {
          width: 100%;
          border-radius: 4px 4px 0 0;
          background: linear-gradient(180deg, #6366f1, #4338ca);
          transition: opacity 0.2s;
          min-height: 4px;
        }
        .login-bar.active { background: linear-gradient(180deg, #818cf8, #6366f1); }
        .login-bar-lbl {
          font-size: 0.6rem;
          color: #475569;
          font-weight: 500;
        }

        /* ── Lado direito ── */
        .login-right {
          width: 440px;
          flex-shrink: 0;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 3rem 2.75rem;
          position: relative;
        }
        .login-right::before {
          content: '';
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 1px;
          background: linear-gradient(180deg, transparent, rgba(99,102,241,0.15) 40%, rgba(99,102,241,0.15) 60%, transparent);
        }

        .login-form-wrap {
          width: 100%;
          max-width: 340px;
          animation: fadeInUp 0.5s cubic-bezier(0.22,1,0.36,1) both;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .login-form-icon {
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          font-size: 1.6rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 8px 24px rgba(99,102,241,0.35);
        }
        .login-form-title {
          font-size: 1.6rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
          margin-bottom: 0.4rem;
        }
        .login-form-sub {
          font-size: 0.875rem;
          color: #64748b;
          margin-bottom: 2rem;
        }

        .login-field-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.4rem;
        }
        .login-field-wrap {
          position: relative;
          margin-bottom: 1.1rem;
        }
        .login-field-wrap input {
          width: 100%;
          padding: 0.8rem 1rem;
          border: 1.5px solid #e2e8f0;
          border-radius: 10px;
          font-size: 0.9rem;
          font-family: 'Inter', sans-serif;
          color: #0f172a;
          outline: none;
          background: #fafafa;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .login-field-wrap input::placeholder { color: #94a3b8; }
        .login-field-wrap input:focus {
          border-color: #6366f1;
          background: #fff;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .login-alert {
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 8px;
          padding: 0.7rem 0.9rem;
          color: #dc2626;
          font-size: 0.84rem;
          margin-bottom: 1.1rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .login-submit {
          width: 100%;
          padding: 0.875rem;
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff;
          border: none;
          border-radius: 10px;
          font-family: 'Inter', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          letter-spacing: 0.3px;
          box-shadow: 0 4px 16px rgba(99,102,241,0.4);
          transition: all 0.2s;
          margin-top: 0.5rem;
        }
        .login-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(99,102,241,0.5);
        }
        .login-submit:active:not(:disabled) { transform: translateY(0); }
        .login-submit:disabled { opacity: 0.6; cursor: not-allowed; }

        .login-footer {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.72rem;
          color: #94a3b8;
          line-height: 1.6;
        }

        @media (max-width: 860px) {
          .login-left { display: none; }
          .login-right { width: 100%; }
        }
      `}</style>

      <div className="login-root">

        {/* ── Painel esquerdo ── */}
        <div className="login-left">

          <div className="login-brand">
            <div className="login-brand-icon">📋</div>
            <div>
              <div className="login-brand-name">Sistema Cartorial</div>
              <div className="login-brand-sub">Gestão de Produtividade</div>
            </div>
          </div>

          <div className="login-headline">
            <h2>Controle total<br/>do seu <span>cartório</span></h2>
            <p>Gerencie protocolos, prazos, produtividade da equipe e muito mais em uma única plataforma.</p>
          </div>

          <div className="login-stats">
            {STATS.map(s => (
              <div key={s.label} className="login-stat-card">
                <div className="login-stat-icon">{s.icon}</div>
                <div className="login-stat-value">{s.value}</div>
                <div className="login-stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="login-chart-wrap">
            <div className="login-chart-title">Protocolos por mês</div>
            <div className="login-chart">
              {BARS.map((b, i) => (
                <div key={b.label} className="login-bar-wrap">
                  <div
                    className={`login-bar${i === 7 ? ' active' : ''}`}
                    style={{ height: `${b.v}%`, opacity: 0.5 + (b.v / 200) }}
                  />
                  <span className="login-bar-lbl">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Painel direito (formulário) ── */}
        <div className="login-right">
          <div className="login-form-wrap">

            <div className="login-form-icon">📋</div>
            <div className="login-form-title">Bem-vindo Aguia 5.0</div>
            <div className="login-form-sub">Faça login para continuar</div>

            {erro && (
              <div className="login-alert">
                ⚠️ {erro}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <label className="login-field-label" htmlFor="email">E-mail</label>
              <div className="login-field-wrap">
                <input
                  type="email" id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required autoFocus
                />
              </div>

              <label className="login-field-label" htmlFor="senha">Senha</label>
              <div className="login-field-wrap">
                <input
                  type="password" id="senha"
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <button className="login-submit" type="submit" disabled={carregando}>
                {carregando ? 'Entrando...' : 'Entrar →'}
              </button>
            </form>

            <div className="login-footer">
              <strong style={{ color: '#475569' }}>Versão 1.0</strong> · Sistema de Gestão Cartorial<br/>
              Desenvolvedor: Michael Oliveira
            </div>
          </div>
        </div>

      </div>
    </>
  );
}

export default Login;
