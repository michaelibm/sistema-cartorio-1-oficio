import React, { useEffect, useState, useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const CORES = {
  bg: '#0a0e1a',
  card: '#111827',
  cardBorder: '#1e2d45',
  azul: '#3b82f6',
  verde: '#10b981',
  amarelo: '#f59e0b',
  vermelho: '#ef4444',
  roxo: '#8b5cf6',
  texto: '#f1f5f9',
  subtexto: '#94a3b8',
  destaque: '#38bdf8',
};

function useRelogio() {
  const [hora, setHora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setHora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return hora;
}

function KpiCard({ label, valor, cor, icone, sub, grande }) {
  return (
    <div style={{
      background: CORES.card,
      border: `1px solid ${CORES.cardBorder}`,
      borderTop: `3px solid ${cor}`,
      borderRadius: 16,
      padding: grande ? '2rem 1.5rem' : '1.25rem 1.5rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Glow background */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 60,
        background: `radial-gradient(ellipse at top, ${cor}18 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ fontSize: grande ? 14 : 11, color: CORES.subtexto, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {icone} {label}
      </div>
      <div style={{
        fontSize: grande ? '3.5rem' : '2.25rem',
        fontWeight: 800,
        color: cor,
        lineHeight: 1,
        fontFamily: "'Courier New', monospace",
        letterSpacing: '-0.02em',
      }}>
        {valor ?? '—'}
      </div>
      {sub && <div style={{ fontSize: 11, color: CORES.subtexto, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function RankingItem({ posicao, concluidos, total, taxa }) {
  const medalha = posicao === 1 ? '🥇' : posicao === 2 ? '🥈' : posicao === 3 ? '🥉' : `${posicao}º`;
  const cor = posicao === 1 ? '#f59e0b' : posicao === 2 ? '#94a3b8' : posicao === 3 ? '#b45309' : CORES.azul;
  const pct = total > 0 ? (concluidos / total) * 100 : 0;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      padding: '0.9rem 1.25rem',
      background: posicao === 1 ? '#1c1a0e' : '#0f172a',
      border: `1px solid ${posicao === 1 ? '#f59e0b30' : CORES.cardBorder}`,
      borderRadius: 12,
      transition: 'all 0.3s',
    }}>
      <span style={{ fontSize: posicao <= 3 ? 28 : 18, minWidth: 36, textAlign: 'center' }}>{medalha}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ color: CORES.texto, fontWeight: 700, fontSize: 15 }}>
            Registrador {posicao}º lugar
          </span>
          <span style={{ color: cor, fontWeight: 800, fontSize: 16 }}>
            {concluidos} <span style={{ fontSize: 11, color: CORES.subtexto }}>concluídos</span>
          </span>
        </div>
        <div style={{ background: '#1e2d45', borderRadius: 99, height: 6, width: '100%' }}>
          <div style={{
            background: cor,
            width: `${pct}%`,
            height: '100%',
            borderRadius: 99,
            transition: 'width 1s ease',
            boxShadow: `0 0 8px ${cor}80`,
          }} />
        </div>
      </div>
      <div style={{
        background: taxa >= 80 ? '#052e16' : taxa >= 50 ? '#1c1508' : '#1c0a0a',
        color: taxa >= 80 ? '#10b981' : taxa >= 50 ? '#f59e0b' : '#ef4444',
        padding: '0.25rem 0.6rem',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        minWidth: 44,
        textAlign: 'center',
      }}>
        {taxa}%
      </div>
    </div>
  );
}

function VencendoItem({ numero, servico_nome, data_vencimento, dias_restantes }) {
  const cor = dias_restantes === 0 ? CORES.vermelho : dias_restantes <= 3 ? CORES.amarelo : CORES.azul;
  const label = dias_restantes === 0 ? 'HOJE' : `${dias_restantes}d`;
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '0.6rem 1rem',
      borderBottom: `1px solid ${CORES.cardBorder}`,
    }}>
      <span style={{ color: CORES.texto, fontWeight: 600, fontSize: 13 }}>{numero}</span>
      <span style={{ color: CORES.subtexto, fontSize: 12, flex: 1, marginLeft: '0.75rem' }}>{servico_nome}</span>
      <span style={{
        background: `${cor}20`,
        color: cor,
        padding: '0.2rem 0.6rem',
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${cor}40`,
      }}>{label}</span>
    </div>
  );
}

function BarraMeta({ label, atual, meta, cor }) {
  const pct = meta > 0 ? Math.min((atual / meta) * 100, 100) : 0;
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ color: CORES.subtexto, fontSize: 12, fontWeight: 600 }}>{label}</span>
        <span style={{ color: cor, fontWeight: 700, fontSize: 13 }}>{atual} / {meta}</span>
      </div>
      <div style={{ background: '#1e2d45', borderRadius: 99, height: 10 }}>
        <div style={{
          background: `linear-gradient(90deg, ${cor}, ${cor}cc)`,
          width: `${pct}%`,
          height: '100%',
          borderRadius: 99,
          transition: 'width 1.5s ease',
          boxShadow: `0 0 10px ${cor}60`,
        }} />
      </div>
    </div>
  );
}

export default function Painel() {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);
  const [pulsar, setPulsar] = useState(false);
  const hora = useRelogio();

  const META_DIA = 10;
  const META_MES = 200;

  const carregar = useCallback(async () => {
    try {
      const resp = await fetch(`${API_BASE}/painel/dados`);
      if (!resp.ok) throw new Error('Erro');
      const data = await resp.json();
      setDados(data);
      setUltimaAtualizacao(new Date());
      setPulsar(true);
      setTimeout(() => setPulsar(false), 600);
    } catch (e) {
      console.error('Erro ao carregar painel:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 60000);
    return () => clearInterval(interval);
  }, [carregar]);

  const kpis = dados?.kpis || {};
  const ranking = dados?.ranking || [];
  const vencendo = dados?.vencendo || [];
  const diasSemAtraso = dados?.dias_sem_atraso;

  const dataHoje = hora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
  const horaStr = hora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: CORES.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: CORES.subtexto }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⟳</div>
          <p>Carregando painel...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: CORES.bg,
      padding: '1.5rem',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: CORES.texto,
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1.5rem',
        padding: '1rem 1.5rem',
        background: CORES.card,
        border: `1px solid ${CORES.cardBorder}`,
        borderRadius: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: `linear-gradient(135deg, ${CORES.azul}, ${CORES.roxo})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>📋</div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.25rem', color: CORES.texto }}>Sistema Cartorial</div>
            <div style={{ fontSize: 12, color: CORES.subtexto }}>Painel de Produtividade</div>
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: CORES.destaque, fontFamily: "'Courier New', monospace", letterSpacing: '0.05em' }}>
            {horaStr}
          </div>
          <div style={{ fontSize: 12, color: CORES.subtexto, textTransform: 'capitalize' }}>{dataHoje}</div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end', marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: CORES.verde,
              boxShadow: `0 0 8px ${CORES.verde}`,
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 11, color: CORES.verde, fontWeight: 600 }}>AO VIVO</span>
          </div>
          <div style={{ fontSize: 11, color: CORES.subtexto }}>
            {ultimaAtualizacao ? `Atualizado às ${ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Atualizando...'}
          </div>
        </div>
      </div>

      {/* Grid principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <KpiCard label="Concluídos hoje" valor={kpis.concluidos_hoje} cor={CORES.verde} icone="✅" grande />
        <KpiCard label="Em andamento" valor={kpis.em_andamento} cor={CORES.azul} icone="⏳" grande />
        <KpiCard label="Atrasados" valor={kpis.atrasados} cor={CORES.vermelho} icone="🚨" grande sub="Precisam de atenção" />
        <KpiCard label="Criados hoje" valor={kpis.criados_hoje} cor={CORES.roxo} icone="📥" grande />
      </div>

      {/* Alertas vencimento */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <KpiCard label="Vencem hoje" valor={kpis.vencendo_hoje} cor={CORES.vermelho} icone="🔴" sub="Prioridade máxima" />
        <KpiCard label="Vencem em 3 dias" valor={kpis.vencendo_3dias} cor={CORES.amarelo} icone="🟡" sub="Atenção urgente" />
        <KpiCard label="Vencem em 7 dias" valor={kpis.vencendo_7dias} cor={CORES.azul} icone="🔵" sub="Monitorar" />
      </div>

      {/* Meta + Ranking + Vencendo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr', gap: '1rem' }}>

        {/* Meta */}
        <div style={{ background: CORES.card, border: `1px solid ${CORES.cardBorder}`, borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ fontSize: 12, color: CORES.subtexto, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
            🎯 Metas
          </div>
          <BarraMeta
            label="Meta do dia"
            atual={kpis.concluidos_hoje || 0}
            meta={META_DIA}
            cor={kpis.concluidos_hoje >= META_DIA ? CORES.verde : CORES.azul}
          />
          <BarraMeta
            label="Meta do mês"
            atual={kpis.concluidos_mes || 0}
            meta={META_MES}
            cor={kpis.concluidos_mes >= META_MES ? CORES.verde : CORES.roxo}
          />
          <div style={{ marginTop: '1rem', padding: '0.75rem', background: '#0f172a', borderRadius: 10, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: CORES.subtexto, marginBottom: 4 }}>Concluídos no mês</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: CORES.verde, fontFamily: "'Courier New', monospace" }}>
              {kpis.concluidos_mes || 0}
            </div>
          </div>
        </div>

        {/* Ranking */}
        <div style={{ background: CORES.card, border: `1px solid ${CORES.cardBorder}`, borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ fontSize: 12, color: CORES.subtexto, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
            🏆 Ranking do Mês
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {ranking.length === 0 ? (
              <p style={{ textAlign: 'center', color: CORES.subtexto, padding: '2rem' }}>Sem dados</p>
            ) : (
              ranking.map((r) => (
                <RankingItem key={r.posicao} {...r} />
              ))
            )}
          </div>
        </div>

        {/* Vencendo */}
        <div style={{ background: CORES.card, border: `1px solid ${CORES.cardBorder}`, borderRadius: 16, padding: '1.25rem' }}>
          <div style={{ fontSize: 12, color: CORES.subtexto, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '1rem' }}>
            ⏰ Próximos a Vencer
          </div>
          {vencendo.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: CORES.verde }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>🎉</div>
              <div style={{ fontSize: 13 }}>Nenhum protocolo vencendo nos próximos 7 dias</div>
            </div>
          ) : (
            <div>
              {vencendo.map((v, i) => <VencendoItem key={i} {...v} />)}
            </div>
          )}
        </div>
      </div>

      {/* Streak - Dias sem atraso */}
      <div style={{
        marginTop: '1rem',
        padding: '1.25rem 2rem',
        borderRadius: 16,
        background: diasSemAtraso === 0
          ? 'linear-gradient(135deg, #1c0a0a, #7f1d1d)'
          : diasSemAtraso >= 30
          ? 'linear-gradient(135deg, #1a0a2e, #3b0764)'
          : 'linear-gradient(135deg, #052e16, #065f46)',
        border: `1px solid ${
          diasSemAtraso === 0 ? '#ef444440'
          : diasSemAtraso >= 30 ? '#8b5cf640'
          : '#10b98140'
        }`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: diasSemAtraso === 0
            ? 'radial-gradient(ellipse at center, #ef444415 0%, transparent 70%)'
            : 'radial-gradient(ellipse at center, #10b98115 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {diasSemAtraso === null ? (
          <>
            <span style={{ fontSize: '2.5rem' }}>🏆</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981', letterSpacing: '0.05em' }}>
                NENHUM PROTOCOLO ATRASADO ATÉ HOJE!
              </div>
              <div style={{ fontSize: 13, color: '#6ee7b7', marginTop: 4 }}>
                Continue assim — excelente desempenho da equipe 💪
              </div>
            </div>
            <span style={{ fontSize: '2.5rem' }}>🏆</span>
          </>
        ) : diasSemAtraso === 0 ? (
          <>
            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444', letterSpacing: '0.05em' }}>
                ATENÇÃO — PROTOCOLO ATRASADO HOJE
              </div>
              <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 4 }}>
                Vamos recuperar o ritmo e manter os prazos em dia!
              </div>
            </div>
            <span style={{ fontSize: '2.5rem' }}>⚠️</span>
          </>
        ) : (() => {
          // Mensagens progressivas a cada 5 dias
          const faixas = [
            { min: 1,  max: 4,  emoji: '💪', cor: '#10b981', sub_cor: '#6ee7b7', msg: 'Ótimo começo! Vamos manter esse ritmo!' },
            { min: 5,  max: 9,  emoji: '⭐', cor: '#10b981', sub_cor: '#6ee7b7', msg: 'Cinco dias no prazo — a equipe está mandando bem!' },
            { min: 10, max: 14, emoji: '🌟', cor: '#34d399', sub_cor: '#a7f3d0', msg: 'Dez dias! A disciplina da equipe é inspiradora!' },
            { min: 15, max: 19, emoji: '🔥', cor: '#f59e0b', sub_cor: '#fde68a', msg: 'Quinze dias! Isso é compromisso com a excelência!' },
            { min: 20, max: 24, emoji: '🚀', cor: '#8b5cf6', sub_cor: '#c4b5fd', msg: 'Vinte dias! A equipe está em outro nível!' },
            { min: 25, max: 29, emoji: '💎', cor: '#38bdf8', sub_cor: '#bae6fd', msg: 'Vinte e cinco dias! Rumo ao recorde do mês!' },
            { min: 30, max: 44, emoji: '🏆', cor: '#a78bfa', sub_cor: '#ddd6fe', msg: 'Um mês inteiro! Vocês são extraordinários!' },
            { min: 45, max: 59, emoji: '🌠', cor: '#f472b6', sub_cor: '#fbcfe8', msg: 'Quarenta e cinco dias! Que marca histórica!' },
            { min: 60, max: 99, emoji: '👑', cor: '#fbbf24', sub_cor: '#fde68a', msg: 'Dois meses! Essa equipe é lendária!' },
            { min: 100, max: Infinity, emoji: '🎖️', cor: '#f59e0b', sub_cor: '#fef3c7', msg: 'Marca centenária! Isso é referência de excelência!' },
          ];
          const faixa = faixas.find(f => diasSemAtraso >= f.min && diasSemAtraso <= f.max) || faixas[0];

          return (
            <>
              <span style={{ fontSize: '3rem' }}>{faixa.emoji}</span>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: faixa.sub_cor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
                  Estamos há
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: '0.5rem' }}>
                  <span style={{
                    fontSize: '4rem',
                    fontWeight: 900,
                    color: faixa.cor,
                    fontFamily: "'Courier New', monospace",
                    lineHeight: 1,
                    textShadow: `0 0 30px ${faixa.cor}60`,
                  }}>
                    {diasSemAtraso}
                  </span>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: faixa.cor }}>
                    {diasSemAtraso === 1 ? 'dia' : 'dias'}
                  </span>
                </div>
                <div style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: faixa.sub_cor,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginTop: 2,
                }}>
                  SEM ATRASAR UM PROTOCOLO
                </div>
                <div style={{ fontSize: 13, color: faixa.sub_cor, marginTop: 6, opacity: 0.9, fontStyle: 'italic' }}>
                  {faixa.msg}
                </div>
              </div>
              <span style={{ fontSize: '3rem' }}>{faixa.emoji}</span>
            </>
          );
        })()}
      </div>

      {/* Rodapé */}
      <div style={{ textAlign: 'center', marginTop: '0.75rem', color: CORES.subtexto, fontSize: 11 }}>
        Atualização automática a cada 60 segundos • Dados em tempo real
      </div>
    </div>
  );
}
