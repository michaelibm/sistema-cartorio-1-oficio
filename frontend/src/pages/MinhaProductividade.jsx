import { useState, useEffect, useCallback } from 'react';
import { getMinhaProductividade } from '../services/api';

const CATEGORIAS = [
  { key: 'aguardando',    label: 'Aguardando',    icon: '⏳', color: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { key: 'em_andamento',  label: 'Em Andamento',  icon: '🔵', color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { key: 'concluido',     label: 'Concluído',     icon: '✅', color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0' },
  { key: 'cancelado',     label: 'Cancelado',     icon: '🔴', color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
];

const PERIODOS = [
  { key: 'hoje',   label: 'Hoje' },
  { key: 'semana', label: 'Esta Semana' },
  { key: 'mes',    label: 'Este Mês' },
  { key: 'custom', label: 'Período' },
];

function MinhaProductividade({ usuario }) {
  const [periodo, setPeriodo]         = useState('mes');
  const [dataInicio, setDataInicio]   = useState('');
  const [dataFim, setDataFim]         = useState('');
  const [dados, setDados]             = useState(null);
  const [carregando, setCarregando]   = useState(false);
  const [erro, setErro]               = useState('');
  const [toast, setToast]             = useState('');

  const mostrarToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  };

  const buscar = useCallback(async (periodoAtual, inicio, fim) => {
    setCarregando(true);
    setErro('');
    try {
      const filtros = {};
      if (periodoAtual !== 'custom') {
        filtros.periodo = periodoAtual;
      } else if (inicio && fim) {
        filtros.data_inicio = inicio;
        filtros.data_fim    = fim;
      }
      const res = await getMinhaProductividade(filtros);
      setDados(res);
    } catch (e) {
      setErro(e.message || 'Erro ao carregar produtividade');
      mostrarToast('Erro ao carregar dados: ' + (e.message || 'falha na requisição'));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar(periodo, dataInicio, dataFim);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePeriodo = (p) => {
    setPeriodo(p);
    if (p !== 'custom') {
      buscar(p, '', '');
    }
  };

  const handleBuscarCustom = () => {
    if (!dataInicio || !dataFim) {
      mostrarToast('Selecione data de início e fim');
      return;
    }
    buscar('custom', dataInicio, dataFim);
  };

  const grupos = dados?.grupos || { aguardando: [], em_andamento: [], concluido: [], cancelado: [] };

  const exportarExcel = () => {
    const todos = [
      ...grupos.aguardando.map(p => ({ ...p, status_label: 'Aguardando' })),
      ...grupos.em_andamento.map(p => ({ ...p, status_label: 'Em Andamento' })),
      ...grupos.concluido.map(p => ({ ...p, status_label: 'Concluído' })),
      ...grupos.cancelado.map(p => ({ ...p, status_label: 'Cancelado' })),
    ];
    if (!todos.length) { mostrarToast('Nenhum dado para exportar.'); return; }

    const fmt = d => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
    const linhas = [
      ['Número', 'Serviço', 'Status', 'Data Entrada', 'Data Vencimento', 'Data Conclusão'],
      ...todos.map(p => [p.numero, p.servico_nome, p.status_label, fmt(p.data_entrada), fmt(p.data_vencimento), fmt(p.data_conclusao)]),
    ];

    const csv = linhas.map(l => l.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const bom  = '﻿'; // BOM para Excel reconhecer UTF-8
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const periodoLabel = PERIODOS.find(p => p.key === periodo)?.label || periodo;
    a.href     = url;
    a.download = `produtividade_${usuario?.nome?.replace(/\s+/g,'_') || 'registrador'}_${periodoLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: '2rem', fontFamily: "'DM Sans', system-ui, sans-serif", background: '#f8fafc', minHeight: '100vh' }}>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: '1.5rem', right: '1.5rem', zIndex: 9999,
          background: '#1e293b', color: '#fff', padding: '0.85rem 1.25rem',
          borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          fontSize: '0.88rem', maxWidth: '360px',
          animation: 'fadeUp 0.3s ease',
        }}>
          ⚠️ {toast}
        </div>
      )}

      {/* Cabeçalho */}
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.6rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
          ⚡ Minha Produtividade
        </h1>
        <p style={{ color: '#64748b', margin: '0.35rem 0 0', fontSize: '0.92rem' }}>
          Seus protocolos — <strong>{usuario?.nome || 'Registrador'}</strong>
        </p>
      </div>

      {/* Barra de filtros */}
      <div style={{
        background: '#fff',
        borderRadius: '14px',
        padding: '1rem 1.25rem',
        marginBottom: '1.5rem',
        boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.5rem',
      }}>
        {PERIODOS.map(p => (
          <button
            key={p.key}
            onClick={() => handlePeriodo(p.key)}
            style={{
              padding: '0.5rem 1.1rem',
              borderRadius: '8px',
              border: periodo === p.key ? '1.5px solid #3b82f6' : '1.5px solid #e2e8f0',
              background: periodo === p.key ? '#3b82f6' : '#fff',
              color: periodo === p.key ? '#fff' : '#475569',
              fontWeight: '600',
              fontSize: '0.85rem',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {p.label}
          </button>
        ))}

        {periodo === 'custom' && (
          <>
            <input
              type="date"
              value={dataInicio}
              onChange={e => setDataInicio(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1.5px solid #e2e8f0',
                fontSize: '0.85rem',
                color: '#334155',
                outline: 'none',
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>até</span>
            <input
              type="date"
              value={dataFim}
              onChange={e => setDataFim(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '8px',
                border: '1.5px solid #e2e8f0',
                fontSize: '0.85rem',
                color: '#334155',
                outline: 'none',
              }}
            />
            <button
              onClick={handleBuscarCustom}
              style={{
                padding: '0.5rem 1.1rem',
                borderRadius: '8px',
                border: 'none',
                background: '#3b82f6',
                color: '#fff',
                fontWeight: '600',
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              Buscar
            </button>
          </>
        )}

        {carregando && (
          <span style={{ color: '#94a3b8', fontSize: '0.82rem', marginLeft: '0.5rem' }}>Carregando...</span>
        )}

        <button
          onClick={exportarExcel}
          disabled={!dados || dados.total === 0}
          style={{
            marginLeft: 'auto',
            padding: '0.5rem 1.1rem',
            borderRadius: '8px',
            border: '1.5px solid #10b981',
            background: (!dados || dados.total === 0) ? '#f1f5f9' : '#10b981',
            color: (!dados || dados.total === 0) ? '#94a3b8' : '#fff',
            fontWeight: '600',
            fontSize: '0.85rem',
            cursor: (!dados || dados.total === 0) ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.4rem',
            transition: 'all 0.15s',
          }}
        >
          📥 Exportar Excel
        </button>
      </div>

      {/* Erro inline */}
      {erro && !carregando && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: '10px', padding: '0.85rem 1.1rem',
          color: '#dc2626', fontSize: '0.88rem', marginBottom: '1.5rem',
        }}>
          ⚠️ {erro}
        </div>
      )}

      {/* Grid de cards 2×2 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '1.25rem',
      }}>
        {CATEGORIAS.map(cat => {
          const lista = grupos[cat.key] || [];
          return (
            <div
              key={cat.key}
              style={{
                background: '#fff',
                borderRadius: '16px',
                border: `1.5px solid ${cat.border}`,
                boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              {/* Topo do card */}
              <div style={{
                background: cat.bg,
                padding: '1.1rem 1.25rem 0.9rem',
                borderBottom: `1px solid ${cat.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ fontSize: '1.3rem' }}>{cat.icon}</span>
                  <span style={{ fontWeight: '700', color: cat.color, fontSize: '0.95rem' }}>
                    {cat.label}
                  </span>
                </div>
                <span style={{
                  fontSize: '2rem',
                  fontWeight: '800',
                  color: cat.color,
                  lineHeight: 1,
                }}>
                  {lista.length}
                </span>
              </div>

              {/* Lista de protocolos */}
              <div style={{ padding: '1rem 1.25rem', minHeight: '80px' }}>
                {lista.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', margin: 0, fontStyle: 'italic' }}>
                    Nenhum neste período
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {lista.map(p => (
                      <span
                        key={p.id}
                        title={p.servico_nome}
                        style={{
                          display: 'inline-block',
                          padding: '0.3rem 0.65rem',
                          borderRadius: '6px',
                          background: cat.bg,
                          border: `1px solid ${cat.border}`,
                          color: cat.color,
                          fontSize: '0.78rem',
                          fontWeight: '600',
                          cursor: 'default',
                          transition: 'opacity 0.15s',
                          userSelect: 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.75'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                      >
                        {p.numero}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Total */}
      {dados && (
        <div style={{
          marginTop: '1.5rem',
          textAlign: 'right',
          color: '#94a3b8',
          fontSize: '0.8rem',
        }}>
          Total de protocolos no período: <strong style={{ color: '#475569' }}>{dados.total}</strong>
        </div>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default MinhaProductividade;
