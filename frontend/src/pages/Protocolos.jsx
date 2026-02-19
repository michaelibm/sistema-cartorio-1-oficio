import React, { useEffect, useMemo, useState } from 'react';
import { API_URL } from "../services/api";

import './Protocolos.css';
import {
  addServicoAoProtocolo,
  concluirProtocolo,
  createProtocolo,
  deleteProtocolo,
  getFuncionarios,
  getProtocolos,
  getServicos,
  updateProtocolo,
  addNota,
  getNotas,
  getHistorico,
} from '../services/api';

const statusLabel = (s) => {
  if (s === 'andamento') return 'Em andamento';
  if (s === 'concluido') return 'Concluído';
  if (s === 'cancelado') return 'Cancelado';
  return s;
};

const statusBadgeClass = (s) => {
  if (s === 'concluido') return 'badge-moderno badge-success-moderno';
  if (s === 'cancelado') return 'badge-moderno badge-danger-moderno';
  return 'badge-moderno badge-info-moderno';
};

const statusBadge = (s) => {
  if (s === 'concluido') return 'badge badge-success';
  if (s === 'cancelado') return 'badge badge-danger';
  return 'badge badge-info';
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatDateTime = (dt) => {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleString('pt-BR');
};

export default function Protocolos({ usuario }) {
  const [itens, setItens] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  // filtros
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fResp, setFResp] = useState('');

  // modal novo/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero: '',
    servico_id: '',
    responsavel_id: '',
    data_entrada: todayISO(),
    observacoes: '',
    status: 'andamento',
  });

  // modal adicionar serviço
  const [modalServicoOpen, setModalServicoOpen] = useState(false);
  const [protocoloSel, setProtocoloSel] = useState(null);
  const [servicoSel, setServicoSel] = useState('');
  const [renovarPrazo, setRenovarPrazo] = useState(true);
  const [servicoResp, setServicoResp] = useState(null);

  // Modal Notas e Histórico
  const [modalNotasOpen, setModalNotasOpen] = useState(false);
  const [protocoloNotasSel, setProtocoloNotasSel] = useState(null);
  const [notas, setNotas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [novaNota, setNovaNota] = useState('');
  const [abaSelecionada, setAbaSelecionada] = useState('notas');
  const [loadingNotas, setLoadingNotas] = useState(false);

  // ✅ Alertas manuais (Supervisor)
  const [enviandoAlertas, setEnviandoAlertas] = useState(false);
  const [resultadoAlertas, setResultadoAlertas] = useState(null);

  // ✅ Buscar setor do responsável selecionado
  const setorResponsavel = useMemo(() => {
    const id = Number(form.responsavel_id);
    if (!id) return '';
    const func = funcionarios.find((f) => Number(f.id) === id);
    return func?.setor || '';
  }, [funcionarios, form.responsavel_id]);

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const token = localStorage.getItem('token');
      const [p, s, f, st] = await Promise.all([
        getProtocolos({ status: fStatus || undefined, responsavel_id: fResp || undefined }),
        getServicos(),
        getFuncionarios(),
        fetch(`${API_URL}/status`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json())
      ]);
      setItens(Array.isArray(p) ? p : []);
      setServicos(Array.isArray(s) ? s : []);
      setFuncionarios(Array.isArray(f) ? f : []);
      setStatusList(Array.isArray(st) ? st : []);
    } catch (e) {
      setErro(e?.message || 'Erro ao carregar protocolos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fStatus, fResp]);

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter((p) =>
      String(p.numero || '').toLowerCase().includes(s) ||
      String(p.servico_nome || '').toLowerCase().includes(s) ||
      String(p.responsavel_nome || '').toLowerCase().includes(s) ||
      String(p.responsavel_setor || '').toLowerCase().includes(s)
    );
  }, [itens, q]);

  const abrirNovo = () => {
    setEditId(null);
    setForm({
      numero: '',
      servico_id: servicos?.[0]?.id ? String(servicos[0].id) : '',
      responsavel_id: String(usuario?.id || ''),
      data_entrada: todayISO(),
      observacoes: '',
      status: 'andamento',
    });
    setModalOpen(true);
  };

  const abrirEdicao = (p) => {
    setEditId(p.id);
    setForm({
      numero: p.numero || '',
      servico_id: String(p.servico_id || ''),
      responsavel_id: String(p.responsavel_id || ''),
      data_entrada: String(p.data_entrada).slice(0, 10),
      observacoes: p.observacoes || '',
      status: p.status || 'andamento',
    });
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setEditId(null);
    setSaving(false);
    setErro('');
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErro('');
    try {
      if (!form.numero || !form.servico_id || !form.responsavel_id || !form.data_entrada) {
        throw new Error('Preencha: número, serviço, responsável e data de entrada');
      }

      if (editId) {
        await updateProtocolo(editId, {
          responsavel_id: Number(form.responsavel_id),
          observacoes: form.observacoes,
          status: form.status,
        });
      } else {
        await createProtocolo({
          numero: form.numero,
          servico_id: Number(form.servico_id),
          responsavel_id: Number(form.responsavel_id),
          data_entrada: form.data_entrada,
          observacoes: form.observacoes,
        });
      }

      fecharModal();
      await carregar();
    } catch (e2) {
      setErro(e2?.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const concluir = async (id) => {
    if (!window.confirm('Concluir este protocolo?')) return;
    setErro('');
    try {
      await concluirProtocolo(id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Erro ao concluir');
    }
  };

  const excluir = async (id) => {
    if (!window.confirm('Excluir este protocolo? (será marcado como cancelado)')) return;
    setErro('');
    try {
      await deleteProtocolo(id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Erro ao excluir');
    }
  };

  const abrirModalServico = (p) => {
    setProtocoloSel(p);
    const first = servicos?.[0]?.id ? String(servicos[0].id) : '';
    setServicoSel(first);
    setRenovarPrazo(true);
    setServicoResp(null);
    setModalServicoOpen(true);
  };

  const fecharModalServico = () => {
    setModalServicoOpen(false);
    setProtocoloSel(null);
    setServicoSel('');
    setServicoResp(null);
  };

  const servicoEscolhido = useMemo(() => {
    const id = Number(servicoSel);
    if (!id) return null;
    return servicos.find((s) => Number(s.id) === id) || null;
  }, [servicos, servicoSel]);

  const salvarServico = async (e) => {
    e.preventDefault();
    if (!protocoloSel?.id) return;
    setErro('');
    setSaving(true);
    try {
      if (!servicoSel) throw new Error('Selecione um serviço');
      const resp = await addServicoAoProtocolo(protocoloSel.id, {
        servico_id: Number(servicoSel),
        renovarPrazo,
      });
      setServicoResp(resp);
      await carregar();
    } catch (e2) {
      setErro(e2?.message || 'Erro ao adicionar serviço');
    } finally {
      setSaving(false);
    }
  };

  const abrirModalNotas = async (p) => {
    setProtocoloNotasSel(p);
    setNovaNota('');
    setAbaSelecionada('notas');
    setModalNotasOpen(true);
    setLoadingNotas(true);
    try {
      const [notasData, historicoData] = await Promise.all([
        getNotas(p.id),
        getHistorico(p.id),
      ]);
      setNotas(Array.isArray(notasData) ? notasData : []);
      setHistorico(Array.isArray(historicoData) ? historicoData : []);
    } catch (e) {
      setErro(e?.message || 'Erro ao carregar notas/histórico');
    } finally {
      setLoadingNotas(false);
    }
  };

  const fecharModalNotas = () => {
    setModalNotasOpen(false);
    setProtocoloNotasSel(null);
    setNotas([]);
    setHistorico([]);
    setNovaNota('');
  };

  const salvarNota = async (e) => {
    e.preventDefault();
    if (!novaNota.trim()) return;
    setErro('');
    setSaving(true);
    try {
      await addNota(protocoloNotasSel.id, novaNota);
      setNovaNota('');
      const [notasData, historicoData] = await Promise.all([
        getNotas(protocoloNotasSel.id),
        getHistorico(protocoloNotasSel.id),
      ]);
      setNotas(Array.isArray(notasData) ? notasData : []);
      setHistorico(Array.isArray(historicoData) ? historicoData : []);
    } catch (e) {
      setErro(e?.message || 'Erro ao adicionar nota');
    } finally {
      setSaving(false);
    }
  };

  // ✅ Função para enviar alertas manualmente (SUPERVISOR)
  const enviarAlertasManual = async () => {
    if (!window.confirm('Deseja enviar alertas de vencimento agora?')) return;
    
    setEnviandoAlertas(true);
    setResultadoAlertas(null);
    setErro('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_URL}/alertas/verificar-vencimentos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao enviar alertas');
      }

      const resultado = await response.json();
      setResultadoAlertas(resultado);

      if (resultado.total === 0) {
        alert('✅ Nenhum protocolo vencendo no momento.');
      } else {
        alert(`✅ ${resultado.enviados} alerta(s) enviado(s) com sucesso!\n\nTotal de protocolos: ${resultado.total}`);
      }
    } catch (e) {
      setErro(e?.message || 'Erro ao enviar alertas');
      alert('❌ Erro ao enviar alertas: ' + (e?.message || 'Erro desconhecido'));
    } finally {
      setEnviandoAlertas(false);
    }
  };

  return (
    <div className="protocolos-container">
      <div className="protocolos-header">
       <h1 className="protocolos-title">Protocolos</h1>
       <p className="protocolos-subtitle">Cadastro, acompanhamento e conclusão de protocolos.</p>
    </div>

      {erro && <div className="alert-moderno alert-error-moderno">⚠️ {erro}</div>}

      {resultadoAlertas && resultadoAlertas.total > 0 && (
        <div className="alert-moderno alert-success-moderno">
          ✅ Alertas enviados: {resultadoAlertas.enviados} de {resultadoAlertas.total}
        </div>
      )}

      <div className="protocolos-card">
        <div className="card-header-protocolos">
          <h2 className="card-title-protocolos">Lista de Protocolos</h2>
          <div className="filtros-area">
            <input
              className="input-moderno"
              style={{ minWidth: 280 }}
              placeholder="🔍 Buscar protocolos..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="select-moderno" style={{ minWidth: 180 }} value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Todos status</option>
              {statusList.map((s) => (
                <option key={s.nome} value={s.nome}>{s.nome}</option>
              ))}
            </select>
            <select className="select-moderno" style={{ minWidth: 200 }} value={fResp} onChange={(e) => setFResp(e.target.value)}>
              <option value="">Todos responsáveis</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>{f.nome}</option>
              ))}
            </select>

            {/* ✅ BOTÃO DE ALERTAS - SÓ PARA SUPERVISOR */}
            {usuario?.cargo === 'Supervisor' && (
              <button 
                className="btn-moderno btn-warning-moderno" 
                onClick={enviarAlertasManual}
                disabled={enviandoAlertas}
                title="Enviar alertas de vencimento para o n8n"
               
              >
                {enviandoAlertas ? '⏳ Enviando...' : '🔔 Enviar Alertas'}
              </button>
            )}

            <button className="btn-moderno btn-success-moderno" onClick={abrirNovo}>
  ➕ Novo Protocolo
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="table-moderno">
            <thead>
              <tr>
                <th>Número</th>
                <th>Serviço</th>
                <th>Setor</th>
                <th>Responsável</th>
                <th>Data Entrada</th>
                <th>Vencimento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>Carregando...</td></tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan="8" style={{ textAlign: 'center' }}>Nenhum protocolo encontrado</td></tr>
              )}
              {!loading && filtrados.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.numero}</strong></td>
                  <td>{p.servico_nome}</td>
                  <td>{p.responsavel_setor || '-'}</td>
                  <td>{p.responsavel_nome}</td>
                  <td>{String(p.data_entrada).slice(0, 10)}</td>
                  <td>{String(p.data_vencimento).slice(0, 10)}</td>
                  <td><span className={statusBadgeClass(p.status)}>{statusLabel(p.status)}</span></td>
                  <td>
                    <div className="acoes-container">
                      <button className="btn-action btn-action-edit" onClick={() => abrirEdicao(p)} title="Editar">✏️</button>
                        {p.status === 'andamento' && (
    <>
                      <button className="btn-action btn-action-edit" onClick={() => abrirModalServico(p)} title="Adicionar Serviço">+</button>
                      <button className="btn-action btn-action-success" onClick={() => concluir(p.id)} title="Concluir">✓</button>
    </>
  )}
  <button className="btn-action btn-action-edit" onClick={() => abrirModalNotas(p)} title="Notas">📝</button>
  <button className="btn-action btn-action-delete" onClick={() => excluir(p.id)} title="Excluir">🗑️</button>
</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Novo/Editar */}
      {modalOpen && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'Editar Protocolo' : 'Novo Protocolo'}</h2>
            
            <form onSubmit={salvar}>
              <div className="form-group">
                <label htmlFor="numero">Número</label>
                <input
                  type="text"
                  id="numero"
                  className="form-input"
                  value={form.numero}
                  onChange={(e) => setForm({ ...form, numero: e.target.value })}
                  placeholder="Ex: 2026-000123"
                  disabled={!!editId}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="servico">Serviço</label>
                <select
                  id="servico"
                  className="form-select"
                  value={form.servico_id}
                  onChange={(e) => setForm({ ...form, servico_id: e.target.value })}
                  disabled={!!editId}
                  required
                >
                  <option value="">Selecione...</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.prazo} {s.tipo_prazo === 'uteis' ? 'úteis' : 'corridos'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="data_entrada">Data de entrada</label>
                <input
                  type="date"
                  id="data_entrada"
                  className="form-input"
                  value={form.data_entrada}
                  onChange={(e) => setForm({ ...form, data_entrada: e.target.value })}
                  disabled={!!editId}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="responsavel">Responsável</label>
                <select
                  id="responsavel"
                  className="form-select"
                  value={form.responsavel_id}
                  onChange={(e) => setForm({ ...form, responsavel_id: e.target.value })}
                  required
                >
                  <option value="">Selecione...</option>
                  {funcionarios.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.cargo}) {f.setor && `- ${f.setor}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* ✅ Mostrar setor automaticamente baseado no responsável */}
              {setorResponsavel && (
                <div className="info-box" style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '0.75rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <strong>Setor:</strong> {setorResponsavel}
                </div>
              )}

              <div className="form-group">
                <label htmlFor="observacoes">Observações</label>
                <textarea
                  id="observacoes"
                  className="form-input"
                  rows="3"
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Detalhes do protocolo..."
                />
              </div>

              {editId && (
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    className="form-select"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    {statusList.map((s) => (
                      <option key={s.nome} value={s.nome}>{s.nome}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Serviço */}
      {modalServicoOpen && protocoloSel && (
        <div className="modal-overlay" onClick={fecharModalServico}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Adicionar serviço ao protocolo {protocoloSel.numero}</h2>
            
            <form onSubmit={salvarServico}>
              <div className="form-group">
                <label htmlFor="servico-add">Serviço</label>
                <select
                  id="servico-add"
                  className="form-select"
                  value={servicoSel}
                  onChange={(e) => setServicoSel(e.target.value)}
                  required
                >
                  <option value="">Selecione...</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.prazo} {s.tipo_prazo === 'uteis' ? 'úteis' : 'corridos'})
                    </option>
                  ))}
                </select>
              </div>

              {servicoEscolhido && (
                <div className="info-box">
                  <strong>{servicoEscolhido.nome}</strong><br />
                  Prazo: {servicoEscolhido.prazo} {servicoEscolhido.tipo_prazo === 'uteis' ? 'dias úteis' : 'dias corridos'}
                </div>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={renovarPrazo}
                    onChange={(e) => setRenovarPrazo(e.target.checked)}
                  />
                  {' '}Renovar prazo (recalcular vencimento)
                </label>
                <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                  Se desmarcado, mantém o prazo atual (mas pode ficar apertado).
                </small>
              </div>

              {servicoResp && (
                <div className="alert alert-success">
                  Serviço adicionado! Vencimento: {servicoResp.data_vencimento}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModalServico}>Fechar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Adicionando...' : 'Adicionar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Notas e Histórico */}
      {modalNotasOpen && protocoloNotasSel && (
        <div className="modal-overlay" onClick={fecharModalNotas}>
          <div className="modal-content" style={{ maxWidth: '700px' }} onClick={(e) => e.stopPropagation()}>
            <h2>Protocolo {protocoloNotasSel.numero}</h2>
            
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '2px solid #e0e0e0', marginBottom: '1rem' }}>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  fontWeight: abaSelecionada === 'notas' ? 'bold' : 'normal',
                  borderBottom: abaSelecionada === 'notas' ? '3px solid #16a34a' : '3px solid transparent',
                }}
                onClick={() => setAbaSelecionada('notas')}
              >
                📝 Notas ({notas.length})
              </button>
              <button
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '0.75rem 1rem',
                  cursor: 'pointer',
                  fontWeight: abaSelecionada === 'historico' ? 'bold' : 'normal',
                  borderBottom: abaSelecionada === 'historico' ? '3px solid #16a34a' : '3px solid transparent',
                }}
                onClick={() => setAbaSelecionada('historico')}
              >
                📜 Histórico ({historico.length})
              </button>
            </div>

            {loadingNotas && <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando...</div>}

            {!loadingNotas && abaSelecionada === 'notas' && (
              <div>
                <form onSubmit={salvarNota} style={{ marginBottom: '1.5rem' }}>
                  <div className="form-group">
                    <label>Adicionar Nota</label>
                    <textarea
                      className="form-input"
                      rows="3"
                      value={novaNota}
                      onChange={(e) => setNovaNota(e.target.value)}
                      placeholder="Ex: Falta corrigir o campo X, aguardando resposta do departamento Y..."
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                    {saving ? 'Salvando...' : 'Adicionar Nota'}
                  </button>
                </form>

                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {notas.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                      Nenhuma nota ainda. Adicione a primeira!
                    </p>
                  )}
                  {notas.map((nota) => (
                    <div
                      key={nota.id}
                      style={{
                        background: '#f9fafb',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        padding: '1rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      <div style={{ marginBottom: '0.5rem' }}>
                        <strong>{nota.usuario_nome || 'Usuário'}</strong>
                        {' '}
                        <span style={{ color: '#666', fontSize: '0.85rem' }}>
                          ({nota.usuario_setor || nota.usuario_cargo || 'Cargo'})
                        </span>
                        <br />
                        <small style={{ color: '#999' }}>{formatDateTime(nota.created_at)}</small>
                      </div>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{nota.nota}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loadingNotas && abaSelecionada === 'historico' && (
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                {historico.length === 0 && (
                  <p style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                    Nenhum registro no histórico
                  </p>
                )}
                {historico.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      background: '#fefefe',
                      border: '1px solid #e5e7eb',
                      borderLeft: '4px solid #16a34a',
                      borderRadius: '4px',
                      padding: '1rem',
                      marginBottom: '0.75rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <strong style={{ color: '#16a34a' }}>{h.acao}</strong>
                      <small style={{ color: '#999' }}>{formatDateTime(h.created_at)}</small>
                    </div>
                    <div style={{ marginBottom: '0.25rem' }}>{h.descricao}</div>
                    {h.usuario_nome && (
                      <small style={{ color: '#666' }}>
                        Por: {h.usuario_nome} {h.usuario_setor && `(${h.usuario_setor})`} - {h.usuario_email}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={fecharModalNotas}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
