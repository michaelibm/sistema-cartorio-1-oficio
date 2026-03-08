import React, { useEffect, useMemo, useState } from "react";
import { API_URL } from "../services/api";

import "./Protocolos.css";
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
  iniciarSessao,
  pausarSessao,
  getSessoesAtivas,
} from "../services/api";

const statusLabel = (s) => {
  const sl = (s || "").toLowerCase();
  if (sl === "andamento")           return "Em andamento";
  if (sl === "concluido" || sl === "concluído") return "Concluído";
  if (sl === "cancelado")           return "Cancelado";
  if (sl === "aguardando")          return "Aguardando";
  return s;
};

const statusBadgeClass = (s) => {
  const sl = (s || "").toLowerCase();
  if (sl === "concluido" || sl === "concluído") return "badge-moderno badge-success-moderno";
  if (sl === "cancelado")           return "badge-moderno badge-danger-moderno";
  if (sl === "aguardando")          return "badge-moderno badge-warning-moderno";
  return "badge-moderno badge-info-moderno";
};

const todayISO = () => new Date().toISOString().slice(0, 10);

// Navega para o próximo campo ao pressionar Enter
const handleEnterKey = (e) => {
  if (
    e.key === "Enter" &&
    e.target.tagName !== "TEXTAREA" &&
    e.target.type !== "submit"
  ) {
    e.preventDefault();
    const form = e.target.closest("form");
    if (!form) return;
    const fields = Array.from(
      form.querySelectorAll(
        "input:not([disabled]), select:not([disabled]), textarea:not([disabled])"
      )
    );
    const idx = fields.indexOf(e.target);
    if (idx >= 0 && idx < fields.length - 1) {
      fields[idx + 1].focus();
    }
  }
};

const formatDateTime = (dt) => {
  if (!dt) return "";
  const d = new Date(dt);
  // Converter para horário de Manaus (UTC-4)
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const manaus = new Date(utc + (-4 * 60) * 60000);
  return manaus.toLocaleString("pt-BR", {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
};

const formatMoeda = (valor) => {
  if (!valor && valor !== 0) return "-";
  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const PRIORIDADE_CONFIG = {
  1: { label: "Baixa",   cor: "#6b7280", bg: "#f3f4f6", emoji: "🔵" },
  2: { label: "Média",   cor: "#d97706", bg: "#fef3c7", emoji: "🟡" },
  3: { label: "Urgente", cor: "#dc2626", bg: "#fee2e2", emoji: "🔴" },
};

const corLinha = (p) => {
  if (["concluido","concluído","cancelado"].includes((p.status||"").toLowerCase())) return {};
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const venc = new Date(p.data_vencimento); venc.setHours(0, 0, 0, 0);
  const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
  if (diff < 0)  return { background: "#fff1f2", borderLeft: "4px solid #ef4444" };
  if (diff <= 3) return { background: "#fffbeb", borderLeft: "4px solid #f59e0b" };
  if (p.prioridade === 3) return { background: "#fff8f8", borderLeft: "4px solid #dc2626" };
  return {};
};

// ============================================================
// COMPONENTE RELATÓRIO FINANCEIRO
// ============================================================
function RelatorioFinanceiro({ funcionarios, onVoltar }) {
  const [dados, setDados] = useState(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [filtros, setFiltros] = useState({
    data_inicio: "",
    data_fim: "",
    responsavel_id: "",
    pago: "",
  });

  const carregar = async () => {
    setLoading(true);
    setErro("");
    try {
      const token = localStorage.getItem("token");
      const params = new URLSearchParams();
      Object.entries(filtros).forEach(([k, v]) => {
        if (v !== "") params.append(k, v);
      });
      const resp = await fetch(
        `${API_URL}/protocolos/financeiro/relatorio?${params}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (!resp.ok) throw new Error("Erro ao carregar relatório");
      const json = await resp.json();
      setDados(json);
    } catch (e) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const marcarPago = async (protocoloId, pago) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${API_URL}/protocolos/${protocoloId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orcamento_pago: pago }),
      });
      await carregar();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <div className="protocolos-container">
      <div
        className="protocolos-header"
        style={{ display: "flex", alignItems: "center", gap: "1rem" }}
      >
        <button className="btn-action btn-action-edit" onClick={onVoltar}>
          ← Voltar
        </button>
        <div>
          <h1 className="protocolos-title">💰 Relatório Financeiro</h1>
          <p className="protocolos-subtitle">Orçamentos e valores a receber</p>
        </div>
      </div>

      {erro && (
        <div className="alert-moderno alert-error-moderno">⚠️ {erro}</div>
      )}

      {/* Filtros */}
      <div className="protocolos-card" style={{ marginBottom: "1.5rem" }}>
        <div className="card-header-protocolos">
          <h2 className="card-title-protocolos">Filtros</h2>
          <div className="filtros-area">
            <input
              type="date"
              className="input-moderno"
              title="Data início"
              value={filtros.data_inicio}
              onChange={(e) =>
                setFiltros({ ...filtros, data_inicio: e.target.value })
              }
            />
            <input
              type="date"
              className="input-moderno"
              title="Data fim"
              value={filtros.data_fim}
              onChange={(e) =>
                setFiltros({ ...filtros, data_fim: e.target.value })
              }
            />
            <select
              className="select-moderno"
              value={filtros.responsavel_id}
              onChange={(e) =>
                setFiltros({ ...filtros, responsavel_id: e.target.value })
              }
            >
              <option value="">Todos responsáveis</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>
            <select
              className="select-moderno"
              value={filtros.pago}
              onChange={(e) => setFiltros({ ...filtros, pago: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="false">Pendentes</option>
              <option value="true">Pagos</option>
            </select>
            <button
              className="btn-moderno btn-primary-moderno"
              onClick={carregar}
            >
              🔍 Filtrar
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#666" }}>
          Carregando...
        </div>
      )}

      {!loading && dados && (
        <>
          {/* Cards de totais */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "1.25rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                borderLeft: "4px solid #3b82f6",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Total Geral
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#1f2937",
                  marginTop: "0.25rem",
                }}
              >
                {formatMoeda(dados.totais.total_geral)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                {dados.totais.total_protocolos} protocolo(s)
              </div>
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "1.25rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                borderLeft: "4px solid #f59e0b",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                A Receber
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#d97706",
                  marginTop: "0.25rem",
                }}
              >
                {formatMoeda(dados.totais.total_a_receber)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                {dados.totais.qtd_pendentes} pendente(s)
              </div>
            </div>
            <div
              style={{
                background: "#fff",
                borderRadius: "12px",
                padding: "1.25rem",
                boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                borderLeft: "4px solid #10b981",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  fontWeight: 600,
                  textTransform: "uppercase",
                }}
              >
                Recebido
              </div>
              <div
                style={{
                  fontSize: "1.5rem",
                  fontWeight: 700,
                  color: "#059669",
                  marginTop: "0.25rem",
                }}
              >
                {formatMoeda(dados.totais.total_recebido)}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                {dados.totais.qtd_pagos} pago(s)
              </div>
            </div>
          </div>

          {/* Por responsável */}
          {dados.por_responsavel.length > 0 && (
            <div className="protocolos-card" style={{ marginBottom: "1.5rem" }}>
              <div className="card-header-protocolos">
                <h2 className="card-title-protocolos">Por Responsável</h2>
              </div>
              <div className="table-container">
                <table className="table-moderno">
                  <thead>
                    <tr>
                      <th>Responsável</th>
                      <th>Setor</th>
                      <th>Protocolos</th>
                      <th>Total</th>
                      <th>Recebido</th>
                      <th>Pendente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.por_responsavel.map((r, i) => (
                      <tr key={i}>
                        <td>
                          <strong>{r.responsavel_nome}</strong>
                        </td>
                        <td>{r.responsavel_setor || "-"}</td>
                        <td>{r.total_protocolos}</td>
                        <td>
                          <strong>{formatMoeda(r.total_valor)}</strong>
                        </td>
                        <td style={{ color: "#059669" }}>
                          {formatMoeda(r.total_recebido)}
                        </td>
                        <td style={{ color: "#d97706" }}>
                          {formatMoeda(r.total_pendente)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Lista de protocolos */}
          <div className="protocolos-card">
            <div className="card-header-protocolos">
              <h2 className="card-title-protocolos">
                Protocolos com Orçamento
              </h2>
            </div>
            <div className="table-container">
              <table className="table-moderno">
                <thead>
                  <tr>
                    <th>Número</th>
                    <th>Serviço</th>
                    <th>Responsável</th>
                    <th>Data Entrada</th>
                    <th>Status</th>
                    <th>Valor</th>
                    <th>Situação</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.protocolos.length === 0 && (
                    <tr>
                      <td colSpan="8" style={{ textAlign: "center" }}>
                        Nenhum protocolo com orçamento encontrado
                      </td>
                    </tr>
                  )}
                  {dados.protocolos.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <strong>{p.numero}</strong>
                      </td>
                      <td>{p.servico_nome}</td>
                      <td>{p.responsavel_nome}</td>
                      <td>{String(p.data_entrada).slice(0, 10)}</td>
                      <td>
                        <span className={statusBadgeClass(p.status)}>
                          {statusLabel(p.status)}
                        </span>
                      </td>
                      <td>
                        <strong style={{ color: "#1f2937" }}>
                          {formatMoeda(p.orcamento_valor)}
                        </strong>
                      </td>
                      <td>
                        <span
                          className={`badge-moderno ${
                            p.orcamento_pago
                              ? "badge-success-moderno"
                              : "badge-warning-moderno"
                          }`}
                        >
                          {p.orcamento_pago ? "✅ Pago" : "⏳ Pendente"}
                        </span>
                      </td>
                      <td>
                        {p.orcamento_pago ? (
                          <button
                            className="btn-action btn-action-edit"
                            onClick={() => marcarPago(p.id, false)}
                            title="Marcar como pendente"
                          >
                            ↩️ Desfazer
                          </button>
                        ) : (
                          <button
                            className="btn-action btn-action-success"
                            onClick={() => marcarPago(p.id, true)}
                            title="Marcar como pago"
                          >
                            ✅ Marcar Pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// COMPONENTE PRINCIPAL PROTOCOLOS
// ============================================================

// Fuso horário de Manaus (UTC-4, sem horário de verão)
const MANAUS_OFFSET = -4 * 60; // minutos
const agoraManaus = () => {
  const agora = new Date();
  const utc = agora.getTime() + agora.getTimezoneOffset() * 60000;
  return new Date(utc + MANAUS_OFFSET * 60000);
};
const formatarDataHoraManaus = (date) =>
  date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });

export default function Protocolos({ usuario }) {
  const [itens, setItens] = useState([]);
  const [servicos, setServicos] = useState([]);
  const [funcionarios, setFuncionarios] = useState([]);
  const [statusList, setStatusList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [horaAtual, setHoraAtual] = useState(agoraManaus());

  useEffect(() => {
    const interval = setInterval(() => setHoraAtual(agoraManaus()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Fila de atendimento
  const [verFila, setVerFila] = useState(false);
  const [fila, setFila] = useState([]);
  const [loadingFila, setLoadingFila] = useState(false);
  const [modalAtendOpen, setModalAtendOpen] = useState(false);
  const [formAtend, setFormAtend] = useState({ numero: "", servico_id: "", nome_cliente: "", observacoes: "", prioridade: 2 });
  const [savingAtend, setSavingAtend] = useState(false);
  const [modalPuxarOpen, setModalPuxarOpen] = useState(false);
  const [protocoloPuxar, setProtocoloPuxar] = useState(null);

  // Ver relatório financeiro
  const [verRelatorioFinanceiro, setVerRelatorioFinanceiro] = useState(false);

  // filtros
  const [q, setQ] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fResp, setFResp] = useState("");

  // modal novo/editar
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    numero: "",
    servico_id: "",
    responsavel_id: "",
    data_entrada: todayISO(),
    observacoes: "",
    status: "andamento",
    tem_orcamento: false,
    orcamento_valor: "",
    prioridade: 2,
  });

  // modal adicionar serviço
  const [modalServicoOpen, setModalServicoOpen] = useState(false);
  const [protocoloSel, setProtocoloSel] = useState(null);
  const [servicoSel, setServicoSel] = useState("");
  const [renovarPrazo, setRenovarPrazo] = useState(true);
  const [servicoResp, setServicoResp] = useState(null);

  // Transferência
  const [modalTransfOpen, setModalTransfOpen] = useState(false);
  const [transfProtocolo, setTransfProtocolo] = useState(null);
  const [transfResponsavel, setTransfResponsavel] = useState("");
  const [transfSaving, setTransfSaving] = useState(false);

  // Conflito de protocolo existente
  const [modalConflitoOpen, setModalConflitoOpen] = useState(false);
  const [conflitoInfo, setConflitoInfo] = useState(null); // { code, message, protocolo_id, responsavel_nome, status }
  const [verificandoNumero, setVerificandoNumero] = useState(false);
  const [numeroStatus, setNumeroStatus] = useState(null);

  // Modal Notas e Histórico
  const [modalNotasOpen, setModalNotasOpen] = useState(false);
  const [protocoloNotasSel, setProtocoloNotasSel] = useState(null);
  const [notas, setNotas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [novaNota, setNovaNota] = useState("");
  const [abaSelecionada, setAbaSelecionada] = useState("notas");
  const [loadingNotas, setLoadingNotas] = useState(false);

  // Alertas manuais (Supervisor)
  const [enviandoAlertas, setEnviandoAlertas] = useState(false);
  const [resultadoAlertas, setResultadoAlertas] = useState(null);

  // Modal Orçamento/Prioridade (Registrador)
  const [modalOrcamentoOpen, setModalOrcamentoOpen] = useState(false);
  const [protocoloOrcamentoSel, setProtocoloOrcamentoSel] = useState(null);
  const [formOrcamento, setFormOrcamento] = useState({ tem_orcamento: false, orcamento_valor: "", prioridade: 2 });
  const [savingOrcamento, setSavingOrcamento] = useState(false);

  const abrirModalOrcamento = (p) => {
    setProtocoloOrcamentoSel(p);
    setFormOrcamento({
      tem_orcamento: !!p.tem_orcamento,
      orcamento_valor: p.orcamento_valor ? String(p.orcamento_valor) : "",
      prioridade: p.prioridade ?? 2,
    });
    setModalOrcamentoOpen(true);
  };

  const fecharModalOrcamento = () => {
    setModalOrcamentoOpen(false);
    setProtocoloOrcamentoSel(null);
    setSavingOrcamento(false);
  };

  const salvarOrcamento = async (e) => {
    e.preventDefault();
    if (formOrcamento.tem_orcamento && (!formOrcamento.orcamento_valor || parseFloat(formOrcamento.orcamento_valor) <= 0)) {
      setErro("Informe o valor do orçamento");
      return;
    }
    setSavingOrcamento(true);
    setErro("");
    try {
      await updateProtocolo(protocoloOrcamentoSel.id, {
        tem_orcamento: formOrcamento.tem_orcamento,
        orcamento_valor: formOrcamento.tem_orcamento ? parseFloat(formOrcamento.orcamento_valor) : null,
        prioridade: Number(formOrcamento.prioridade),
      });
      fecharModalOrcamento();
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao salvar");
    } finally {
      setSavingOrcamento(false);
    }
  };

  const setorResponsavel = useMemo(() => {
    const id = Number(form.responsavel_id);
    if (!id) return "";
    const func = funcionarios.find((f) => Number(f.id) === id);
    return func?.setor || "";
  }, [funcionarios, form.responsavel_id]);

  const carregar = async () => {
    setLoading(true);
    setErro("");
    try {
      const token = localStorage.getItem("token");
      const [p, s, f, st] = await Promise.all([
        getProtocolos({
          status: fStatus || undefined,
          responsavel_id: fResp || undefined,
        }),
        getServicos(),
        getFuncionarios(),
        fetch(`${API_URL}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ]);
      setItens(Array.isArray(p) ? p : []);
      setServicos(Array.isArray(s) ? s : []);
      setFuncionarios(Array.isArray(f) ? f : []);
      setStatusList(Array.isArray(st) ? st : []);
    } catch (e) {
      setErro(e?.message || "Erro ao carregar protocolos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fStatus, fResp]);

  // ===== SESSÕES DE TRABALHO =====
  const [sessoesAtivas, setSessoesAtivas] = useState([]); // protocolo_ids com sessão ativa
  const [modalPausaOpen, setModalPausaOpen] = useState(false);
  const [protocoloPausaSel, setProtocoloPausaSel] = useState(null);
  const [notaPausa, setNotaPausa] = useState("");
  const [salvandoSessao, setSalvandoSessao] = useState(false);

  const carregarSessoes = async () => {
    try {
      const data = await getSessoesAtivas();
      setSessoesAtivas(Array.isArray(data) ? data.map((s) => s.protocolo_id) : []);
    } catch { /* silencioso */ }
  };

  useEffect(() => {
    if (usuario?.cargo === "Registrador") carregarSessoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleIniciarSessao = async (p) => {
    setSalvandoSessao(true);
    setErro("");
    try {
      await iniciarSessao(p.id);
      await carregarSessoes();
    } catch (e) {
      setErro(e?.message || "Erro ao iniciar sessão");
    } finally {
      setSalvandoSessao(false);
    }
  };

  const abrirModalPausa = (p) => {
    setProtocoloPausaSel(p);
    setNotaPausa("");
    setModalPausaOpen(true);
  };

  const fecharModalPausa = () => {
    setModalPausaOpen(false);
    setProtocoloPausaSel(null);
    setNotaPausa("");
  };

  const handlePausarSessao = async (e) => {
    e.preventDefault();
    if (!notaPausa.trim()) {
      setErro("A nota é obrigatória ao pausar. Descreva o que foi feito e o que está pendente.");
      return;
    }
    setSalvandoSessao(true);
    setErro("");
    try {
      await pausarSessao(protocoloPausaSel.id, notaPausa);
      fecharModalPausa();
      await carregarSessoes();
    } catch (e) {
      setErro(e?.message || "Erro ao pausar sessão");
    } finally {
      setSalvandoSessao(false);
    }
  };

  // ===== FILA DE ATENDIMENTO =====
  const carregarFila = async () => {
    setLoadingFila(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos?status=aguardando`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setFila(Array.isArray(data) ? data : []);
    } catch {
      setFila([]);
    } finally {
      setLoadingFila(false);
    }
  };

  const abrirFila = () => {
    setVerFila(true);
    carregarFila();
  };

  const abrirModalAtendimento = () => {
    setFormAtend({ numero: "", servico_id: servicos?.[0]?.id ? String(servicos[0].id) : "", nome_cliente: "", observacoes: "", prioridade: 2 });
    setModalAtendOpen(true);
  };

  const salvarAtendimento = async (e) => {
    e.preventDefault();
    if (!formAtend.numero || !formAtend.servico_id) {
      setErro("Preencha número e serviço");
      return;
    }
    setSavingAtend(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          numero: formAtend.numero,
          servico_id: Number(formAtend.servico_id),
          responsavel_id: Number(usuario?.id),
          data_entrada: todayISO(),
          nome_cliente: formAtend.nome_cliente,
          observacoes: formAtend.observacoes,
          prioridade: Number(formAtend.prioridade),
          status: "aguardando",
          tem_orcamento: false,
        }),
      });

      const data = await resp.json();
      if (resp.status === 409) {
        // Protocolo já existe — perguntar se quer puxar
        if (data.code === "PROTOCOLO_EM_ANDAMENTO" || data.code === "PROTOCOLO_CONCLUIDO") {
          setProtocoloPuxar({ ...data, numero: formAtend.numero });
          setModalPuxarOpen(true);
          setModalAtendOpen(false);
          setSavingAtend(false);
          return;
        }
        throw new Error(data.message || "Erro");
      }
      if (!resp.ok) {
        // Protocolo aguardando — perguntar se quer puxar
        if (data.code === "PROTOCOLO_AGUARDANDO") {
          setProtocoloPuxar({ ...data, numero: formAtend.numero });
          setModalPuxarOpen(true);
          setModalAtendOpen(false);
          setSavingAtend(false);
          return;
        }
        throw new Error(data.message || "Erro ao criar");
      }

      if (formAtend.observacoes?.trim()) {
        await addNota(data.id, `[Atendimento] ${formAtend.observacoes.trim()}`);
      }
      setModalAtendOpen(false);
      carregarFila();
      carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao enviar para fila");
    } finally {
      setSavingAtend(false);
    }
  };

  const puxarProtocolo = async (protocoloId) => {
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos/${protocoloId}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ novo_responsavel_id: usuario?.id, puxar_fila: true }),
      });
      if (!resp.ok) throw new Error("Erro ao puxar protocolo");
      setModalPuxarOpen(false);
      setProtocoloPuxar(null);
      carregarFila();
      carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao puxar protocolo");
    }
  };

  const filtrados = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return itens;
    return itens.filter(
      (p) =>
        String(p.numero || "")
          .toLowerCase()
          .includes(s) ||
        String(p.servico_nome || "")
          .toLowerCase()
          .includes(s) ||
        String(p.responsavel_nome || "")
          .toLowerCase()
          .includes(s) ||
        String(p.responsavel_setor || "")
          .toLowerCase()
          .includes(s)
    );
  }, [itens, q]);

  const abrirNovo = () => {
    setEditId(null);
    setForm({
      numero: "",
      servico_id: servicos?.[0]?.id ? String(servicos[0].id) : "",
      responsavel_id: String(usuario?.id || ""),
      data_entrada: todayISO(),
      observacoes: "",
      status: "andamento",
      tem_orcamento: false,
      orcamento_valor: "",
      prioridade: 2,
    });
    setModalOpen(true);
  };

  const abrirEdicao = (p) => {
    setEditId(p.id);
    setForm({
      numero: p.numero || "",
      servico_id: String(p.servico_id || ""),
      responsavel_id: String(p.responsavel_id || ""),
      data_entrada: String(p.data_entrada).slice(0, 10),
      observacoes: p.observacoes || "",
      status: p.status || "andamento",
      tem_orcamento: !!p.tem_orcamento,
      orcamento_valor: p.orcamento_valor ? String(p.orcamento_valor) : "",
      prioridade: p.prioridade ?? 2,
    });
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setEditId(null);
    setSaving(false);
    setErro("");
    setNumeroStatus(null);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErro("");
    try {
      if (
        !form.numero ||
        !form.servico_id ||
        !form.responsavel_id ||
        !form.data_entrada
      ) {
        throw new Error(
          "Preencha: número, serviço, responsável e data de entrada"
        );
      }

      if (
        form.tem_orcamento &&
        (!form.orcamento_valor || parseFloat(form.orcamento_valor) <= 0)
      ) {
        throw new Error("Informe o valor do orçamento");
      }

      if (editId) {
        await updateProtocolo(editId, {
          servico_id: Number(form.servico_id),
          responsavel_id: Number(form.responsavel_id),
          data_entrada: form.data_entrada,
          observacoes: form.observacoes,
          status: form.status,
          tem_orcamento: form.tem_orcamento,
          orcamento_valor: form.tem_orcamento
            ? parseFloat(form.orcamento_valor)
            : null,
          prioridade: Number(form.prioridade),
        });
      } else {
        // Tentar criar — tratar conflito 409
        const token = localStorage.getItem("token");
        const resp = await fetch(`${API_URL}/protocolos`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            numero: form.numero,
            servico_id: Number(form.servico_id),
            responsavel_id: Number(form.responsavel_id),
            data_entrada: form.data_entrada,
            observacoes: form.observacoes,
            tem_orcamento: form.tem_orcamento,
            orcamento_valor: form.tem_orcamento ? parseFloat(form.orcamento_valor) : null,
            prioridade: Number(form.prioridade),
          }),
        });

        const novoData = await resp.json();
        if (resp.status === 409) {
          setConflitoInfo({ ...novoData, solicitante_id: Number(form.responsavel_id) });
          setModalConflitoOpen(true);
          setSaving(false);
          return;
        }

        if (!resp.ok) {
          throw new Error(novoData.message || "Erro ao criar protocolo");
        }

        if (form.observacoes?.trim()) {
          await addNota(novoData.id, form.observacoes.trim());
        }
      }

      fecharModal();
      await carregar();
    } catch (e2) {
      setErro(e2?.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const concluir = async (id) => {
    if (!window.confirm("Concluir este protocolo?")) return;
    setErro("");
    try {
      await concluirProtocolo(id);
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao concluir");
    }
  };

  const excluir = async (id) => {
    if (
      !window.confirm("Excluir este protocolo? (será marcado como cancelado)")
    )
      return;
    setErro("");
    try {
      await deleteProtocolo(id);
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao excluir");
    }
  };

  const abrirModalServico = (p) => {
    setProtocoloSel(p);
    const first = servicos?.[0]?.id ? String(servicos[0].id) : "";
    setServicoSel(first);
    setRenovarPrazo(true);
    setServicoResp(null);
    setModalServicoOpen(true);
  };

  const abrirTransferencia = (p) => {
    setTransfProtocolo(p);
    setTransfResponsavel("");
    setModalTransfOpen(true);
  };

  const fecharTransferencia = () => {
    setModalTransfOpen(false);
    setTransfProtocolo(null);
    setTransfResponsavel("");
  };

  const confirmarTransferencia = async () => {
    if (!transfResponsavel) return;
    setTransfSaving(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos/${transfProtocolo.id}/transferir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ novo_responsavel_id: transfResponsavel }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.message || "Erro ao transferir");
      }
      fecharTransferencia();
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao transferir protocolo");
    } finally {
      setTransfSaving(false);
    }
  };


  const verificarNumero = async (numero) => {
    if (!numero || numero.length < 2 || editId) return;
    setVerificandoNumero(true);
    setNumeroStatus(null);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos/verificar/${encodeURIComponent(numero)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!data.existe) { setNumeroStatus("novo"); return; }
      setNumeroStatus("existente");
      setConflitoInfo({
        code: data.code,
        protocolo_id: data.id,
        responsavel_nome: data.responsavel_nome,
        solicitante_id: Number(form.responsavel_id) || Number(usuario?.id),
        novo_servico_id: "",
      });
      setModalConflitoOpen(true);
    } catch { /* silencioso */ } finally { setVerificandoNumero(false); }
  };

  const confirmarReabertura = async () => {
    if (!conflitoInfo) return;
    setTransfSaving(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos/${conflitoInfo.protocolo_id}/reabrir`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ novo_responsavel_id: conflitoInfo.solicitante_id, novo_servico_id: conflitoInfo.novo_servico_id }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.message || "Erro ao reabrir");
      }
      setModalConflitoOpen(false);
      setConflitoInfo(null);
      fecharModal();
      await carregar();
    } catch (e) {
      setErro(e?.message || "Erro ao reabrir protocolo");
    } finally {
      setTransfSaving(false);
    }
  };

  const fecharModalServico = () => {
    setModalServicoOpen(false);
    setProtocoloSel(null);
    setServicoSel("");
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
    setErro("");
    setSaving(true);
    try {
      if (!servicoSel) throw new Error("Selecione um serviço");
      const resp = await addServicoAoProtocolo(protocoloSel.id, {
        servico_id: Number(servicoSel),
        renovarPrazo,
      });
      setServicoResp(resp);
      await carregar();
    } catch (e2) {
      setErro(e2?.message || "Erro ao adicionar serviço");
    } finally {
      setSaving(false);
    }
  };

  const abrirModalNotas = async (p) => {
    setProtocoloNotasSel(p);
    setNovaNota("");
    setAbaSelecionada("notas");
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
      setErro(e?.message || "Erro ao carregar notas/histórico");
    } finally {
      setLoadingNotas(false);
    }
  };

  const fecharModalNotas = () => {
    setModalNotasOpen(false);
    setProtocoloNotasSel(null);
    setNotas([]);
    setHistorico([]);
    setNovaNota("");
  };

  const salvarNota = async (e) => {
    e.preventDefault();
    if (!novaNota.trim()) return;
    setErro("");
    setSaving(true);
    try {
      await addNota(protocoloNotasSel.id, novaNota);
      setNovaNota("");
      const [notasData, historicoData] = await Promise.all([
        getNotas(protocoloNotasSel.id),
        getHistorico(protocoloNotasSel.id),
      ]);
      setNotas(Array.isArray(notasData) ? notasData : []);
      setHistorico(Array.isArray(historicoData) ? historicoData : []);
    } catch (e) {
      setErro(e?.message || "Erro ao adicionar nota");
    } finally {
      setSaving(false);
    }
  };

  const enviarAlertasManual = async () => {
    if (!window.confirm("Deseja enviar alertas de vencimento agora?")) return;
    setEnviandoAlertas(true);
    setResultadoAlertas(null);
    setErro("");
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/alertas/verificar-vencimentos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) throw new Error("Erro ao enviar alertas");
      const resultado = await response.json();
      setResultadoAlertas(resultado);
      if (resultado.total === 0) {
        alert("✅ Nenhum protocolo vencendo no momento.");
      } else {
        alert(
          `✅ ${resultado.enviados} alerta(s) enviado(s) com sucesso!\n\nTotal de protocolos: ${resultado.total}`
        );
      }
    } catch (e) {
      setErro(e?.message || "Erro ao enviar alertas");
    } finally {
      setEnviandoAlertas(false);
    }
  };

  // Mostrar relatório financeiro
  if (verRelatorioFinanceiro) {
    return (
      <RelatorioFinanceiro
        funcionarios={funcionarios}
        onVoltar={() => setVerRelatorioFinanceiro(false)}
      />
    );
  }

  return (
    <div className="protocolos-container">
      <div className="protocolos-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 className="protocolos-title">Protocolos</h1>
          <p className="protocolos-subtitle">
            Cadastro, acompanhamento e conclusão de protocolos.
          </p>
        </div>
        {/* Relógio de Manaus */}
        <div style={{ background: 'white', borderRadius: '10px', padding: '0.625rem 1rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', textAlign: 'right', borderLeft: '4px solid #3b82f6', alignSelf: 'flex-start' }}>
          <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: '600', textTransform: 'uppercase', marginBottom: '0.125rem' }}>
            🕐 Manaus (UTC-4)
          </div>
          <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1f2937', fontVariantNumeric: 'tabular-nums' }}>
            {formatarDataHoraManaus(horaAtual)}
          </div>
        </div>
      </div>

      {erro && (
        <div className="alert-moderno alert-error-moderno">⚠️ {erro}</div>
      )}

      {resultadoAlertas && resultadoAlertas.total > 0 && (
        <div className="alert-moderno alert-success-moderno">
          ✅ Alertas enviados: {resultadoAlertas.enviados} de{" "}
          {resultadoAlertas.total}
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
            <select
              className="select-moderno"
              style={{ minWidth: 180 }}
              value={fStatus}
              onChange={(e) => setFStatus(e.target.value)}
            >
              <option value="">Todos status</option>
              {statusList.map((s) => (
                <option key={s.nome} value={s.nome}>
                  {s.nome}
                </option>
              ))}
            </select>
            <select
              className="select-moderno"
              style={{ minWidth: 200 }}
              value={fResp}
              onChange={(e) => setFResp(e.target.value)}
            >
              <option value="">Todos responsáveis</option>
              {funcionarios.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                </option>
              ))}
            </select>

            {/* Botão Relatório Financeiro - Supervisor e Coordenador */}
            {(usuario?.cargo === "Supervisor" ||
              usuario?.cargo === "Coordenador") && (
              <button
                className="btn-moderno btn-primary-moderno"
                onClick={() => setVerRelatorioFinanceiro(true)}
                title="Relatório financeiro de orçamentos"
              >
                💰 Financeiro
              </button>
            )}

            {/* Botão Alertas - Supervisor */}
            {(usuario?.cargo === "Supervisor" ||
              usuario?.cargo === "Coordenador") && (
              <button
                className="btn-moderno btn-warning-moderno"
                onClick={enviarAlertasManual}
                disabled={enviandoAlertas}
                title="Enviar alertas de vencimento"
              >
                {enviandoAlertas ? "⏳ Enviando..." : "🔔 Enviar Alertas"}
              </button>
            )}

            <button
              className="btn-moderno btn-success-moderno"
              onClick={abrirNovo}
            >
              ➕ Novo Protocolo
            </button>

            <button
              className="btn-moderno"
              style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "white", boxShadow: "0 4px 12px rgba(245,158,11,0.25)", position: "relative" }}
              onClick={abrirFila}
            >
              🎫 Fila de Atendimento
              {fila.length > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, background: "#ef4444", color: "white", borderRadius: "50%", width: 20, height: 20, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {fila.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="table-moderno">
            <thead>
              <tr>
                <th>Número</th>
                <th>Prioridade</th>
                <th>Serviço</th>
                <th>Setor</th>
                <th>Responsável</th>
                <th>Data Entrada</th>
                <th>Vencimento</th>
                <th>Orçamento</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>
                    Carregando...
                  </td>
                </tr>
              )}
              {!loading && filtrados.length === 0 && (
                <tr>
                  <td colSpan="10" style={{ textAlign: "center" }}>
                    Nenhum protocolo encontrado
                  </td>
                </tr>
              )}
              {!loading &&
                filtrados.map((p) => (
                  <tr
                    key={p.id}
                    style={
                      sessoesAtivas.includes(p.id)
                        ? { ...corLinha(p), borderLeft: "5px solid #16a34a", background: "#f0fdf4" }
                        : corLinha(p)
                    }
                  >
                    <td>
                      <strong>{p.numero}</strong>
                      {p.prioridade === 3 && (
                        <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                          ★ Urgente!
                        </span>
                      )}
                    </td>
                    <td>
                      {(() => {
                        const cfg = PRIORIDADE_CONFIG[p.prioridade] || PRIORIDADE_CONFIG[2];
                        return (
                          <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "0.2rem 0.6rem", borderRadius: 99,
                            background: cfg.bg, color: cfg.cor,
                            fontSize: 11, fontWeight: 700,
                            border: p.prioridade === 3 ? "1px solid #fca5a5" : "none",
                            boxShadow: p.prioridade === 3 ? "0 0 6px #ef444428" : "none",
                          }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td>{p.servico_nome}</td>
                    <td>{p.responsavel_setor || "-"}</td>
                    <td>{p.responsavel_nome}</td>
                    <td>{String(p.data_entrada).slice(0, 10)}</td>
                    <td>
                      {(() => {
                        const hoje = new Date(); hoje.setHours(0,0,0,0);
                        const venc = new Date(p.data_vencimento); venc.setHours(0,0,0,0);
                        const diff = Math.ceil((venc - hoje) / (1000 * 60 * 60 * 24));
                        const isAtivo = !["concluido","concluído","cancelado"].includes((p.status||"").toLowerCase());
                        return (
                          <span style={{
                            fontWeight: isAtivo && diff < 0 ? 700 : isAtivo && diff <= 3 ? 600 : "normal",
                            color: isAtivo && diff < 0 ? "#dc2626" : isAtivo && diff <= 3 ? "#d97706" : "inherit",
                          }}>
                            {String(p.data_vencimento).slice(0, 10)}
                            {isAtivo && diff < 0 && <span style={{ marginLeft: 4, fontSize: 10 }}>⚠️ VENCIDO</span>}
                            {isAtivo && diff === 0 && <span style={{ marginLeft: 4, fontSize: 10 }}>🔴 HOJE</span>}
                            {isAtivo && diff > 0 && diff <= 3 && <span style={{ marginLeft: 4, fontSize: 10 }}>🟡 {diff}d</span>}
                          </span>
                        );
                      })()}
                    </td>
                    <td>
                      {p.tem_orcamento ? (
                        <span style={{ color: "#059669", fontWeight: 600 }}>
                          {formatMoeda(p.orcamento_valor)}
                          {p.orcamento_pago && " ✅"}
                        </span>
                      ) : (
                        <span style={{ color: "#9ca3af" }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className={statusBadgeClass(p.status)}>
                        {statusLabel(p.status)}
                      </span>
                    </td>
                    <td>
                      <div className="acoes-container">
                        {(usuario?.cargo === "Supervisor" || usuario?.cargo === "Coordenador") && (
                          <button
                            className="btn-action btn-action-edit"
                            onClick={() => abrirEdicao(p)}
                            title="Editar"
                          >
                            ✏️
                          </button>
                        )}
                        {(p.status === "andamento" ||
                          p.status === "concluido") && (
                          <button
                            className="btn-action btn-action-edit"
                            onClick={() => abrirModalServico(p)}
                            title={
                              p.status === "concluido"
                                ? "Adicionar Serviço (reabre o protocolo)"
                                : "Adicionar Serviço"
                            }
                          >
                            +
                          </button>
                        )}

                        {p.status === "andamento" && (
                          <button
                            className="btn-action btn-action-success"
                            onClick={() => concluir(p.id)}
                            title="Concluir"
                          >
                            ✓
                          </button>
                        )}
                        {p.status === "andamento" && (
                          <button
                            className="btn-action"
                            style={{ background: '#ede9fe', color: '#7c3aed' }}
                            onClick={() => abrirTransferencia(p)}
                            title="Transferir responsável"
                          >
                            🔄
                          </button>
                        )}
                        {usuario?.cargo === "Registrador" && p.status === "andamento" && (
                          sessoesAtivas.includes(p.id) ? (
                            <button
                              className="btn-action"
                              style={{ background: "#fef3c7", color: "#d97706", fontWeight: 700 }}
                              onClick={() => abrirModalPausa(p)}
                              disabled={salvandoSessao}
                              title="Pausar sessão (nota obrigatória)"
                            >
                              ⏸
                            </button>
                          ) : (
                            <button
                              className="btn-action"
                              style={{ background: "#dcfce7", color: "#16a34a", fontWeight: 700 }}
                              onClick={() => handleIniciarSessao(p)}
                              disabled={salvandoSessao}
                              title="Iniciar sessão de trabalho"
                            >
                              ▶
                            </button>
                          )
                        )}
                        {usuario?.cargo === "Registrador" && (
                          <button
                            className="btn-action btn-action-edit"
                            onClick={() => abrirModalOrcamento(p)}
                            title="Editar orçamento e prioridade"
                          >
                            💰
                          </button>
                        )}
                        <button
                          className="btn-action btn-action-edit"
                          onClick={() => abrirModalNotas(p)}
                          title="Notas"
                        >
                          📝
                        </button>
                        {usuario?.cargo !== "Registrador" && (
                          <button
                            className="btn-action btn-action-delete"
                            onClick={() => excluir(p.id)}
                            title="Excluir"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== Modal Novo/Editar ===== */}
      {modalOpen && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? "Editar Protocolo" : "Novo Protocolo"}</h2>

            <form onSubmit={salvar} onKeyDown={handleEnterKey}>
              <div className="form-group">
                <label htmlFor="numero">Número</label>
                <div style={{ position: "relative" }}>
                  <input
                    type="text"
                    id="numero"
                    className="form-input"
                    value={form.numero}
                    onChange={(e) => { setForm({ ...form, numero: e.target.value }); setNumeroStatus(null); }}
                    onBlur={(e) => verificarNumero(e.target.value)}
                    placeholder="Ex: 2026-000123"
                    disabled={!!editId && usuario?.cargo === "Registrador"}
                    required
                    style={{ borderColor: numeroStatus === "existente" ? "#f59e0b" : numeroStatus === "novo" ? "#10b981" : undefined }}
                  />
                  {verificandoNumero && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "#94a3b8" }}>⏳</span>}
                  {!verificandoNumero && numeroStatus === "novo" && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#10b981", fontWeight: 600 }}>✓ Novo</span>}
                  {!verificandoNumero && numeroStatus === "existente" && <span style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "#f59e0b", fontWeight: 600 }}>⚠️ Já existe</span>}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="servico">Serviço</label>
                <select
                  id="servico"
                  className="form-select"
                  value={form.servico_id}
                  onChange={(e) =>
                    setForm({ ...form, servico_id: e.target.value })
                  }
                  disabled={!!editId && usuario?.cargo === "Registrador"}
                  required
                >
                  <option value="">Selecione...</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} ({s.prazo}{" "}
                      {s.tipo_prazo === "uteis" ? "úteis" : "corridos"})
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
                  onChange={(e) =>
                    setForm({ ...form, data_entrada: e.target.value })
                  }
                  disabled={!!editId && usuario?.cargo === "Registrador"}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="responsavel">Responsável</label>
                <select
                  id="responsavel"
                  className="form-select"
                  value={form.responsavel_id}
                  onChange={(e) =>
                    setForm({ ...form, responsavel_id: e.target.value })
                  }
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

              {setorResponsavel && (
                <div
                  className="info-box"
                  style={{
                    background: "#f0f9ff",
                    border: "1px solid #bae6fd",
                    padding: "0.75rem",
                    borderRadius: "6px",
                    marginBottom: "1rem",
                  }}
                >
                  <strong>Setor:</strong> {setorResponsavel}
                </div>
              )}

              <div className="form-group">
                <label>Prioridade</label>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {[1, 2, 3].map((nivel) => {
                    const cfg = PRIORIDADE_CONFIG[nivel];
                    const ativo = Number(form.prioridade) === nivel;
                    return (
                      <button
                        key={nivel}
                        type="button"
                        onClick={() => setForm({ ...form, prioridade: nivel })}
                        style={{
                          flex: 1,
                          padding: "0.6rem",
                          borderRadius: 10,
                          border: ativo ? `2px solid ${cfg.cor}` : "2px solid #e5e7eb",
                          background: ativo ? cfg.bg : "white",
                          color: ativo ? cfg.cor : "#6b7280",
                          fontWeight: ativo ? 700 : 500,
                          fontSize: 13,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="observacoes">Observações</label>
                <textarea
                  id="observacoes"
                  className="form-input"
                  rows="3"
                  value={form.observacoes}
                  onChange={(e) =>
                    setForm({ ...form, observacoes: e.target.value })
                  }
                  placeholder="Detalhes do protocolo..."
                />
              </div>

              {/* ===== CAMPO ORÇAMENTO ===== */}
              <div className="form-group">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.tem_orcamento}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        tem_orcamento: e.target.checked,
                        orcamento_valor: "",
                      })
                    }
                    style={{ width: "16px", height: "16px" }}
                  />
                  <span style={{ fontWeight: 600 }}>💰 Possui Orçamento</span>
                </label>
              </div>

              {form.tem_orcamento && (
                <div
                  className="form-group"
                  style={{ animation: "fadeIn 0.2s ease" }}
                >
                  <label htmlFor="orcamento_valor">
                    Valor do Orçamento (R$)
                  </label>
                  <input
                    type="number"
                    id="orcamento_valor"
                    className="form-input"
                    value={form.orcamento_valor}
                    onChange={(e) =>
                      setForm({ ...form, orcamento_valor: e.target.value })
                    }
                    placeholder="Ex: 1500.00"
                    min="0.01"
                    step="0.01"
                    required={form.tem_orcamento}
                    style={{ borderColor: "#10b981" }}
                  />
                  {form.orcamento_valor && (
                    <small
                      style={{
                        color: "#059669",
                        marginTop: "0.25rem",
                        display: "block",
                      }}
                    >
                      {formatMoeda(parseFloat(form.orcamento_valor))}
                    </small>
                  )}
                </div>
              )}
              {/* ===== FIM ORÇAMENTO ===== */}

              {editId && (
                <div className="form-group">
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    className="form-select"
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                  >
                    {statusList.map((s) => (
                      <option key={s.nome} value={s.nome}>
                        {s.nome}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fecharModal}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar"}
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
                      {s.nome} ({s.prazo}{" "}
                      {s.tipo_prazo === "uteis" ? "úteis" : "corridos"})
                    </option>
                  ))}
                </select>
              </div>

              {servicoEscolhido && (
                <div className="info-box">
                  <strong>{servicoEscolhido.nome}</strong>
                  <br />
                  Prazo: {servicoEscolhido.prazo}{" "}
                  {servicoEscolhido.tipo_prazo === "uteis"
                    ? "dias úteis"
                    : "dias corridos"}
                </div>
              )}

              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={renovarPrazo}
                    onChange={(e) => setRenovarPrazo(e.target.checked)}
                  />{" "}
                  Renovar prazo (recalcular vencimento)
                </label>
                <small
                  style={{
                    display: "block",
                    marginTop: "0.25rem",
                    color: "#666",
                  }}
                >
                  Se desmarcado, mantém o prazo atual.
                </small>
              </div>

              {servicoResp && (
                <div className="alert alert-success">
                  Serviço adicionado! Vencimento: {servicoResp.data_vencimento}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={fecharModalServico}
                >
                  Fechar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? "Adicionando..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Notas e Histórico */}
      {modalNotasOpen && protocoloNotasSel && (
        <div className="modal-overlay" onClick={fecharModalNotas}>
          <div
            className="modal-content"
            style={{ maxWidth: "700px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2>Protocolo {protocoloNotasSel.numero}</h2>

            <div
              style={{
                display: "flex",
                gap: "1rem",
                borderBottom: "2px solid #e0e0e0",
                marginBottom: "1rem",
              }}
            >
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.75rem 1rem",
                  cursor: "pointer",
                  fontWeight: abaSelecionada === "notas" ? "bold" : "normal",
                  borderBottom:
                    abaSelecionada === "notas"
                      ? "3px solid #16a34a"
                      : "3px solid transparent",
                }}
                onClick={() => setAbaSelecionada("notas")}
              >
                📝 Notas ({notas.length})
              </button>
              <button
                style={{
                  background: "none",
                  border: "none",
                  padding: "0.75rem 1rem",
                  cursor: "pointer",
                  fontWeight:
                    abaSelecionada === "historico" ? "bold" : "normal",
                  borderBottom:
                    abaSelecionada === "historico"
                      ? "3px solid #16a34a"
                      : "3px solid transparent",
                }}
                onClick={() => setAbaSelecionada("historico")}
              >
                📜 Histórico ({historico.length})
              </button>
            </div>

            {loadingNotas && (
              <div style={{ textAlign: "center", padding: "2rem" }}>
                Carregando...
              </div>
            )}

            {!loadingNotas && abaSelecionada === "notas" && (
              <div>
                <form onSubmit={salvarNota} style={{ marginBottom: "1.5rem" }}>
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
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={saving}
                  >
                    {saving ? "Salvando..." : "Adicionar Nota"}
                  </button>
                </form>

                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {notas.length === 0 && (
                    <p
                      style={{
                        textAlign: "center",
                        color: "#666",
                        padding: "2rem",
                      }}
                    >
                      Nenhuma nota ainda.
                    </p>
                  )}
                  {notas.map((nota) => (
                    <div
                      key={nota.id}
                      style={{
                        background: "#f9fafb",
                        border: "1px solid #e5e7eb",
                        borderRadius: "8px",
                        padding: "1rem",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <div style={{ marginBottom: "0.5rem" }}>
                        <strong>{nota.usuario_nome || "Usuário"}</strong>{" "}
                        <span style={{ color: "#666", fontSize: "0.85rem" }}>
                          ({nota.usuario_setor || nota.usuario_cargo || "Cargo"}
                          )
                        </span>
                        <br />
                        <small style={{ color: "#999" }}>
                          {formatDateTime(nota.created_at)}
                        </small>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap" }}>{nota.nota}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loadingNotas && abaSelecionada === "historico" && (
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                {historico.length === 0 && (
                  <p
                    style={{
                      textAlign: "center",
                      color: "#666",
                      padding: "2rem",
                    }}
                  >
                    Nenhum registro no histórico
                  </p>
                )}
                {historico.map((h) => (
                  <div
                    key={h.id}
                    style={{
                      background: "#fefefe",
                      border: "1px solid #e5e7eb",
                      borderLeft: "4px solid #16a34a",
                      borderRadius: "4px",
                      padding: "1rem",
                      marginBottom: "0.75rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "0.5rem",
                      }}
                    >
                      <strong style={{ color: "#16a34a" }}>{h.acao}</strong>
                      <small style={{ color: "#999" }}>
                        {formatDateTime(h.created_at)}
                      </small>
                    </div>
                    <div style={{ marginBottom: "0.25rem" }}>{h.descricao}</div>
                    {h.usuario_nome && (
                      <small style={{ color: "#666" }}>
                        Por: {h.usuario_nome}{" "}
                        {h.usuario_setor && `(${h.usuario_setor})`} -{" "}
                        {h.usuario_email}
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="modal-actions" style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={fecharModalNotas}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TELA FILA DE ATENDIMENTO ===== */}
      {verFila && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1100, display: "flex", alignItems: "flex-start", justifyContent: "flex-end" }}>
          <div style={{ width: "min(640px, 100vw)", height: "100vh", background: "white", display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.15)" }}>
            {/* Header */}
            <div style={{ padding: "1.5rem", borderBottom: "1px solid #f3f4f6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg, #fffbeb, #fef3c7)" }}>
              <div>
                <h2 style={{ margin: 0, color: "#92400e", fontSize: "1.25rem" }}>🎫 Fila de Atendimento</h2>
                <p style={{ margin: 0, color: "#a16207", fontSize: 13 }}>{fila.length} protocolo(s) aguardando</p>
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button className="btn btn-primary" onClick={abrirModalAtendimento}>➕ Novo na Fila</button>
                <button className="btn btn-secondary" onClick={() => setVerFila(false)}>✕ Fechar</button>
              </div>
            </div>

            {/* Lista */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
              {loadingFila ? (
                <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>Carregando...</div>
              ) : fila.length === 0 ? (
                <div style={{ textAlign: "center", padding: "3rem" }}>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
                  <div style={{ color: "#64748b", fontWeight: 600 }}>Fila vazia! Nenhum protocolo aguardando.</div>
                </div>
              ) : (
                fila.map((p) => {
                  const cfg = PRIORIDADE_CONFIG[p.prioridade] || PRIORIDADE_CONFIG[2];
                  return (
                    <div key={p.id} style={{
                      border: `1px solid ${p.prioridade === 3 ? "#fca5a5" : "#e5e7eb"}`,
                      borderLeft: `4px solid ${cfg.cor}`,
                      borderRadius: 12,
                      padding: "1rem 1.25rem",
                      marginBottom: "0.75rem",
                      background: p.prioridade === 3 ? "#fff8f8" : "white",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "1rem",
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: 4 }}>
                          <strong style={{ fontSize: 16 }}>#{p.numero}</strong>
                          <span style={{ padding: "0.15rem 0.5rem", borderRadius: 99, background: cfg.bg, color: cfg.cor, fontSize: 11, fontWeight: 700 }}>
                            {cfg.emoji} {cfg.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "#64748b" }}>{p.servico_nome}</div>
                        {p.nome_cliente && <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, marginTop: 2 }}>👤 {p.nome_cliente}</div>}
                        {p.observacoes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontStyle: "italic" }}>{p.observacoes}</div>}
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Entrada: {String(p.data_entrada).slice(0, 10)}</div>
                      </div>
                      <button
                        className="btn btn-primary"
                        style={{ whiteSpace: "nowrap", background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                        onClick={() => { setProtocoloPuxar(p); setModalPuxarOpen(true); }}
                      >
                        📥 Puxar
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Novo na Fila (Atendimento) ===== */}
      {modalAtendOpen && (
        <div className="modal-overlay" onClick={() => setModalAtendOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, zIndex: 1200 }}>
            <h2>🎫 Enviar Protocolo para Fila</h2>

            <div className="form-group">
              <label className="form-label">Número do Protocolo *</label>
              <input className="form-input" value={formAtend.numero} onChange={(e) => setFormAtend({ ...formAtend, numero: e.target.value })} placeholder="Ex: 216500" />
            </div>

            <div className="form-group">
              <label className="form-label">Serviço *</label>
              <select className="form-select" value={formAtend.servico_id} onChange={(e) => setFormAtend({ ...formAtend, servico_id: e.target.value })}>
                <option value="">Selecione...</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Nome do Cliente</label>
              <input className="form-input" value={formAtend.nome_cliente} onChange={(e) => setFormAtend({ ...formAtend, nome_cliente: e.target.value })} placeholder="Nome do solicitante" />
            </div>

            <div className="form-group">
              <label className="form-label">Prioridade</label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {[1, 2, 3].map((nivel) => {
                  const cfg = PRIORIDADE_CONFIG[nivel];
                  const ativo = Number(formAtend.prioridade) === nivel;
                  return (
                    <button key={nivel} type="button" onClick={() => setFormAtend({ ...formAtend, prioridade: nivel })}
                      style={{ flex: 1, padding: "0.6rem", borderRadius: 10, border: ativo ? `2px solid ${cfg.cor}` : "2px solid #e5e7eb", background: ativo ? cfg.bg : "white", color: ativo ? cfg.cor : "#6b7280", fontWeight: ativo ? 700 : 500, fontSize: 13, cursor: "pointer" }}>
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Observações</label>
              <textarea className="form-input" rows="2" value={formAtend.observacoes} onChange={(e) => setFormAtend({ ...formAtend, observacoes: e.target.value })} placeholder="Informações adicionais..." />
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setModalAtendOpen(false)}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={salvarAtendimento} disabled={savingAtend} style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                {savingAtend ? "Enviando..." : "🎫 Enviar para Fila"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Puxar Protocolo ===== */}
      {modalPuxarOpen && protocoloPuxar && (
        <div className="modal-overlay" onClick={() => setModalPuxarOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440, zIndex: 1200 }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <span style={{ fontSize: "3rem" }}>📥</span>
            </div>
            <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Puxar Protocolo</h2>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: "1.5rem" }}>
              Protocolo <strong>#{protocoloPuxar.numero || protocoloPuxar.id}</strong>
              {protocoloPuxar.nome_cliente && <> — <strong>{protocoloPuxar.nome_cliente}</strong></>}
              <br />Deseja puxar este protocolo para você?
            </p>
            <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem", fontSize: 13, color: "#1e40af" }}>
              💡 O protocolo irá para <strong>Em andamento</strong> e ficará visível na sua lista.
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => { setModalPuxarOpen(false); setProtocoloPuxar(null); }}>Cancelar</button>
              <button type="button" className="btn btn-primary" onClick={() => puxarProtocolo(protocoloPuxar.protocolo_id || protocoloPuxar.id)} style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}>
                📥 Sim, puxar protocolo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal Conflito - Protocolo já existe ===== */}
      {modalConflitoOpen && conflitoInfo && (
        <div className="modal-overlay" onClick={() => setModalConflitoOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            {conflitoInfo.code === 'PROTOCOLO_CONCLUIDO' ? (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '3rem' }}>✅</span>
                </div>
                <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '0.5rem' }}>Protocolo já concluído</h2>
                <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem', fontSize: 14 }}>
                  Este protocolo foi concluído pelo registrador <strong>{conflitoInfo.responsavel_nome}</strong>.
                  <br />Selecione o novo serviço para reabri-lo.
                </p>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontWeight: 600, fontSize: 14, color: '#374151', display: 'block', marginBottom: 6 }}>Novo Serviço *</label>
                  <select
                    className="form-select"
                    value={conflitoInfo.novo_servico_id || ""}
                    onChange={(e) => setConflitoInfo({ ...conflitoInfo, novo_servico_id: e.target.value })}
                  >
                    <option value="">Selecione o serviço...</option>
                    {servicos.map((s) => (
                      <option key={s.id} value={s.id}>{s.nome}</option>
                    ))}
                  </select>
                </div>
                <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: 13, color: '#92400e' }}>
                  ⚠️ A produtividade de <strong>{conflitoInfo.responsavel_nome}</strong> será mantida. O prazo será recalculado com base no novo serviço.
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setModalConflitoOpen(false)}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmarReabertura}
                    disabled={transfSaving || !conflitoInfo.novo_servico_id}
                    style={{ background: '#10b981' }}
                  >
                    {transfSaving ? "Reabrindo..." : "✔ Sim, reabrir protocolo"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <span style={{ fontSize: '3rem' }}>⚠️</span>
                </div>
                <h2 style={{ textAlign: 'center', color: '#1e293b', marginBottom: '0.5rem' }}>Protocolo em andamento</h2>
                <p style={{ textAlign: 'center', color: '#64748b', marginBottom: '1.5rem', fontSize: 14 }}>
                  Este protocolo já existe e está <strong>em andamento</strong> com o registrador <strong>{conflitoInfo.responsavel_nome}</strong>.
                </p>
                <div style={{ background: '#dbeafe', border: '1px solid #93c5fd', borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: 13, color: '#1e40af' }}>
                  💡 Para assumir este protocolo, solicite ao registrador <strong>{conflitoInfo.responsavel_nome}</strong> ou ao Supervisor/Coordenador que realize a transferência.
                </div>
                <div className="modal-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setModalConflitoOpen(false)}>
                    Entendido
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ===== Modal Pausa de Sessão ===== */}
      {modalPausaOpen && protocoloPausaSel && (
        <div className="modal-overlay" onClick={fecharModalPausa}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ textAlign: "center", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "2.5rem" }}>⏸</span>
            </div>
            <h2 style={{ textAlign: "center", marginBottom: "0.25rem" }}>Pausar Sessão</h2>
            <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: "1.25rem" }}>
              Protocolo <strong>{protocoloPausaSel.numero}</strong>
            </p>

            <div style={{ background: "#fef3c7", border: "1px solid #f59e0b", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.25rem", fontSize: 13, color: "#92400e" }}>
              ⚠️ A nota é <strong>obrigatória</strong>. Descreva o que foi feito e o que está pendente.
            </div>

            <form onSubmit={handlePausarSessao}>
              <div className="form-group">
                <label htmlFor="nota-pausa">O que foi feito? O que está pendente? *</label>
                <textarea
                  id="nota-pausa"
                  className="form-input"
                  rows="4"
                  value={notaPausa}
                  onChange={(e) => setNotaPausa(e.target.value)}
                  placeholder="Ex: Analisado toda a documentação, falta assinar a certidão X e aguardar resposta do setor Y..."
                  required
                  autoFocus
                />
                <small style={{ color: "#6b7280", marginTop: "0.25rem", display: "block" }}>
                  {notaPausa.length} caractere(s)
                </small>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModalPausa}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={salvandoSessao || !notaPausa.trim()}
                  style={{ background: "#d97706" }}
                >
                  {salvandoSessao ? "Pausando..." : "⏸ Confirmar Pausa"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal Orçamento/Prioridade (Registrador) ===== */}
      {modalOrcamentoOpen && protocoloOrcamentoSel && (
        <div className="modal-overlay" onClick={fecharModalOrcamento}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2>💰 Orçamento e Prioridade</h2>
            <p style={{ color: "#64748b", fontSize: 14, marginBottom: "1.25rem" }}>
              Protocolo <strong>{protocoloOrcamentoSel.numero}</strong>
            </p>

            <form onSubmit={salvarOrcamento}>
              {/* Prioridade */}
              <div className="form-group">
                <label>Prioridade</label>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  {[1, 2, 3].map((nivel) => {
                    const cfg = PRIORIDADE_CONFIG[nivel];
                    const ativo = Number(formOrcamento.prioridade) === nivel;
                    return (
                      <button
                        key={nivel}
                        type="button"
                        onClick={() => setFormOrcamento({ ...formOrcamento, prioridade: nivel })}
                        style={{
                          flex: 1, padding: "0.6rem", borderRadius: 10,
                          border: ativo ? `2px solid ${cfg.cor}` : "2px solid #e5e7eb",
                          background: ativo ? cfg.bg : "white",
                          color: ativo ? cfg.cor : "#6b7280",
                          fontWeight: ativo ? 700 : 500, fontSize: 13, cursor: "pointer",
                        }}
                      >
                        {cfg.emoji} {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Orçamento */}
              <div className="form-group">
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formOrcamento.tem_orcamento}
                    onChange={(e) => setFormOrcamento({ ...formOrcamento, tem_orcamento: e.target.checked, orcamento_valor: "" })}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ fontWeight: 600 }}>💰 Possui Orçamento</span>
                </label>
              </div>

              {formOrcamento.tem_orcamento && (
                <div className="form-group">
                  <label htmlFor="orc-valor">Valor do Orçamento (R$)</label>
                  <input
                    type="number"
                    id="orc-valor"
                    className="form-input"
                    value={formOrcamento.orcamento_valor}
                    onChange={(e) => setFormOrcamento({ ...formOrcamento, orcamento_valor: e.target.value })}
                    placeholder="Ex: 1500.00"
                    min="0.01"
                    step="0.01"
                    required
                    style={{ borderColor: "#10b981" }}
                  />
                  {formOrcamento.orcamento_valor && (
                    <small style={{ color: "#059669", marginTop: "0.25rem", display: "block" }}>
                      {formatMoeda(parseFloat(formOrcamento.orcamento_valor))}
                    </small>
                  )}
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModalOrcamento}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingOrcamento}>
                  {savingOrcamento ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== Modal Transferência ===== */}
      {modalTransfOpen && transfProtocolo && (
        <div className="modal-overlay" onClick={fecharTransferencia}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <h2>🔄 Transferir Protocolo</h2>
            <p style={{ color: '#64748b', marginBottom: '1.25rem', fontSize: 14 }}>
              Protocolo <strong>{transfProtocolo.numero}</strong> — responsável atual: <strong>{transfProtocolo.responsavel_nome}</strong>
            </p>

            <div className="form-group">
              <label className="form-label">Novo responsável</label>
              <select
                className="form-select"
                value={transfResponsavel}
                onChange={(e) => setTransfResponsavel(e.target.value)}
              >
                <option value="">Selecione...</option>
                {funcionarios
                  .filter((f) => f.id !== transfProtocolo.responsavel_id)
                  .map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.nome} ({f.cargo}){f.setor ? ` — ${f.setor}` : ""}
                    </option>
                  ))}
              </select>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-secondary" onClick={fecharTransferencia}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={confirmarTransferencia}
                disabled={!transfResponsavel || transfSaving}
                style={{ background: '#7c3aed' }}
              >
                {transfSaving ? "Transferindo..." : "✔ Confirmar Transferência"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
