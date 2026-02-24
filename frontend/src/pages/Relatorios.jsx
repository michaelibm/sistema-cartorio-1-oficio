import React, { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../services/api';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });

async function apiFetch(path) {
  const r = await fetch(`${API_URL}/relatorios${path}`, { headers: authH() });
  if (!r.ok) throw new Error('Erro ao carregar dados');
  return r.json();
}

const fmt = (n) => (n ?? 0).toLocaleString('pt-BR');
const fmtPct = (n) => `${n ?? 0}%`;

// ─── Mini Barra horizontal ────────────────────────────────────────────────────
function BarraHorizontal({ valor, max, cor = '#3b82f6' }) {
  const pct = max > 0 ? (valor / max) * 100 : 0;
  return (
    <div style={{ background: '#f1f5f9', borderRadius: 99, height: 8, width: '100%' }}>
      <div style={{ background: cor, width: `${pct}%`, height: '100%', borderRadius: 99, transition: 'width 0.6s ease' }} />
    </div>
  );
}

// ─── Gráfico de barras simples (SVG) ─────────────────────────────────────────
function GraficoBarras({ dados, labelKey, valueKey, cor = '#3b82f6', altura = 180 }) {
  if (!dados?.length) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Sem dados</p>;
  const max = Math.max(...dados.map(d => d[valueKey])) || 1;
  const w = 100 / dados.length;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: altura, padding: '0 8px' }}>
      {dados.map((d, i) => {
        const h = (d[valueKey] / max) * (altura - 30);
        return (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 10, color: '#64748b', fontWeight: 600 }}>{d[valueKey] || ''}</span>
            <div
              title={`${d[labelKey]}: ${d[valueKey]}`}
              style={{ width: '100%', height: h || 2, background: cor, borderRadius: '4px 4px 0 0', transition: 'height 0.5s ease', cursor: 'default' }}
            />
            <span style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
              {typeof d[labelKey] === 'string' ? d[labelKey].split(' ')[0] : d[labelKey]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Gráfico de linha (SVG) ───────────────────────────────────────────────────
function GraficoLinha({ dados, labelKey, valueKey, cor = '#3b82f6', altura = 160 }) {
  if (!dados?.length) return <p style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>Sem dados</p>;
  const max = Math.max(...dados.map(d => d[valueKey])) || 1;
  const min = 0;
  const W = 600, H = altura;
  const pad = { top: 20, right: 20, bottom: 30, left: 30 };
  const w = W - pad.left - pad.right;
  const h = H - pad.top - pad.bottom;
  const points = dados.map((d, i) => {
    const x = pad.left + (i / (dados.length - 1 || 1)) * w;
    const y = pad.top + (1 - (d[valueKey] - min) / (max - min)) * h;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: altura }}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((v, i) => (
        <line key={i} x1={pad.left} x2={W - pad.right} y1={pad.top + v * h} y2={pad.top + v * h}
          stroke="#e2e8f0" strokeWidth={1} />
      ))}
      {/* Área */}
      <polygon
        points={`${pad.left},${pad.top + h} ${points} ${W - pad.right},${pad.top + h}`}
        fill={cor} fillOpacity={0.1}
      />
      {/* Linha */}
      <polyline points={points} fill="none" stroke={cor} strokeWidth={2.5} strokeLinejoin="round" />
      {/* Pontos */}
      {dados.map((d, i) => {
        const x = pad.left + (i / (dados.length - 1 || 1)) * w;
        const y = pad.top + (1 - (d[valueKey] - min) / (max - min)) * h;
        return (
          <circle key={i} cx={x} cy={y} r={3} fill={cor} stroke="white" strokeWidth={1.5}>
            <title>{`${d[labelKey]}: ${d[valueKey]}`}</title>
          </circle>
        );
      })}
      {/* Labels eixo X (a cada N) */}
      {dados.filter((_, i) => i % Math.ceil(dados.length / 6) === 0 || i === dados.length - 1).map((d, idx, arr) => {
        const origIdx = dados.indexOf(d);
        const x = pad.left + (origIdx / (dados.length - 1 || 1)) * w;
        return (
          <text key={idx} x={x} y={H - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">
            {String(d[labelKey]).slice(-5)}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Card KPI ─────────────────────────────────────────────────────────────────
function KpiCard({ label, valor, sub, cor = '#3b82f6', icone }) {
  return (
    <div style={{ background: 'white', borderRadius: 12, padding: '1.25rem', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', borderLeft: `4px solid ${cor}` }}>
      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {icone} {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#1e293b', lineHeight: 1.1 }}>{valor}</div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ─── Seção com título ─────────────────────────────────────────────────────────
function Secao({ titulo, children, acao }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: '1.5rem', overflow: 'hidden' }}>
      <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>{titulo}</h3>
        {acao}
      </div>
      <div style={{ padding: '1.25rem 1.5rem' }}>{children}</div>
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, cor = '#3b82f6' }) {
  const cores = {
    verde: { bg: '#d1fae5', text: '#065f46' },
    amarelo: { bg: '#fef3c7', text: '#92400e' },
    vermelho: { bg: '#fee2e2', text: '#991b1b' },
    azul: { bg: '#dbeafe', text: '#1e40af' },
    cinza: { bg: '#f1f5f9', text: '#475569' },
  };
  const c = cores[cor] || cores.azul;
  return (
    <span style={{ background: c.bg, color: c.text, padding: '0.2rem 0.6rem', borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
      {children}
    </span>
  );
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
function Relatorios({ usuario }) {
  const [aba, setAba] = useState('executivo');
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // Dados
  const [kpis, setKpis] = useState(null);
  const [geral, setGeral] = useState(null);
  const [ranking, setRanking] = useState([]);
  const [producaoDiaria, setProducaoDiaria] = useState([]);
  const [tendenciaMensal, setTendenciaMensal] = useState([]);
  const [produtividade, setProdutividade] = useState([]);
  const [porServico, setPorServico] = useState([]);

  // Filtros
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const [k, g, r, pd, tm, pr, ps] = await Promise.all([
        apiFetch('/kpis'),
        apiFetch('/geral'),
        apiFetch('/ranking'),
        apiFetch('/producao-diaria'),
        apiFetch('/tendencia-mensal'),
        apiFetch(`/produtividade?data_inicio=${dataInicio}&data_fim=${dataFim}`),
        apiFetch('/por-servico'),
      ]);
      setKpis(k);
      setGeral(g);
      setRanking(Array.isArray(r) ? r : []);
      setProducaoDiaria(Array.isArray(pd) ? pd : []);
      setTendenciaMensal(Array.isArray(tm) ? tm : []);
      setProdutividade(Array.isArray(pr) ? pr : []);
      setPorServico(Array.isArray(ps) ? ps : []);
    } catch (e) {
      setErro('Erro ao carregar relatórios. Verifique a conexão.');
    } finally {
      setLoading(false);
    }
  }, [dataInicio, dataFim]);

  useEffect(() => { carregar(); }, [carregar]);

  const abas = [
    { id: 'executivo', label: '📊 Executivo', roles: ['Supervisor', 'Coordenador'] },
    { id: 'produtividade', label: '👥 Produtividade', roles: ['Supervisor', 'Coordenador'] },
    { id: 'tendencia', label: '📈 Tendência', roles: ['Supervisor', 'Coordenador'] },
    { id: 'servicos', label: '⚙️ Serviços', roles: ['Supervisor', 'Coordenador'] },
  ].filter(a => a.roles.includes(usuario?.cargo));

  const maxRanking = ranking.length > 0 ? Math.max(...ranking.map(r => r.concluidos)) : 1;
  const maxProdutividade = produtividade.length > 0 ? Math.max(...produtividade.map(p => p.total_criados)) : 1;

  const corCargo = (cargo) => {
    if (cargo === 'Supervisor') return 'azul';
    if (cargo === 'Coordenador') return 'verde';
    return 'cinza';
  };

  return (
    <div style={{ padding: '2rem', background: '#f8fafc', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>📈 Relatórios</h1>
        <p style={{ color: '#64748b', margin: '0.25rem 0 0' }}>Dashboards de produtividade e desempenho</p>
      </div>

      {/* Filtro de datas */}
      <div style={{ background: 'white', borderRadius: 12, padding: '1rem 1.5rem', marginBottom: '1.5rem', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Data início</label>
          <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Data fim</label>
          <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14 }} />
        </div>
        <button onClick={carregar} disabled={loading}
          style={{ padding: '0.5rem 1.25rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
          {loading ? '⟳' : '🔍 Filtrar'}
        </button>
      </div>

      {erro && <div style={{ background: '#fef2f2', color: '#991b1b', padding: '1rem', borderRadius: 10, marginBottom: '1rem', border: '1px solid #fee2e2' }}>⚠️ {erro}</div>}

      {/* Abas */}
      <div style={{ display: 'flex', gap: 4, marginBottom: '1.5rem', background: 'white', padding: '0.375rem', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', width: 'fit-content' }}>
        {abas.map(a => (
          <button key={a.id} onClick={() => setAba(a.id)}
            style={{ padding: '0.5rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, background: aba === a.id ? '#3b82f6' : 'transparent', color: aba === a.id ? 'white' : '#64748b', transition: 'all 0.2s' }}>
            {a.label}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⟳</div>
          Carregando dados...
        </div>
      )}

      {!loading && (
        <>
          {/* ── ABA EXECUTIVO ── */}
          {aba === 'executivo' && (
            <>
              {/* KPIs */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <KpiCard label="Criados hoje" valor={fmt(kpis?.criados_hoje)} cor="#3b82f6" icone="📥" />
                <KpiCard label="Criados na semana" valor={fmt(kpis?.criados_semana)} cor="#8b5cf6" icone="📅" />
                <KpiCard label="Criados no mês" valor={fmt(kpis?.criados_mes)} cor="#06b6d4" icone="📆" />
                <KpiCard label="Concluídos hoje" valor={fmt(kpis?.concluidos_hoje)} cor="#10b981" icone="✅" />
                <KpiCard label="Concluídos no mês" valor={fmt(kpis?.concluidos_mes)} cor="#059669" icone="🏆" />
                <KpiCard label="Em andamento" valor={fmt(kpis?.em_andamento)} cor="#f59e0b" icone="⏳" />
                <KpiCard label="Atrasados" valor={fmt(kpis?.atrasados)} cor="#ef4444" icone="🚨" sub="Precisam de atenção" />
                <KpiCard label="Média/funcionário" valor={fmt(kpis?.media_por_funcionario)} cor="#64748b" icone="👤" sub="No mês atual" />
              </div>

              {/* Produção diária */}
              <Secao titulo="📈 Produção Diária — Últimos 30 dias">
                <GraficoLinha dados={producaoDiaria} labelKey="dia" valueKey="criados" cor="#3b82f6" altura={180} />
              </Secao>

              {/* Ranking do mês */}
              <Secao titulo="🏆 Ranking do Mês">
                {ranking.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#94a3b8' }}>Sem dados no período</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {ranking.map((f, i) => (
                      <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontSize: 18, width: 28, textAlign: 'center' }}>
                          {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}º`}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                            <span style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{f.nome}</span>
                            <span style={{ fontWeight: 700, fontSize: 14, color: '#3b82f6' }}>{f.concluidos} concluídos</span>
                          </div>
                          <BarraHorizontal valor={f.concluidos} max={maxRanking} cor={i === 0 ? '#f59e0b' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : '#3b82f6'} />
                        </div>
                        <Badge cor={f.taxa_conclusao >= 80 ? 'verde' : f.taxa_conclusao >= 50 ? 'amarelo' : 'vermelho'}>
                          {f.taxa_conclusao}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Secao>
            </>
          )}

          {/* ── ABA PRODUTIVIDADE ── */}
          {aba === 'produtividade' && (
            <>
              {/* Gráfico barras por funcionário */}
              <Secao titulo="📊 Protocolos Criados por Funcionário">
                <GraficoBarras
                  dados={produtividade.filter(p => p.total_criados > 0)}
                  labelKey="nome" valueKey="total_criados" cor="#3b82f6" altura={200}
                />
              </Secao>

              {/* Tabela detalhada */}
              <Secao titulo="👥 Detalhamento por Funcionário">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Funcionário', 'Cargo', 'Setor', 'Criados', 'Concluídos', 'Em andamento', 'No prazo', 'Atrasados', 'Média/dia', 'Taxa'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', whiteSpace: 'nowrap', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {produtividade.map((f, i) => (
                        <tr key={f.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{f.nome}</td>
                          <td style={{ padding: '0.75rem 1rem' }}><Badge cor={corCargo(f.cargo)}>{f.cargo}</Badge></td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{f.setor || '-'}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#3b82f6' }}>{f.total_criados}</td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#10b981' }}>{f.total_concluidos}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#f59e0b' }}>{f.em_andamento}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#10b981' }}>{f.no_prazo}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#ef4444' }}>{f.atrasados}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{f.media_diaria}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {f.total_criados > 0 ? (
                              <Badge cor={f.total_concluidos / f.total_criados >= 0.8 ? 'verde' : f.total_concluidos / f.total_criados >= 0.5 ? 'amarelo' : 'vermelho'}>
                                {Math.round((f.total_concluidos / f.total_criados) * 100)}%
                              </Badge>
                            ) : <Badge cor="cinza">-</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Secao>
            </>
          )}

          {/* ── ABA TENDÊNCIA ── */}
          {aba === 'tendencia' && (
            <>
              <Secao titulo="📆 Tendência Mensal — Últimos 6 meses">
                <GraficoLinha dados={tendenciaMensal} labelKey="mes_label" valueKey="criados" cor="#8b5cf6" altura={200} />
              </Secao>

              <Secao titulo="📋 Detalhes por Mês">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Mês', 'Criados', 'Concluídos', 'Atrasados ativos', 'Taxa conclusão'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tendenciaMensal.map((m, i) => {
                        const taxa = m.criados > 0 ? Math.round((m.concluidos / m.criados) * 100) : 0;
                        return (
                          <tr key={m.mes} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                            <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1e293b' }}>{m.mes_label}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#3b82f6', fontWeight: 700 }}>{m.criados}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 700 }}>{m.concluidos}</td>
                            <td style={{ padding: '0.75rem 1rem', color: '#ef4444' }}>{m.atrasados}</td>
                            <td style={{ padding: '0.75rem 1rem' }}>
                              <Badge cor={taxa >= 80 ? 'verde' : taxa >= 50 ? 'amarelo' : 'vermelho'}>{taxa}%</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Secao>

              <Secao titulo="📅 Produção Diária — Últimos 30 dias">
                <GraficoBarras dados={producaoDiaria} labelKey="dia" valueKey="criados" cor="#06b6d4" altura={180} />
              </Secao>
            </>
          )}

          {/* ── ABA SERVIÇOS ── */}
          {aba === 'servicos' && (
            <>
              <Secao titulo="⚙️ Desempenho por Tipo de Serviço">
                <GraficoBarras
                  dados={porServico.filter(s => s.total_protocolos > 0)}
                  labelKey="nome" valueKey="total_protocolos" cor="#10b981" altura={200}
                />
              </Secao>

              <Secao titulo="📋 Tabela por Serviço">
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#f8fafc' }}>
                        {['Serviço', 'Prazo', 'Total', 'Em andamento', 'Concluídos', 'No prazo', 'Tempo médio'].map(h => (
                          <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', borderBottom: '2px solid #e2e8f0' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {porServico.map((s, i) => (
                        <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: '#1e293b' }}>{s.nome}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            <Badge cor="azul">{s.prazo} {s.tipo_prazo === 'uteis' ? 'úteis' : 'corridos'}</Badge>
                          </td>
                          <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#3b82f6' }}>{s.total_protocolos}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#f59e0b' }}>{s.em_andamento}</td>
                          <td style={{ padding: '0.75rem 1rem', color: '#10b981', fontWeight: 700 }}>{s.concluidos}</td>
                          <td style={{ padding: '0.75rem 1rem' }}>
                            {s.concluidos > 0 ? (
                              <Badge cor={s.no_prazo === s.concluidos ? 'verde' : s.no_prazo > 0 ? 'amarelo' : 'vermelho'}>
                                {s.no_prazo}/{s.concluidos}
                              </Badge>
                            ) : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 1rem', color: '#64748b' }}>{s.tempo_medio > 0 ? `${s.tempo_medio} dias` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Secao>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default Relatorios;
