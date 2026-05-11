import React, { useEffect, useState, useCallback } from 'react';
import './Usucapiao.css';
import {
  getUsucapiao, createUsucapiao, updateUsucapiao, deleteUsucapiao,
  getNotasUsucapiao, addNotaUsucapiao, registrarEmailUsucapiao, enviarEmailSmtp,
} from '../services/api';

// ── Configs ────────────────────────────────────────────────────────────────
const STATUS_CFG = {
  em_andamento: { label: 'Em andamento', color: '#3b82f6', bg: '#eff6ff' },
  concluido:    { label: 'Concluído',    color: '#10b981', bg: '#ecfdf5' },
  cancelado:    { label: 'Cancelado',    color: '#ef4444', bg: '#fef2f2' },
};
const TITULO_CFG = {
  usucapiao:   { label: 'Usucapião',   color: '#6366f1', bg: '#eef2ff' },
  adjudicacao: { label: 'Adjudicação', color: '#0891b2', bg: '#ecfeff' },
};
const FORM_VAZIO = {
  numero_recepcao:'', titulo:'usucapiao', nome_requerente:'', numero_matricula:'',
  responsavel_analise:'', email_cliente:'', data_entrada:'',
  data_envio_atendimento:'', data_envio_cliente:'', data_envio_email:'',
  status:'em_andamento', observacoes:'',
};

// ── Helpers ────────────────────────────────────────────────────────────────
const fmt = (d) => {
  if (!d) return null;
  const [y, m, day] = d.split('T')[0].split('-');
  return `${day}/${m}/${y}`;
};
const fmtHora = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleString('pt-BR', {
    day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit',
  });
};

// Retorna status visual do prazo — só calcula se a data existir
const prazoSt = (dataStr) => {
  if (!dataStr) return null;
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const prazo = new Date(dataStr.split('T')[0]); prazo.setHours(0, 0, 0, 0);
  const diff = Math.ceil((prazo - hoje) / 86400000);
  if (diff === 0) return { color:'#ef4444', txt:'Vence HOJE!',          blink: true };
  if (diff < 0)  return { color:'#ef4444', txt:`Vencido há ${Math.abs(diff)}d`, blink: false };
  if (diff <= 5) return { color:'#f59e0b', txt:`${diff}d restantes`,    blink: false };
  return               { color:'#10b981', txt:`${diff}d restantes`,    blink: false };
};

const Badge = ({ cfg }) => (
  <span style={{ background:cfg.bg, color:cfg.color, padding:'0.2rem 0.65rem', borderRadius:'999px', fontSize:'0.75rem', fontWeight:700, whiteSpace:'nowrap' }}>
    {cfg.label}
  </span>
);

// Célula de prazo na tabela — pisca se vence hoje
const PrazoCell = ({ data }) => {
  if (!data) return <span style={{ color:'#cbd5e1' }}>—</span>;
  const st = prazoSt(data);
  if (!st) return <span style={{ color:'#cbd5e1' }}>—</span>;
  return (
    <div className={st.blink ? 'prazo-vence-hoje-cell' : ''}>
      <div style={{ fontWeight:600, fontSize:'0.875rem', color: st.blink ? undefined : st.color }}>{fmt(data)}</div>
      <div style={{ fontSize:'0.72rem', fontWeight:600, color: st.blink ? undefined : st.color, marginTop:2 }}>{st.txt}</div>
    </div>
  );
};

// Card de prazo no painel detalhe
const PrazoCard = ({ label, data, aviso }) => {
  const st = data ? prazoSt(data) : null;
  return (
    <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'0.625rem 0.75rem' }}>
      <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.2rem' }}>{label}</div>
      {data ? (
        <>
          <div className={st?.blink ? 'prazo-vence-hoje' : ''} style={{ fontWeight:700, color: st?.blink ? undefined : (st?.color || '#1e293b'), fontSize:'0.875rem', display:'inline-block' }}>
            {fmt(data)}
          </div>
          {st && <div style={{ fontSize:'0.72rem', color: st.blink ? undefined : st.color, fontWeight:600, marginTop:2 }}>{st.txt}</div>}
        </>
      ) : (
        <div style={{ color:'#cbd5e1', fontSize:'0.875rem' }}>
          {aviso || '—'}
        </div>
      )}
    </div>
  );
};

const inp = { width:'100%', padding:'0.65rem 0.875rem', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'0.9rem', outline:'none', boxSizing:'border-box', background:'white', fontFamily:'inherit' };
const focusC = (e) => (e.target.style.borderColor = '#6366f1');
const blurC  = (e) => (e.target.style.borderColor = '#e2e8f0');

const Sec = ({ title }) => (
  <div style={{ gridColumn:'span 2', fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.07em', paddingBottom:'0.25rem', borderBottom:'1px solid #f1f5f9', marginTop:'0.5rem' }}>
    {title}
  </div>
);
const F = ({ label, required, span2, children, hint }) => (
  <div style={{ gridColumn: span2 ? 'span 2' : 'span 1' }}>
    <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#374151', marginBottom:'0.3rem' }}>
      {label}{required && <span style={{ color:'#ef4444' }}> *</span>}
    </label>
    {children}
    {hint && <div style={{ fontSize:'0.72rem', color:'#94a3b8', marginTop:'0.25rem' }}>{hint}</div>}
  </div>
);

// ── Componente Principal ───────────────────────────────────────────────────
export default function Usucapiao({ usuario }) {
  const [lista, setLista]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busca, setBusca]       = useState('');
  const [filtroSt, setFiltroSt] = useState('');
  const [msg, setMsg]           = useState({ type:'', text:'' });

  const [modal, setModal]       = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm]         = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [formErr, setFormErr]   = useState('');

  const [detalhe, setDetalhe]   = useState(null);
  const [aba, setAba]           = useState('dados');
  const [notas, setNotas]       = useState([]);
  const [novaNota, setNovaNota] = useState('');
  const [salvandoNota, setSalvandoNota] = useState(false);

  const [delConfirm, setDelConfirm] = useState(null);

  const [emailModal, setEmailModal]       = useState(null); // { tipo, destinatario, assunto, corpo }
  const [enviandoEmail, setEnviandoEmail] = useState(false);
  const [emailErro, setEmailErro]         = useState('');

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const carregar = useCallback(async () => {
    setLoading(true);
    try { setLista(await getUsucapiao({ status: filtroSt, busca })); }
    catch (e) { showMsg('erro', e.message); }
    finally { setLoading(false); }
  }, [filtroSt, busca]);

  useEffect(() => { carregar(); }, [carregar]);

  const carregarNotas = useCallback(async (id) => {
    try { setNotas(await getNotasUsucapiao(id)); }
    catch (e) { showMsg('erro', e.message); }
  }, []);

  useEffect(() => {
    if (detalhe && aba === 'notas') carregarNotas(detalhe.id);
  }, [detalhe, aba, carregarNotas]);

  const showMsg = (type, text) => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type:'', text:'' }), 4000);
  };

  const abrirNovo = () => { setEditando(null); setForm(FORM_VAZIO); setFormErr(''); setModal(true); };

  const abrirEdicao = (reg) => {
    setEditando(reg);
    setForm({
      numero_recepcao:        reg.numero_recepcao || '',
      titulo:                 reg.titulo || 'usucapiao',
      nome_requerente:        reg.nome_requerente || '',
      numero_matricula:       reg.numero_matricula || '',
      responsavel_analise:    reg.responsavel_analise || '',
      email_cliente:          reg.email_cliente || '',
      data_entrada:           reg.data_entrada?.split('T')[0] || '',
      data_envio_atendimento: reg.data_envio_atendimento?.split('T')[0] || '',
      data_envio_cliente:     reg.data_envio_cliente?.split('T')[0] || '',
      data_envio_email:       reg.data_envio_email?.split('T')[0] || '',
      status:                 reg.status || 'em_andamento',
      observacoes:            reg.observacoes || '',
    });
    setFormErr(''); setModal(true);
  };

  const salvar = async (e) => {
    e.preventDefault();
    if (!form.nome_requerente || !form.data_entrada || !form.numero_matricula) {
      setFormErr('Preencha: Requerente, Data de Entrada e Matrícula.'); return;
    }
    setSalvando(true); setFormErr('');
    try {
      let atualizado;
      if (editando) atualizado = await updateUsucapiao(editando.id, form);
      else          atualizado = await createUsucapiao(form);
      showMsg('ok', editando ? 'Registro atualizado.' : 'Registro cadastrado.');
      setModal(false);
      if (detalhe && editando?.id === detalhe.id) setDetalhe(atualizado);
      carregar();
    } catch (e) { setFormErr(e.message); }
    finally { setSalvando(false); }
  };

  const excluir = async (id) => {
    try {
      await deleteUsucapiao(id);
      setDelConfirm(null);
      if (detalhe?.id === id) setDetalhe(null);
      showMsg('ok', 'Registro excluído.');
      carregar();
    } catch (e) { showMsg('erro', e.message); }
  };

  const addNota = async () => {
    if (!novaNota.trim() || !detalhe) return;
    setSalvandoNota(true);
    try {
      await addNotaUsucapiao(detalhe.id, novaNota);
      setNovaNota('');
      carregarNotas(detalhe.id);
    } catch (e) { showMsg('erro', e.message); }
    finally { setSalvandoNota(false); }
  };

  const abrirModalEmail = (tipo) => {
    if (!detalhe) return;
    if (!detalhe.email_cliente) { showMsg('erro', 'Cadastre o email do cliente primeiro.'); return; }
    const tit     = TITULO_CFG[detalhe.titulo]?.label || 'Usucapião';
    const nome    = detalhe.nome_requerente;
    const mat     = detalhe.numero_matricula;
    const rec     = detalhe.numero_recepcao || '—';
    const entrada = fmt(detalhe.data_entrada) || '—';
    const atend   = fmt(detalhe.data_envio_atendimento) || '—';
    const cli     = fmt(detalhe.data_envio_cliente) || '—';

    const corpoCliente =
`Cumpre-nos informar que referente à solicitação de reconhecimento de usucapião extrajudicial, ingresso nesta Serventia em ${entrada}, sob protocolo nº ${mat}, recepção ${rec}, cujo requerente é o Sr. ${nome}, foi emitida Nota Técnica Devolutiva, datada de ${atend}, devidamente encaminhada para o interessado aos ${cli}. Temos a informar que até a presente data não houve impulsionamento do procedimento, para atendimento às exigências apontadas em nota devolutiva, decorrendo um lapso temporal de 20 (vinte) dias úteis, com omissão da interessada em atender às exigências legais, previsto na legislação acerca da usucapião.

Portanto, com fulcro no art. 406, §2.º, do Provimento nº 149/2023-CNJ c/c art. 205 da Lei nº 6.015/73 e art. 1.032 §2º do Provimento 531/2026-CGJ/AM, esta Serventia, por meio deste, notifica o requerente, Sr. ${nome}, fixando o prazo preclusivo de 15 (quinze) dias úteis, com advertência de encerramento por desídia e cancelamento da prenotação, estando o novo pedido sujeito a recolhimento de emolumentos e processamento de prenotação, em novo protocolo.`;

    const corpoManifestacao =
`Cumpre-nos informar que referente à solicitação de reconhecimento de usucapião extrajudicial, ingresso nesta Serventia em ${entrada}, sob protocolo nº ${mat}, recepção ${rec}, cujo requerente é o Sr. ${nome}, foi emitida Nota Técnica Devolutiva, datada de ${atend}, devidamente encaminhada para o interessado aos ${cli}. Temos a informar que até a presente data não houve impulsionamento do procedimento, para atendimento às exigências apontadas em nota devolutiva, decorrendo um lapso temporal de 20 (vinte) dias úteis, com omissão da interessada em atender às exigências legais, previsto na legislação acerca da usucapião.

Portanto, com fulcro no art. 406, §2.º, do Provimento nº 149/2023-CNJ c/c art. 205 da Lei nº 6.015/73 e art. 1.032 §2º do Provimento 531/2026-CGJ/AM, esta Serventia, por meio deste, notifica o requerente, Sr. ${nome}, fixando o prazo preclusivo de 15 (quinze) dias úteis, com advertência de encerramento por desídia e cancelamento da prenotação, estando o novo pedido sujeito a recolhimento de emolumentos e processamento de prenotação, em novo protocolo.`;

    setEmailModal({
      tipo,
      destinatario: detalhe.email_cliente,
      assunto: tipo === 'cliente'
        ? `Notificação de Pendência — ${tit} — Matrícula ${mat}`
        : `Notificação de Desídia — ${tit} — Matrícula ${mat} — Prazo Preclusivo 15 dias úteis`,
      corpo: tipo === 'cliente' ? corpoCliente : corpoManifestacao,
    });
    setEmailErro('');
  };

  const confirmarEnvioEmail = async () => {
    if (!emailModal || !detalhe) return;
    setEnviandoEmail(true); setEmailErro('');
    try {
      await enviarEmailSmtp(detalhe.id, {
        assunto:     emailModal.assunto,
        corpo:       emailModal.corpo,
        destinatario: emailModal.destinatario,
      });
      await registrarEmailUsucapiao(detalhe.id, emailModal.tipo);
      setEmailModal(null);
      if (aba === 'notas') carregarNotas(detalhe.id);
      showMsg('ok', `✅ Email enviado para ${emailModal.destinatario} com sucesso!`);
    } catch (e) {
      setEmailErro(e.message);
    } finally {
      setEnviandoEmail(false);
    }
  };

  const canEdit = ['Supervisor','Coordenador','Registrador'].includes(usuario?.cargo);
  const abrirDetalhe = (reg) => { setDetalhe(reg); setAba('dados'); setNovaNota(''); };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'2rem', maxWidth:'1300px', margin:'0 auto' }}>

      {/* Cabeçalho */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'1.75rem', flexWrap:'wrap', gap:'1rem' }}>
        <div>
          <h1 style={{ fontSize:'1.75rem', fontWeight:700, color:'#1e293b', margin:0, display:'flex', alignItems:'center', gap:'0.75rem' }}>
            <span style={{ fontSize:'2rem' }}>🏡</span> Usucapião
          </h1>
          <p style={{ color:'#64748b', marginTop:'0.25rem', fontSize:'0.9375rem' }}>
            Gerenciamento de processos de usucapião e adjudicação
          </p>
        </div>
        {canEdit && (
          <button onClick={abrirNovo} style={{ background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'12px', padding:'0.75rem 1.5rem', fontWeight:600, fontSize:'0.9375rem', cursor:'pointer', display:'flex', alignItems:'center', gap:'0.5rem', boxShadow:'0 4px 12px rgba(99,102,241,.35)' }}>
            <span style={{ fontSize:'1.2rem' }}>+</span> Novo Cadastro
          </button>
        )}
      </div>

      {/* Toast */}
      {msg.text && (
        <div style={{ background: msg.type==='ok' ? '#ecfdf5' : '#fef2f2', border:`1px solid ${msg.type==='ok' ? '#6ee7b7' : '#fca5a5'}`, borderRadius:'10px', padding:'0.875rem 1.25rem', marginBottom:'1.25rem', color: msg.type==='ok' ? '#065f46' : '#991b1b', fontWeight:500 }}>
          {msg.text}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display:'flex', gap:'1rem', marginBottom:'1.25rem', flexWrap:'wrap' }}>
        <input value={busca} onChange={e => setBusca(e.target.value)} onKeyDown={e => e.key==='Enter' && carregar()}
          placeholder="Buscar por requerente, matrícula ou N° recepção..."
          style={{ flex:1, minWidth:'220px', ...inp }} />
        <select value={filtroSt} onChange={e => setFiltroSt(e.target.value)} style={{ ...inp, width:'auto', minWidth:'155px' }}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <button onClick={carregar} style={{ padding:'0.65rem 1.25rem', border:'1px solid #e2e8f0', borderRadius:'8px', background:'white', cursor:'pointer', fontWeight:500, color:'#475569' }}>
          Buscar
        </button>
      </div>

      {/* Layout tabela + painel */}
      <div style={{ display:'flex', gap:'1.5rem', alignItems:'flex-start' }}>

        {/* Tabela */}
        <div style={{ flex:1, background:'white', borderRadius:'16px', border:'1px solid #e2e8f0', overflow:'hidden', boxShadow:'0 1px 8px rgba(0,0,0,.05)', minWidth:0 }}>
          <div style={{ padding:'0.875rem 1.25rem', borderBottom:'1px solid #f1f5f9', color:'#64748b', fontSize:'0.875rem' }}>
            {loading ? 'Carregando...' : `${lista.length} registro${lista.length!==1?'s':''}`}
          </div>
          {!loading && lista.length === 0 ? (
            <div style={{ padding:'3rem', textAlign:'center', color:'#94a3b8' }}>
              <div style={{ fontSize:'2.5rem', marginBottom:'0.75rem' }}>🏡</div>
              <p style={{ fontWeight:500 }}>Nenhum registro encontrado.</p>
              {canEdit && <button onClick={abrirNovo} style={{ marginTop:'1rem', color:'#6366f1', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>+ Cadastrar primeiro registro</button>}
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'0.875rem' }}>
                <thead>
                  <tr style={{ background:'#f8fafc', borderBottom:'1px solid #e2e8f0' }}>
                    {['N° Recepção','Título','Requerente','Matrícula','Atendimento','Status','Prazo Desídia','Fim Manifest.',''].map((h,i) => (
                      <th key={i} style={{ padding:'0.75rem 1rem', textAlign:'left', fontSize:'0.72rem', fontWeight:700, color:'#475569', textTransform:'uppercase', letterSpacing:'0.04em', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lista.map(reg => {
                    const st  = STATUS_CFG[reg.status] || STATUS_CFG.em_andamento;
                    const tit = TITULO_CFG[reg.titulo]  || TITULO_CFG.usucapiao;
                    const ativo = detalhe?.id === reg.id;
                    return (
                      <tr key={reg.id} onClick={() => abrirDetalhe(reg)}
                        style={{ borderBottom:'1px solid #f1f5f9', cursor:'pointer', background: ativo ? '#f0f4ff' : 'white', transition:'background .15s' }}
                        onMouseEnter={e => { if(!ativo) e.currentTarget.style.background='#f8fafc'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ativo ? '#f0f4ff' : 'white'; }}
                      >
                        <td style={{ padding:'0.75rem 1rem', fontWeight:600, color:'#6366f1' }}>
                          {reg.numero_recepcao || <span style={{ color:'#cbd5e1' }}>—</span>}
                        </td>
                        <td style={{ padding:'0.75rem 1rem' }}><Badge cfg={tit}/></td>
                        <td style={{ padding:'0.75rem 1rem', fontWeight:600, color:'#1e293b', whiteSpace:'nowrap' }}>{reg.nome_requerente}</td>
                        <td style={{ padding:'0.75rem 1rem', color:'#475569', fontFamily:'monospace' }}>{reg.numero_matricula}</td>
                        <td style={{ padding:'0.75rem 1rem' }}>
                          {reg.data_envio_atendimento ? (
                            <div>
                              <div style={{ display:'flex', alignItems:'center', gap:'0.35rem' }}>
                                <span style={{ color:'#10b981', fontSize:'1rem' }}>✅</span>
                                <span style={{ fontWeight:600, color:'#1e293b', fontSize:'0.875rem' }}>{fmt(reg.data_envio_atendimento)}</span>
                              </div>
                              {reg.enviado_atendimento_por && (
                                <div style={{ fontSize:'0.72rem', color:'#64748b', marginTop:'2px' }}>
                                  por {reg.enviado_atendimento_por}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ color:'#cbd5e1', fontSize:'0.875rem' }}>Pendente</span>
                          )}
                        </td>
                        <td style={{ padding:'0.75rem 1rem' }}><Badge cfg={st}/></td>
                        {/* Prazo só aparece se data_envio_cliente preenchida */}
                        <td style={{ padding:'0.75rem 1rem' }}>
                          {reg.data_envio_cliente
                            ? <PrazoCell data={reg.prazo_desidia}/>
                            : <span style={{ fontSize:'0.75rem', color:'#94a3b8', fontStyle:'italic' }}>Aguard. envio cliente</span>
                          }
                        </td>
                        <td style={{ padding:'0.75rem 1rem' }}>
                          {reg.data_envio_email
                            ? <PrazoCell data={reg.fim_prazo_manifestacao}/>
                            : <span style={{ fontSize:'0.75rem', color:'#94a3b8', fontStyle:'italic' }}>Aguard. envio email</span>
                          }
                        </td>
                        <td style={{ padding:'0.75rem 1rem' }}>
                          <span style={{ fontSize:'0.8rem', color:'#6366f1', fontWeight:600 }}>Abrir →</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Painel de Detalhe */}
        {detalhe && (
          <div style={{ width:'400px', flexShrink:0, background:'white', borderRadius:'16px', border:'1px solid #e2e8f0', boxShadow:'0 4px 24px rgba(0,0,0,.08)', display:'flex', flexDirection:'column', maxHeight:'82vh', overflow:'hidden' }}>

            {/* Header */}
            <div style={{ padding:'1.25rem 1.5rem', borderBottom:'1px solid #e2e8f0', background:'linear-gradient(135deg,#6366f1,#4f46e5)', flexShrink:0 }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ color:'rgba(255,255,255,.8)', fontSize:'0.75rem', fontWeight:600, marginBottom:'0.25rem' }}>
                    {TITULO_CFG[detalhe.titulo]?.label} · {detalhe.numero_matricula}
                  </div>
                  <div style={{ color:'white', fontWeight:700, fontSize:'1.05rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {detalhe.nome_requerente}
                  </div>
                  {detalhe.numero_recepcao && (
                    <div style={{ color:'rgba(255,255,255,.75)', fontSize:'0.8rem', marginTop:'0.2rem' }}>N° {detalhe.numero_recepcao}</div>
                  )}
                </div>
                <button onClick={() => setDetalhe(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:'8px', color:'white', cursor:'pointer', width:'30px', height:'30px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:'0.75rem' }}>✕</button>
              </div>
              <div style={{ marginTop:'0.75rem' }}>
                <Badge cfg={STATUS_CFG[detalhe.status] || STATUS_CFG.em_andamento}/>
              </div>
            </div>

            {/* Abas */}
            <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', flexShrink:0 }}>
              {[['dados','📋 Dados'],['notas','📝 Notas']].map(([k,l]) => (
                <button key={k} onClick={() => setAba(k)} style={{
                  flex:1, padding:'0.75rem', border:'none',
                  background: aba===k ? 'white' : '#f8fafc',
                  borderBottom: aba===k ? '2px solid #6366f1' : '2px solid transparent',
                  color: aba===k ? '#6366f1' : '#64748b',
                  fontWeight:600, fontSize:'0.875rem', cursor:'pointer',
                }}>{l}</button>
              ))}
            </div>

            {/* Conteúdo */}
            <div style={{ flex:1, overflowY:'auto', padding:'1.25rem 1.5rem' }}>

              {/* ── ABA DADOS ── */}
              {aba === 'dados' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>

                  {/* Envio para Atendimento com confirmação visual */}
                  <div style={{ background: detalhe.data_envio_atendimento ? '#f0fdf4' : '#fafafa', border:`1px solid ${detalhe.data_envio_atendimento ? '#86efac' : '#e2e8f0'}`, borderRadius:'10px', padding:'0.875rem 1rem' }}>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'0.4rem' }}>
                      Envio para Atendimento
                    </div>
                    {detalhe.data_envio_atendimento ? (
                      <div style={{ display:'flex', alignItems:'flex-start', gap:'0.5rem' }}>
                        <span style={{ fontSize:'1.5rem', lineHeight:1 }}>✅</span>
                        <div>
                          <div style={{ fontWeight:700, color:'#15803d', fontSize:'0.9rem' }}>
                            Enviado em {fmt(detalhe.data_envio_atendimento)}
                          </div>
                          {detalhe.enviado_atendimento_por && (
                            <div style={{ fontSize:'0.8rem', color:'#16a34a', marginTop:'2px' }}>
                              por <strong>{detalhe.enviado_atendimento_por}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div style={{ color:'#94a3b8', fontSize:'0.875rem', fontStyle:'italic' }}>Ainda não enviado para atendimento</div>
                    )}
                  </div>

                  {/* Cards de prazos */}
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.75rem' }}>
                    <PrazoCard label="Entrada" data={detalhe.data_entrada ? detalhe.data_entrada.split('T')[0] : null}/>
                    <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'0.625rem 0.75rem' }}>
                      <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.2rem' }}>Responsável</div>
                      <div style={{ fontWeight:600, color:'#1e293b', fontSize:'0.875rem' }}>{detalhe.responsavel_analise || '—'}</div>
                    </div>

                    {/* Prazo Desídia — só conta se data_envio_cliente preenchida */}
                    <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'0.625rem 0.75rem' }}>
                      <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.2rem' }}>Envio p/ Cliente</div>
                      <div style={{ fontWeight:600, color:'#1e293b', fontSize:'0.875rem' }}>{fmt(detalhe.data_envio_cliente) || '—'}</div>
                    </div>
                    <div>
                      <PrazoCard
                        label="Prazo Desídia (20 d.u.)"
                        data={detalhe.data_envio_cliente ? detalhe.prazo_desidia : null}
                        aviso="Preencha envio p/ cliente para iniciar contagem"
                      />
                    </div>

                    {/* Fim Manifestação — só conta se data_envio_email preenchida */}
                    <div style={{ background:'#f8fafc', borderRadius:'8px', padding:'0.625rem 0.75rem' }}>
                      <div style={{ fontSize:'0.72rem', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', marginBottom:'0.2rem' }}>Envio do Email</div>
                      <div style={{ fontWeight:600, color:'#1e293b', fontSize:'0.875rem' }}>{fmt(detalhe.data_envio_email) || '—'}</div>
                    </div>
                    <div>
                      <PrazoCard
                        label="Fim Manifestação (15 d.u.)"
                        data={detalhe.data_envio_email ? detalhe.fim_prazo_manifestacao : null}
                        aviso="Preencha envio do email para iniciar contagem"
                      />
                    </div>
                  </div>

                  {/* Email e obs */}
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:'0.875rem', display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                    <div style={{ fontSize:'0.8rem', color:'#64748b', wordBreak:'break-all' }}>
                      <span style={{ fontWeight:600 }}>Email cliente:</span>{' '}
                      {detalhe.email_cliente
                        ? <a href={`mailto:${detalhe.email_cliente}`} style={{ color:'#6366f1' }}>{detalhe.email_cliente}</a>
                        : <span style={{ color:'#cbd5e1' }}>não cadastrado</span>}
                    </div>
                    {detalhe.observacoes && (
                      <div style={{ fontSize:'0.8rem', color:'#64748b' }}>
                        <span style={{ fontWeight:600 }}>Obs:</span> {detalhe.observacoes}
                      </div>
                    )}
                  </div>

                  {/* Ações */}
                  <div style={{ borderTop:'1px solid #f1f5f9', paddingTop:'0.875rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                    <div style={{ fontSize:'0.72rem', fontWeight:700, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.06em' }}>Ações</div>
                    <button onClick={() => abrirModalEmail('cliente')} style={{ padding:'0.65rem 1rem', background:'linear-gradient(135deg,#0891b2,#0e7490)', color:'white', border:'none', borderRadius:'9px', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', textAlign:'left' }}>
                      📧 Enviar email p/ cliente — prazo desídia (20 d.u.)
                    </button>
                    <button onClick={() => abrirModalEmail('email')} style={{ padding:'0.65rem 1rem', background:'linear-gradient(135deg,#7c3aed,#6d28d9)', color:'white', border:'none', borderRadius:'9px', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', textAlign:'left' }}>
                      📨 Notificar desídia — prazo preclusivo (15 d.u.)
                    </button>
                    {canEdit && (
                      <div style={{ display:'flex', gap:'0.5rem', marginTop:'0.25rem' }}>
                        <button onClick={() => abrirEdicao(detalhe)} style={{ flex:1, padding:'0.65rem', border:'1px solid #e2e8f0', borderRadius:'9px', background:'white', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', color:'#475569' }}>
                          ✏️ Editar
                        </button>
                        <button onClick={() => setDelConfirm(detalhe)} style={{ flex:1, padding:'0.65rem', border:'1px solid #fca5a5', borderRadius:'9px', background:'#fef2f2', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', color:'#ef4444' }}>
                          🗑️ Excluir
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ABA NOTAS ── */}
              {aba === 'notas' && (
                <div style={{ display:'flex', flexDirection:'column', gap:'1rem' }}>
                  <div style={{ background:'#f8fafc', borderRadius:'10px', padding:'1rem', display:'flex', flexDirection:'column', gap:'0.625rem' }}>
                    <label style={{ fontSize:'0.8rem', fontWeight:600, color:'#374151' }}>Nova nota</label>
                    <textarea
                      value={novaNota} onChange={e => setNovaNota(e.target.value)}
                      placeholder="Descreva o que foi feito, decisão tomada, informação relevante..."
                      rows={3}
                      style={{ ...inp, resize:'vertical' }}
                      onFocus={focusC} onBlur={blurC}
                    />
                    <button onClick={addNota} disabled={salvandoNota || !novaNota.trim()} style={{ alignSelf:'flex-end', padding:'0.5rem 1.25rem', background:'#6366f1', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', fontWeight:600, fontSize:'0.875rem', opacity: (!novaNota.trim() || salvandoNota) ? 0.5 : 1 }}>
                      {salvandoNota ? 'Salvando...' : 'Adicionar nota'}
                    </button>
                  </div>
                  {notas.length === 0 ? (
                    <div style={{ textAlign:'center', color:'#94a3b8', padding:'1.5rem 0', fontSize:'0.875rem' }}>Nenhuma nota registrada.</div>
                  ) : notas.map(n => (
                    <div key={n.id} style={{ borderLeft:'3px solid #6366f1', paddingLeft:'0.875rem', paddingBottom:'0.25rem' }}>
                      <div style={{ fontSize:'0.72rem', color:'#94a3b8', fontWeight:600, marginBottom:'0.3rem', display:'flex', justifyContent:'space-between' }}>
                        <span>{n.usuario_nome || 'Sistema'}</span>
                        <span>{fmtHora(n.created_at)}</span>
                      </div>
                      <div style={{ fontSize:'0.875rem', color:'#1e293b', lineHeight:1.55, whiteSpace:'pre-wrap' }}>{n.nota}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Cadastro/Edição ── */}
      {modal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'1rem' }}>
          <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'660px', boxShadow:'0 25px 60px rgba(0,0,0,.2)', overflow:'hidden', maxHeight:'93vh', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'1.25rem 1.75rem', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center', background:'linear-gradient(135deg,#6366f1,#4f46e5)', flexShrink:0 }}>
              <h2 style={{ margin:0, color:'white', fontSize:'1.1rem', fontWeight:700 }}>
                🏡 {editando ? 'Editar Processo' : 'Novo Cadastro'}
              </h2>
              <button onClick={() => setModal(false)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:'8px', color:'white', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
            <form onSubmit={salvar} style={{ padding:'1.5rem 1.75rem', overflowY:'auto', flex:1 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1rem' }}>
                <Sec title="Identificação"/>
                <F label="N° da Recepção" half><input value={form.numero_recepcao} onChange={set('numero_recepcao')} placeholder="Ex: 001/2026" style={inp} onFocus={focusC} onBlur={blurC}/></F>
                <F label="Título" half><select value={form.titulo} onChange={set('titulo')} style={inp} onFocus={focusC} onBlur={blurC}><option value="usucapiao">Usucapião</option><option value="adjudicacao">Adjudicação</option></select></F>
                <F label="Nome do Requerente" required span2><input value={form.nome_requerente} onChange={set('nome_requerente')} placeholder="Nome completo" style={inp} onFocus={focusC} onBlur={blurC}/></F>
                <F label="Número de Matrícula" required half><input value={form.numero_matricula} onChange={set('numero_matricula')} placeholder="Ex: 12345" style={inp} onFocus={focusC} onBlur={blurC}/></F>
                <F label="Responsável pela Análise" half><input value={form.responsavel_analise} onChange={set('responsavel_analise')} placeholder="Nome do responsável" style={inp} onFocus={focusC} onBlur={blurC}/></F>
                <F label="Email do Cliente" span2><input type="email" value={form.email_cliente} onChange={set('email_cliente')} placeholder="cliente@email.com" style={inp} onFocus={focusC} onBlur={blurC}/></F>

                <Sec title="Datas"/>
                <F label="Data de Entrada" required half><input type="date" value={form.data_entrada} onChange={set('data_entrada')} style={inp} onFocus={focusC} onBlur={blurC}/></F>
                <F label="Data de Envio p/ Atendimento" half hint="O nome de quem preencher este campo será registrado automaticamente.">
                  <input type="date" value={form.data_envio_atendimento} onChange={set('data_envio_atendimento')} style={inp} onFocus={focusC} onBlur={blurC}/>
                </F>

                <Sec title="Prazos"/>
                <F label="Envio p/ Cliente — início desídia (20 d.u.)" half hint="A contagem só inicia quando este campo for preenchido.">
                  <input type="date" value={form.data_envio_cliente} onChange={set('data_envio_cliente')} style={inp} onFocus={focusC} onBlur={blurC}/>
                </F>
                <F label="Envio do Email — início manifestação (15 d.u.)" half hint="A contagem só inicia quando este campo for preenchido.">
                  <input type="date" value={form.data_envio_email} onChange={set('data_envio_email')} style={inp} onFocus={focusC} onBlur={blurC}/>
                </F>

                <Sec title="Situação"/>
                <F label="Status" half><select value={form.status} onChange={set('status')} style={inp} onFocus={focusC} onBlur={blurC}>{Object.entries(STATUS_CFG).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}</select></F>
                <F label="Observações" span2><textarea value={form.observacoes} onChange={set('observacoes')} placeholder="Informações adicionais..." rows={2} style={{...inp,resize:'vertical'}} onFocus={focusC} onBlur={blurC}/></F>
              </div>

              {formErr && <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'0.75rem 1rem', color:'#991b1b', fontSize:'0.875rem', marginTop:'1rem' }}>{formErr}</div>}

              <div style={{ display:'flex', gap:'0.75rem', justifyContent:'flex-end', paddingTop:'1.25rem' }}>
                <button type="button" onClick={() => setModal(false)} style={{ padding:'0.7rem 1.5rem', border:'1px solid #e2e8f0', borderRadius:'10px', background:'white', cursor:'pointer', fontWeight:600, color:'#475569' }}>Cancelar</button>
                <button type="submit" disabled={salvando} style={{ padding:'0.7rem 1.75rem', background:'linear-gradient(135deg,#6366f1,#4f46e5)', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:700, opacity:salvando?0.7:1 }}>
                  {salvando ? 'Salvando...' : editando ? 'Salvar Alterações' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Envio de Email ── */}
      {emailModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:'1rem' }}>
          <div style={{ background:'white', borderRadius:'20px', width:'100%', maxWidth:'680px', boxShadow:'0 25px 60px rgba(0,0,0,.25)', overflow:'hidden', maxHeight:'95vh', display:'flex', flexDirection:'column' }}>

            {/* Header */}
            <div style={{ padding:'1.25rem 1.75rem', background:'linear-gradient(135deg,#0891b2,#0369a1)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div>
                <h2 style={{ margin:0, color:'white', fontSize:'1.1rem', fontWeight:700 }}>
                  📧 {emailModal.tipo === 'cliente' ? 'Email ao Cliente — Prazo Desídia' : 'Notificação de Desídia — Prazo Preclusivo'}
                </h2>
                <p style={{ margin:'0.2rem 0 0', color:'rgba(255,255,255,.75)', fontSize:'0.8rem' }}>
                  Confirme os dados antes de enviar. Você pode editar o conteúdo.
                </p>
              </div>
              <button onClick={() => setEmailModal(null)} style={{ background:'rgba(255,255,255,.2)', border:'none', borderRadius:'8px', color:'white', cursor:'pointer', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginLeft:'1rem' }}>✕</button>
            </div>

            <div style={{ overflowY:'auto', flex:1, padding:'1.5rem 1.75rem', display:'flex', flexDirection:'column', gap:'1rem' }}>

              {/* Resumo do processo */}
              <div style={{ background:'#f0f9ff', border:'1px solid #bae6fd', borderRadius:'10px', padding:'0.875rem 1rem', fontSize:'0.85rem' }}>
                <div style={{ fontWeight:700, color:'#0369a1', marginBottom:'0.4rem', fontSize:'0.8rem', textTransform:'uppercase', letterSpacing:'0.06em' }}>Processo</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.25rem 1.5rem', color:'#0c4a6e' }}>
                  <span><strong>Requerente:</strong> {detalhe?.nome_requerente}</span>
                  <span><strong>Matrícula:</strong> {detalhe?.numero_matricula}</span>
                  <span><strong>N° Recepção:</strong> {detalhe?.numero_recepcao || '—'}</span>
                  <span><strong>Entrada:</strong> {fmt(detalhe?.data_entrada) || '—'}</span>
                </div>
              </div>

              {/* Destinatário */}
              <div>
                <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#374151', marginBottom:'0.3rem' }}>
                  Destinatário <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <input
                  type="email"
                  value={emailModal.destinatario}
                  onChange={e => setEmailModal(m => ({ ...m, destinatario: e.target.value }))}
                  style={{ ...inp }}
                  onFocus={focusC} onBlur={blurC}
                />
              </div>

              {/* Assunto */}
              <div>
                <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#374151', marginBottom:'0.3rem' }}>
                  Assunto <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={emailModal.assunto}
                  onChange={e => setEmailModal(m => ({ ...m, assunto: e.target.value }))}
                  style={{ ...inp }}
                  onFocus={focusC} onBlur={blurC}
                />
              </div>

              {/* Corpo */}
              <div>
                <label style={{ display:'block', fontSize:'0.8rem', fontWeight:600, color:'#374151', marginBottom:'0.3rem' }}>
                  Mensagem <span style={{ color:'#ef4444' }}>*</span>
                </label>
                <textarea
                  value={emailModal.corpo}
                  onChange={e => setEmailModal(m => ({ ...m, corpo: e.target.value }))}
                  rows={14}
                  style={{ ...inp, resize:'vertical', fontFamily:'inherit', lineHeight:1.6 }}
                  onFocus={focusC} onBlur={blurC}
                />
              </div>

              {emailErro && (
                <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:'8px', padding:'0.75rem 1rem', color:'#991b1b', fontSize:'0.875rem' }}>
                  ⚠️ {emailErro}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div style={{ padding:'1rem 1.75rem', borderTop:'1px solid #e2e8f0', display:'flex', gap:'0.75rem', justifyContent:'flex-end', background:'#f8fafc', flexShrink:0 }}>
              <div style={{ flex:1, fontSize:'0.78rem', color:'#64748b', alignSelf:'center' }}>
                Enviando como <strong>registros@1rimanaus.com.br</strong> via SMTP
              </div>
              <button onClick={() => setEmailModal(null)} style={{ padding:'0.7rem 1.5rem', border:'1px solid #e2e8f0', borderRadius:'10px', background:'white', cursor:'pointer', fontWeight:600, color:'#475569', fontSize:'0.9rem' }}>
                Cancelar
              </button>
              <button
                onClick={confirmarEnvioEmail}
                disabled={enviandoEmail || !emailModal.destinatario || !emailModal.assunto || !emailModal.corpo}
                style={{ padding:'0.7rem 1.75rem', background:'linear-gradient(135deg,#0891b2,#0369a1)', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:700, fontSize:'0.9rem', opacity: (enviandoEmail || !emailModal.destinatario || !emailModal.assunto || !emailModal.corpo) ? 0.6 : 1 }}
              >
                {enviandoEmail ? '⏳ Enviando...' : '📤 Enviar Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirmação Exclusão ── */}
      {delConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(15,23,42,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000, padding:'1rem' }}>
          <div style={{ background:'white', borderRadius:'16px', width:'100%', maxWidth:'400px', padding:'2rem', boxShadow:'0 25px 60px rgba(0,0,0,.2)', textAlign:'center' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:'1rem' }}>⚠️</div>
            <h3 style={{ margin:'0 0 0.5rem', color:'#1e293b', fontSize:'1.1rem', fontWeight:700 }}>Confirmar Exclusão</h3>
            <p style={{ color:'#64748b', marginBottom:'1.5rem', lineHeight:1.5 }}>
              Excluir o processo de <strong>{delConfirm.nome_requerente}</strong>?<br/>
              <small>Todas as notas associadas também serão removidas.</small>
            </p>
            <div style={{ display:'flex', gap:'0.75rem', justifyContent:'center' }}>
              <button onClick={() => setDelConfirm(null)} style={{ padding:'0.7rem 1.5rem', border:'1px solid #e2e8f0', borderRadius:'10px', background:'white', cursor:'pointer', fontWeight:600, color:'#475569' }}>Cancelar</button>
              <button onClick={() => excluir(delConfirm.id)} style={{ padding:'0.7rem 1.5rem', background:'#ef4444', color:'white', border:'none', borderRadius:'10px', cursor:'pointer', fontWeight:700 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
