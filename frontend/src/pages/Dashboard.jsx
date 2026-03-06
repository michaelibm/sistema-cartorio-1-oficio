import React, { useEffect, useState, useCallback } from 'react';
import { getProtocolos, API_URL } from '../services/api';

// Fuso horário de Manaus (UTC-4, sem horário de verão)
const MANAUS_OFFSET = -4 * 60; // minutos

const agoraManaus = () => {
  const agora = new Date();
  const utc = agora.getTime() + agora.getTimezoneOffset() * 60000;
  return new Date(utc + MANAUS_OFFSET * 60000);
};

const hojeManaus = () => {
  const d = agoraManaus();
  d.setHours(0, 0, 0, 0);
  return d;
};

const formatarDataHoraManaus = (date) => {
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// ─── Dias Úteis ────────────────────────────────────────────────────────────
// Feriados nacionais fixos (MM-DD) + feriados municipais de Manaus
const FERIADOS_FIXOS = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '07-05', // Adesão do AM à independência (Manaus)
  '09-07', // Independência
  '10-12', // Nossa Sra. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-08', // Nossa Sra. da Conceição (Manaus)
  '12-25', // Natal
]);

// Feriados móveis calculados por ano (Páscoa + derivados + Carnaval)
function feriadosMoveis(ano) {
  // Algoritmo de Meeus/Jones/Butcher para Páscoa
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  const pascoa = new Date(ano, mes - 1, dia);

  const addDias = (base, n) => {
    const d = new Date(base);
    d.setDate(d.getDate() + n);
    return d;
  };
  const fmt = (d) => `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  return new Set([
    fmt(addDias(pascoa, -48)), // 2ª Carnaval
    fmt(addDias(pascoa, -47)), // 3ª Carnaval
    fmt(addDias(pascoa, -2)),  // Sexta da Paixão
    fmt(pascoa),               // Páscoa
    fmt(addDias(pascoa, 60)),  // Corpus Christi
  ]);
}

// Cache por ano para não recalcular a cada chamada
const _cacheFeriadosMoveis = {};
function isFeriado(date) {
  const ano = date.getFullYear();
  if (!_cacheFeriadosMoveis[ano]) _cacheFeriadosMoveis[ano] = feriadosMoveis(ano);
  const key = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return FERIADOS_FIXOS.has(key) || _cacheFeriadosMoveis[ano].has(key);
}

function isDiaUtil(date) {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6 && !isFeriado(date);
}

/**
 * Conta dias úteis entre duas datas (de → até), exclusivo na data inicial.
 * Retorna número positivo se até > de.
 */
function diasUteisEntre(de, ate) {
  if (ate <= de) return 0;
  let count = 0;
  const cur = new Date(de);
  cur.setDate(cur.getDate() + 1); // começa no dia seguinte ao vencimento
  while (cur <= ate) {
    if (isDiaUtil(cur)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [horaAtual, setHoraAtual] = useState(agoraManaus());

  // Seletor de mês/ano
  const agora = agoraManaus();
  const [mesSelecionado, setMesSelecionado] = useState(agora.getMonth());
  const [anoSelecionado, setAnoSelecionado] = useState(agora.getFullYear());

  // Filtro por intervalo de data
  const [filtroDataInicio, setFiltroDataInicio] = useState('');
  const [filtroDataFim, setFiltroDataFim] = useState('');
  const [usarFiltroData, setUsarFiltroData] = useState(false);

  // Vista painel completo
  const [verTodos, setVerTodos] = useState(false);
  const [todosProtocolos, setTodosProtocolos] = useState([]);
  const [filtroStatusTabela, setFiltroStatusTabela] = useState('');
  const [filtroBuscaTabela, setFiltroBuscaTabela] = useState('');
  const [filtroVencInicio, setFiltroVencInicio] = useState('');
  const [filtroVencFim, setFiltroVencFim] = useState('');

  const [stats, setStats] = useState({
    ativos: 0,
    concluidosMes: 0,
    atrasados: 0,
    vencendo3Dias: 0,
  });
  const [vencendo7Dias, setVencendo7Dias] = useState([]);
  const [atrasados, setAtrasados] = useState([]);

  // Relógio de Manaus — atualiza a cada segundo
  useEffect(() => {
    const interval = setInterval(() => setHoraAtual(agoraManaus()), 1000);
    return () => clearInterval(interval);
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const protocolos = await getProtocolos();
      setTodosProtocolos(Array.isArray(protocolos) ? protocolos : []);

      const hoje = hojeManaus();

      // Determinar se o período selecionado é o mês atual
      const mesAtualNum = agoraManaus().getMonth();
      const anoAtualNum = agoraManaus().getFullYear();
      const isPeriodoAtual = !usarFiltroData &&
        mesSelecionado === mesAtualNum &&
        anoSelecionado === anoAtualNum;

      // Determinar intervalo do período selecionado
      let inicioMes, fimMes;
      if (usarFiltroData && filtroDataInicio && filtroDataFim) {
        inicioMes = new Date(filtroDataInicio + 'T00:00:00');
        fimMes = new Date(filtroDataFim + 'T23:59:59');
      } else {
        inicioMes = new Date(anoSelecionado, mesSelecionado, 1);
        fimMes = new Date(anoSelecionado, mesSelecionado + 1, 0, 23, 59, 59);
      }

      // Helper: protocolo pertence ao período pelo vencimento ou entrada
      const noperiodo = (p) => {
        const venc = new Date(p.data_vencimento);
        const entrada = new Date(p.data_entrada);
        return (venc >= inicioMes && venc <= fimMes) ||
               (entrada >= inicioMes && entrada <= fimMes);
      };

      // Se for o mês atual: mostra tudo em andamento (comportamento padrão)
      // Se for outro período: filtra por vencimento/entrada dentro do período
      const protocolosDoperiodo = isPeriodoAtual
        ? protocolos
        : protocolos.filter(noperiodo);

      const ativos = protocolosDoperiodo.filter(p => p.status === 'andamento').length;

      // Busca concluídos do historico para preservar produtividade mesmo se protocolo for reaberto
      const token = localStorage.getItem('token');
      let statsParams = '';
      if (usarFiltroData && filtroDataInicio && filtroDataFim) {
        statsParams = `data_inicio=${filtroDataInicio}&data_fim=${filtroDataFim}`;
      } else {
        statsParams = `mes=${mesSelecionado + 1}&ano=${anoSelecionado}`;
      }
      const statsResp = await fetch(`${API_URL}/protocolos/dashboard/stats?${statsParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const statsData = statsResp.ok ? await statsResp.json() : {};
      const concluidosMes = statsData.concluidos_mes ?? 0;

      const protocolosAtrasados = protocolosDoperiodo.filter(p => {
        if (p.status !== 'andamento') return false;
        const vencimento = new Date(p.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        return vencimento < hoje;
      });

      const protocolosVencendo3 = protocolosDoperiodo.filter(p => {
        if (p.status !== 'andamento') return false;
        const vencimento = new Date(p.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        const diff = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 3;
      });

      const protocolosVencendo7 = protocolosDoperiodo.filter(p => {
        if (p.status !== 'andamento') return false;
        const vencimento = new Date(p.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        const diff = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
      }).map(p => {
        const vencimento = new Date(p.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((vencimento - hoje) / (1000 * 60 * 60 * 24));
        return { ...p, diasRestantes };
      });

      setStats({
        ativos,
        concluidosMes,
        atrasados: protocolosAtrasados.length,
        vencendo3Dias: protocolosVencendo3.length,
      });

      setVencendo7Dias(protocolosVencendo7);
      setAtrasados(protocolosAtrasados.map(p => {
        const vencimento = new Date(p.data_vencimento);
        vencimento.setHours(0, 0, 0, 0);
        const diasAtraso = diasUteisEntre(vencimento, hoje);
        return { ...p, diasAtraso };
      }));

    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [mesSelecionado, anoSelecionado, usarFiltroData, filtroDataInicio, filtroDataFim]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const corDiasRestantes = (dias) => {
    if (dias === 0) return { bg: '#fee2e2', text: '#991b1b', label: 'HOJE' };
    if (dias === 1) return { bg: '#fef3c7', text: '#92400e', label: '1 dia' };
    if (dias <= 3) return { bg: '#fef3c7', text: '#92400e', label: `${dias} dias` };
    return { bg: '#dbeafe', text: '#1e40af', label: `${dias} dias` };
  };

  // Anos disponíveis para seleção (3 anos atrás até ano atual)
  const anoAtual = agoraManaus().getFullYear();
  const anosDisponiveis = Array.from({ length: 4 }, (_, i) => anoAtual - 3 + i);

  // Verificar se o período selecionado é o mês atual (para label e comportamento padrão)
  const mesAtualRender = agoraManaus().getMonth();
  const anoAtualRender = agoraManaus().getFullYear();
  const isPeriodoAtual = !usarFiltroData &&
    mesSelecionado === mesAtualRender &&
    anoSelecionado === anoAtualRender;

  // Protocolos filtrados para painel completo
  const protocolosFiltrados = todosProtocolos.filter(p => {
    const matchStatus = !filtroStatusTabela || p.status === filtroStatusTabela;
    const matchBusca = !filtroBuscaTabela ||
      (p.numero && p.numero.toString().includes(filtroBuscaTabela)) ||
      (p.servico_nome && p.servico_nome.toLowerCase().includes(filtroBuscaTabela.toLowerCase())) ||
      (p.responsavel_nome && p.responsavel_nome.toLowerCase().includes(filtroBuscaTabela.toLowerCase()));
    let matchVenc = true;
    if (filtroVencInicio) matchVenc = matchVenc && new Date(p.data_vencimento) >= new Date(filtroVencInicio);
    if (filtroVencFim) matchVenc = matchVenc && new Date(p.data_vencimento) <= new Date(filtroVencFim + 'T23:59:59');
    return matchStatus && matchBusca && matchVenc;
  });

  const periodoLabel = usarFiltroData && filtroDataInicio && filtroDataFim
    ? `${filtroDataInicio.split('-').reverse().join('/')} até ${filtroDataFim.split('-').reverse().join('/')}`
    : `${MESES[mesSelecionado]} ${anoSelecionado}`;

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Carregando dashboard...</p>
      </div>
    );
  }

  // ===== PAINEL COMPLETO =====
  if (verTodos) {
    return (
      <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
          <button onClick={() => setVerTodos(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '6px', padding: '0.5rem 1rem', cursor: 'pointer', fontWeight: '600', color: '#374151' }}>
            ← Voltar
          </button>
          <div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#1f2937', margin: 0 }}>Todos os Protocolos</h1>
            <p style={{ color: '#6b7280', margin: 0, fontSize: '0.875rem' }}>{todosProtocolos.length} protocolo(s) no total</p>
          </div>
        </div>

        {/* Filtros painel */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
          <input placeholder="🔍 Buscar número, serviço, responsável..." value={filtroBuscaTabela} onChange={e => setFiltroBuscaTabela(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', minWidth: 280 }} />
          <select value={filtroStatusTabela} onChange={e => setFiltroStatusTabela(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }}>
            <option value="">Todos status</option>
            <option value="andamento">Em andamento</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
            <option value="aguardando">Aguardando</option>
          </select>
          <span style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '600' }}>Vencimento:</span>
          <input type="date" value={filtroVencInicio} onChange={e => setFiltroVencInicio(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
          <span style={{ color: '#6b7280' }}>até</span>
          <input type="date" value={filtroVencFim} onChange={e => setFiltroVencFim(e.target.value)}
            style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
          <button onClick={() => { setFiltroBuscaTabela(''); setFiltroStatusTabela(''); setFiltroVencInicio(''); setFiltroVencFim(''); }}
            style={{ padding: '0.5rem 0.75rem', background: '#f3f4f6', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', color: '#374151' }}>
            ✕ Limpar
          </button>
          <span style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280' }}>
            {protocolosFiltrados.length} resultado(s)
          </span>
        </div>

        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                {['NÚMERO', 'SERVIÇO', 'RESPONSÁVEL', 'ENTRADA', 'VENCIMENTO', 'STATUS'].map(h => (
                  <th key={h} style={{ padding: '1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {protocolosFiltrados.length === 0 ? (
                <tr><td colSpan="6" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>Nenhum protocolo encontrado</td></tr>
              ) : protocolosFiltrados.map(p => {
                const statusColors = {
                  andamento: { bg: '#dbeafe', text: '#1e40af', label: 'Em andamento' },
                  concluido: { bg: '#d1fae5', text: '#065f46', label: 'Concluído' },
                  cancelado: { bg: '#fee2e2', text: '#991b1b', label: 'Cancelado' },
                  aguardando: { bg: '#fef3c7', text: '#92400e', label: 'Aguardando' },
                };
                const sc = statusColors[p.status] || { bg: '#f3f4f6', text: '#374151', label: p.status };
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td style={{ padding: '0.875rem 1rem' }}><strong style={{ color: '#1f2937' }}>{p.numero}</strong></td>
                    <td style={{ padding: '0.875rem 1rem', color: '#4b5563' }}>{p.servico_nome}</td>
                    <td style={{ padding: '0.875rem 1rem', color: '#4b5563' }}>{p.responsavel_nome}</td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                      {p.data_entrada ? new Date(p.data_entrada).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                      {p.data_vencimento ? new Date(p.data_vencimento).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <span style={{ background: sc.bg, color: sc.text, padding: '0.25rem 0.625rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: '600' }}>
                        {sc.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', background: '#f9fafb', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.25rem' }}>
            Dashboard
          </h1>
          <p style={{ color: '#6b7280', margin: 0 }}>Visão geral dos protocolos</p>
        </div>
        {/* Relógio de Manaus */}
        <div style={{ background: 'white', borderRadius: '12px', padding: '0.75rem 1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'right', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.125rem' }}>
            🕐 Manaus (UTC-4)
          </div>
          <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#1f2937', fontVariantNumeric: 'tabular-nums' }}>
            {formatarDataHoraManaus(horaAtual)}
          </div>
        </div>
      </div>

      {/* Seletor de período */}
      <div style={{ background: 'white', borderRadius: '12px', padding: '1.25rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <span style={{ fontWeight: '600', color: '#374151', fontSize: '0.875rem' }}>📅 Período de análise:</span>

          {/* Toggle modo */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', color: '#6b7280', cursor: 'pointer' }}>
            <input type="checkbox" checked={usarFiltroData} onChange={e => setUsarFiltroData(e.target.checked)} />
            Intervalo de datas
          </label>

          {!usarFiltroData ? (
            <>
              <select value={mesSelecionado} onChange={e => setMesSelecionado(Number(e.target.value))}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                {MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
              <select value={anoSelecionado} onChange={e => setAnoSelecionado(Number(e.target.value))}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem', fontWeight: '500', color: '#374151' }}>
                {anosDisponiveis.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </>
          ) : (
            <>
              <input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
              <span style={{ color: '#6b7280' }}>até</span>
              <input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)}
                style={{ padding: '0.5rem 0.75rem', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.875rem' }} />
            </>
          )}

          <button onClick={carregar}
            style={{ padding: '0.5rem 1rem', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>
            🔄 Atualizar
          </button>

          <span style={{ marginLeft: 'auto', fontSize: '0.875rem', color: '#6b7280', fontStyle: 'italic' }}>
            {isPeriodoAtual
              ? <span>📌 Mês atual — exibindo <strong style={{ color: '#374151' }}>todos os ativos</strong></span>
              : <span>Filtrando por: <strong style={{ color: '#374151' }}>{periodoLabel}</strong></span>
            }
          </span>

          <button onClick={() => setVerTodos(true)}
            style={{ padding: '0.5rem 1rem', background: '#7c3aed', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '0.875rem' }}>
            📋 Ver Todos Protocolos
          </button>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
        gap: '1.5rem',
        marginBottom: '1.5rem'
      }}>
        {/* Card 1: Ativos */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #3b82f6'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '600' }}>
            ATIVOS
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.25rem' }}>
            {stats.ativos}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {isPeriodoAtual ? 'Todos em andamento' : `Com venc./entrada em ${periodoLabel}`}
          </div>
        </div>

        {/* Card 2: Concluídos no Mês */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #10b981'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '600' }}>
            CONCLUÍDOS NO PERÍODO
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.25rem' }}>
            {stats.concluidosMes}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            {periodoLabel}
          </div>
        </div>

        {/* Card 3: Atrasados */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #ef4444'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '600' }}>
            ATRASADOS
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#ef4444', marginBottom: '0.25rem' }}>
            {stats.atrasados}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Precisa de atenção
          </div>
        </div>

        {/* Card 4: Vencendo em 3 dias */}
        <div style={{
          background: 'white',
          borderRadius: '12px',
          padding: '1.5rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          borderLeft: '4px solid #f59e0b'
        }}>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem', textTransform: 'uppercase', fontWeight: '600' }}>
            VENCENDO (3 DIAS)
          </div>
          <div style={{ fontSize: '2.5rem', fontWeight: '700', color: '#f59e0b', marginBottom: '0.25rem' }}>
            {stats.vencendo3Dias}
          </div>
          <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Priorize esses
          </div>
        </div>
      </div>

      {/* Vencendo (próximos 7 dias) */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '2rem'
      }}>
        <div style={{ 
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
            Vencendo (próximos 7 dias)
          </h2>
          <button 
            onClick={carregar}
            style={{
              background: '#f3f4f6',
              border: 'none',
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              cursor: 'pointer',
              fontWeight: '500',
              color: '#374151'
            }}
          >
            ↻ Atualizar
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  NÚMERO
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  SERVIÇO
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  RESPONSÁVEL
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  VENCIMENTO
                </th>
                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody>
              {vencendo7Dias.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    🎉 Nenhum protocolo vencendo nos próximos 7 dias
                  </td>
                </tr>
              ) : (
                vencendo7Dias.map((p, idx) => {
                  const cor = corDiasRestantes(p.diasRestantes);
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '1rem' }}>
                        <strong style={{ color: '#1f2937' }}>{p.numero}</strong>
                      </td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}>{p.servico_nome}</td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}>{p.responsavel_nome}</td>
                      <td style={{ padding: '1rem', color: '#4b5563' }}>
                        {new Date(p.data_vencimento).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ padding: '1rem', textAlign: 'center' }}>
                        <span style={{
                          background: cor.bg,
                          color: cor.text,
                          padding: '0.375rem 0.75rem',
                          borderRadius: '9999px',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          {cor.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Atrasados */}
      <div style={{ 
        background: 'white', 
        borderRadius: '12px', 
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          padding: '1.5rem',
          borderBottom: '1px solid #e5e7eb'
        }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#1f2937', margin: 0 }}>
            Atrasados
          </h2>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#fef2f2' }}>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  NÚMERO
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  SERVIÇO
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  RESPONSÁVEL
                </th>
                <th style={{ padding: '1rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  VENCIMENTO
                </th>
                <th style={{ padding: '1rem', textAlign: 'center', fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase' }}>
                  ATRASO (D.U.)
                </th>
              </tr>
            </thead>
            <tbody>
              {atrasados.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                    🎉 Nenhum protocolo atrasado
                  </td>
                </tr>
              ) : (
                atrasados.map((p) => (
                  <tr key={p.id} style={{ borderTop: '1px solid #fee2e2', background: '#fef2f2' }}>
                    <td style={{ padding: '1rem' }}>
                      <strong style={{ color: '#991b1b' }}>{p.numero}</strong>
                    </td>
                    <td style={{ padding: '1rem', color: '#4b5563' }}>{p.servico_nome}</td>
                    <td style={{ padding: '1rem', color: '#4b5563' }}>{p.responsavel_nome}</td>
                    <td style={{ padding: '1rem', color: '#4b5563' }}>
                      {new Date(p.data_vencimento).toLocaleDateString('pt-BR')}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <span style={{
                        background: '#fee2e2',
                        color: '#991b1b',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '9999px',
                        fontSize: '0.875rem',
                        fontWeight: '600',
                        display: 'inline-block'
                      }}>
                        {p.diasAtraso === 0 ? '< 1 d.u.' : `${p.diasAtraso} d.u.`}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
