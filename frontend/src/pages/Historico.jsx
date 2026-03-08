import React, { useEffect, useState, useCallback } from 'react';
import { API_URL } from '../services/api';

const token = () => localStorage.getItem('token');
const authH = () => ({ Authorization: `Bearer ${token()}` });
const hojeISO = () => new Date().toISOString().slice(0, 10);

const STATUS_CONFIG = {
  andamento:  { label: 'Em andamento', bg: '#dbeafe', cor: '#1d4ed8' },
  concluido:  { label: 'Concluído',    bg: '#dcfce7', cor: '#15803d' },
  aguardando: { label: 'Aguardando',   bg: '#fef9c3', cor: '#a16207' },
  cancelado:  { label: 'Cancelado',    bg: '#fee2e2', cor: '#dc2626' },
};

function Badge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status, bg: '#f1f5f9', cor: '#475569' };
  return (
    <span style={{ padding: '0.2rem 0.6rem', borderRadius: 99, background: cfg.bg, color: cfg.cor, fontSize: 11, fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
}

export default function Historico({ usuario }) {
  const isSupervisor = usuario?.cargo === 'Supervisor' || usuario?.cargo === 'Coordenador';
  const isRegistrador = usuario?.cargo === 'Registrador';

  const [registradores, setRegistradores] = useState([]);
  const [dados, setDados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');

  // Filtros
  const [modoFiltro, setModoFiltro] = useState('dia'); // 'dia' | 'periodo' | 'numero'
  const [filtroData, setFiltroData] = useState(hojeISO());
  const [filtroInicio, setFiltroInicio] = useState(hojeISO());
  const [filtroFim, setFiltroFim] = useState(hojeISO());
  const [filtroNumero, setFiltroNumero] = useState('');
  const [filtroRegistrador, setFiltroRegistrador] = useState('');

  // Carrega lista de registradores (só para supervisor)
  useEffect(() => {
    if (!isSupervisor) return;
    fetch(`${API_URL}/funcionarios`, { headers: authH() })
      .then(r => r.json())
      .then(data => {
        const regs = Array.isArray(data)
          ? data.filter(f => f.cargo === 'Registrador' && f.ativo)
          : [];
        setRegistradores(regs);
      })
      .catch(() => {});
  }, [isSupervisor]);

  const buscar = useCallback(async () => {
    setLoading(true);
    setErro('');
    try {
      const params = new URLSearchParams();

      if (modoFiltro === 'numero' && filtroNumero.trim()) {
        params.set('numero', filtroNumero.trim());
      } else if (modoFiltro === 'periodo') {
        params.set('data_inicio', filtroInicio);
        params.set('data_fim', filtroFim);
      } else {
        params.set('data', filtroData);
      }

      if (isSupervisor && filtroRegistrador) {
        params.set('registrador_id', filtroRegistrador);
      }

      const resp = await fetch(`${API_URL}/protocolos/historico-producao?${params}`, { headers: authH() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || 'Erro');
      setDados(Array.isArray(data) ? data : []);
    } catch (e) {
      setErro(e.message || 'Erro ao buscar histórico');
    } finally {
      setLoading(false);
    }
  }, [modoFiltro, filtroData, filtroInicio, filtroFim, filtroNumero, filtroRegistrador, isSupervisor]);

  useEffect(() => {
    if (modoFiltro !== 'numero') buscar();
  }, [modoFiltro, filtroData, filtroInicio, filtroFim, filtroRegistrador]); // eslint-disable-line

  const fmtDateTime = (iso) => {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const fmtDate = (iso) => {
    if (!iso) return '-';
    return String(iso).slice(0, 10).split('-').reverse().join('/');
  };

  // Agrupar por registrador quando supervisor sem filtro individual
  const totalPorRegistrador = isSupervisor && !filtroRegistrador
    ? dados.reduce((acc, r) => {
        const k = r.registrador_nome;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    : null;

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#1e293b', margin: 0 }}>
          📜 Histórico de Produção
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: 14 }}>
          {isRegistrador
            ? 'Consulte os protocolos que você concluiu'
            : 'Consulte conclusões por registrador, data ou número de protocolo'}
        </p>
      </div>

      {/* Filtros */}
      <div style={{ background: 'white', borderRadius: 14, padding: '1.25rem 1.5rem', boxShadow: '0 1px 6px rgba(0,0,0,0.07)', marginBottom: '1.5rem', border: '1px solid #e2e8f0' }}>
        {/* Modo */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {[
            { key: 'dia', label: 'Por dia' },
            { key: 'periodo', label: 'Por período' },
            { key: 'numero', label: 'Por número' },
          ].map(m => (
            <button key={m.key} onClick={() => setModoFiltro(m.key)} style={{
              padding: '0.45rem 1rem', borderRadius: 8, border: '2px solid',
              borderColor: modoFiltro === m.key ? '#3b82f6' : '#e2e8f0',
              background: modoFiltro === m.key ? '#eff6ff' : 'white',
              color: modoFiltro === m.key ? '#1d4ed8' : '#64748b',
              fontWeight: modoFiltro === m.key ? 700 : 500, fontSize: 13, cursor: 'pointer',
            }}>
              {m.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {/* Filtro de data */}
          {modoFiltro === 'dia' && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Data</label>
              <input type="date" value={filtroData} onChange={e => setFiltroData(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
            </div>
          )}

          {modoFiltro === 'periodo' && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>De</label>
                <input type="date" value={filtroInicio} onChange={e => setFiltroInicio(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Até</label>
                <input type="date" value={filtroFim} onChange={e => setFiltroFim(e.target.value)}
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }} />
              </div>
            </>
          )}

          {modoFiltro === 'numero' && (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Número do Protocolo</label>
                <input type="text" value={filtroNumero} onChange={e => setFiltroNumero(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && buscar()}
                  placeholder="Ex: 2026-000123"
                  style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14, width: 200 }} />
              </div>
              <button onClick={buscar} style={{
                padding: '0.5rem 1.25rem', borderRadius: 8, background: '#3b82f6', color: 'white',
                border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>
                Buscar
              </button>
            </div>
          )}

          {/* Filtro registrador (supervisor) */}
          {isSupervisor && (
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Registrador</label>
              <select value={filtroRegistrador} onChange={e => setFiltroRegistrador(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 14 }}>
                <option value="">Todos</option>
                {registradores.map(r => (
                  <option key={r.id} value={r.id}>{r.nome}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Resumo por registrador (supervisor sem filtro individual) */}
      {totalPorRegistrador && Object.keys(totalPorRegistrador).length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
          {Object.entries(totalPorRegistrador)
            .sort((a, b) => b[1] - a[1])
            .map(([nome, total]) => (
              <div key={nome} style={{
                background: 'white', border: '1px solid #e2e8f0', borderRadius: 10,
                padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
              }}>
                <span style={{ fontSize: 20 }}>👤</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#1e293b' }}>{nome}</div>
                  <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 700 }}>{total} concluídos</div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Tabela */}
      <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.07)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        {erro && (
          <div style={{ padding: '1rem 1.5rem', background: '#fef2f2', color: '#dc2626', borderBottom: '1px solid #fecaca', fontSize: 14 }}>
            {erro}
          </div>
        )}

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>Carregando...</div>
        ) : dados.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📭</div>
            <div style={{ color: '#64748b', fontWeight: 600, fontSize: 15 }}>Nenhuma conclusão encontrada</div>
            <div style={{ color: '#94a3b8', fontSize: 13, marginTop: 4 }}>
              {modoFiltro === 'dia'
                ? `Nenhum protocolo foi concluído em ${fmtDate(filtroData)}`
                : modoFiltro === 'numero'
                ? 'Protocolo não encontrado ou nunca foi concluído'
                : 'Nenhuma conclusão no período selecionado'}
            </div>
          </div>
        ) : (
          <>
            <div style={{ padding: '0.875rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>
                {dados.length} conclusão{dados.length !== 1 ? 'ões' : ''} encontrada{dados.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Protocolo</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Serviço</th>
                    {isSupervisor && (
                      <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Registrador</th>
                    )}
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Entrada</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Concluído em</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Dias</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Responsável atual</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: '#475569', fontSize: 12, textTransform: 'uppercase' }}>Status atual</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.map((r, i) => (
                    <tr key={r.historico_id} style={{ borderBottom: '1px solid #f1f5f9', background: i % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{ padding: '0.75rem 1rem', fontWeight: 700, color: '#1e293b' }}>
                        #{r.numero}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', color: '#475569' }}>{r.servico_nome}</td>
                      {isSupervisor && (
                        <td style={{ padding: '0.75rem 1rem' }}>
                          <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{r.registrador_nome}</div>
                          {r.registrador_setor && (
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.registrador_setor}</div>
                          )}
                        </td>
                      )}
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: 13 }}>{fmtDate(r.data_entrada)}</td>
                      <td style={{ padding: '0.75rem 1rem', color: '#64748b', fontSize: 13 }}>{fmtDateTime(r.concluido_em)}</td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <span style={{
                          fontWeight: 700, fontSize: 13,
                          color: r.dias_para_concluir <= 0 ? '#16a34a' : r.dias_para_concluir <= 5 ? '#d97706' : '#dc2626',
                        }}>
                          {r.dias_para_concluir ?? '-'}d
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem 1rem' }}>
                        {r.responsavel_atual_nome ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{r.responsavel_atual_nome}</div>
                            {r.responsavel_atual_cargo && (
                              <div style={{ fontSize: 11, color: '#94a3b8' }}>{r.responsavel_atual_cargo}</div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>
                        <Badge status={r.status} />
                        {r.status !== 'concluido' && (
                          <div style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600, marginTop: 2 }}>reaberto</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
