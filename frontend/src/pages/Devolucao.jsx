import React, { useEffect, useState, useCallback } from "react";
import {
  getEncaminhamentosAtendimento,
  concluirEncaminhamentoAtendimento,
  consultarLocalizacaoProtocolo,
} from "../services/api";
import "./Protocolos.css";

const TIPO_LABEL = {
  orcamento: "Orçamento",
  nota_devolutiva: "Nota Devolutiva",
};

const formatarDataHora = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function Devolucao({ usuario }) {
  const [filtroStatus, setFiltroStatus] = useState("pendente");
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [concluindoId, setConcluindoId] = useState(null);

  const [busca, setBusca] = useState("");
  const [resultadosBusca, setResultadosBusca] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [erroBusca, setErroBusca] = useState("");

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const res = await getEncaminhamentosAtendimento(filtroStatus);
      setItens(Array.isArray(res) ? res : []);
    } catch (e) {
      setErro(e?.message || "Erro ao carregar encaminhamentos");
    } finally {
      setLoading(false);
    }
  }, [filtroStatus]);

  useEffect(() => { carregar(); }, [carregar]);

  const concluir = async (item) => {
    if (!window.confirm(`Marcar a devolução do protocolo #${item.protocolo_numero} como concluída?`)) return;
    setErro(""); setSucesso("");
    setConcluindoId(item.encaminhamento_id);
    try {
      await concluirEncaminhamentoAtendimento(item.encaminhamento_id);
      await carregar();
      setSucesso(`✅ Devolução do protocolo #${item.protocolo_numero} concluída.`);
      setTimeout(() => setSucesso(""), 7000);
    } catch (e) {
      setErro(e?.message || "Erro ao concluir devolução");
    } finally {
      setConcluindoId(null);
    }
  };

  const buscarLocalizacao = async (e) => {
    e.preventDefault();
    if (busca.trim().length < 2) return;
    setBuscando(true);
    setErroBusca("");
    setResultadosBusca(null);
    try {
      const res = await consultarLocalizacaoProtocolo(busca.trim());
      setResultadosBusca(Array.isArray(res) ? res : []);
    } catch (e) {
      setErroBusca(e?.message || "Erro ao consultar localização");
    } finally {
      setBuscando(false);
    }
  };

  return (
    <div className="protocolos-container">
      <div className="protocolos-header">
        <h1 className="protocolos-title">↩️ Devolução</h1>
        <p className="protocolos-subtitle">
          Protocolos enviados pelos registradores para o Atendimento (Orçamento / Nota Devolutiva).
        </p>
      </div>

      {erro && <div className="alert-moderno alert-error-moderno" style={{ marginBottom: "1rem" }}>⚠️ {erro}</div>}
      {sucesso && (
        <div className="alert-moderno" style={{ background: "#f0fdf4", color: "#065f46", border: "1px solid #d1fae5", marginBottom: "1rem" }}>
          {sucesso}
        </div>
      )}

      {/* ===== Consulta de localização ===== */}
      <div className="protocolos-card" style={{ padding: "1.5rem", marginBottom: "1.5rem" }}>
        <h3 style={{ margin: "0 0 1rem", color: "#1f2937", fontSize: "1.05rem", fontWeight: 700 }}>
          🔍 Com quem está o protocolo?
        </h3>
        <form onSubmit={buscarLocalizacao} style={{ display: "flex", gap: "0.75rem" }}>
          <input
            type="text"
            className="input-moderno"
            style={{ flex: 1 }}
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Número do protocolo ou nome do interessado..."
          />
          <button type="submit" className="btn-moderno btn-primary-moderno" disabled={buscando || busca.trim().length < 2}>
            {buscando ? "Buscando..." : "Buscar"}
          </button>
        </form>

        {erroBusca && <div className="alert-moderno alert-error-moderno" style={{ marginTop: "1rem" }}>{erroBusca}</div>}

        {resultadosBusca && (
          resultadosBusca.length === 0 ? (
            <div style={{ marginTop: "1rem", color: "#94a3b8", fontSize: 14 }}>Nenhum protocolo encontrado.</div>
          ) : (
            <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {resultadosBusca.map((r) => (
                <div key={r.protocolo_id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "1rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem 1.5rem", fontSize: 14 }}>
                    <div><strong>Protocolo:</strong> #{r.numero}</div>
                    <div><strong>Status atual:</strong> {r.status}</div>
                    <div><strong>Setor atual:</strong> {r.setor_atual || "-"}</div>
                    <div><strong>Responsável atual:</strong> {r.responsavel_atual || (r.setor_atual === "Atendimento" ? "Aguardando Atendimento" : "-")}</div>
                    <div>
                      <strong>Última movimentação:</strong>{" "}
                      {r.ultima_movimentacao ? formatarDataHora(r.ultima_movimentacao.em) : "-"}
                    </div>
                    <div><strong>Origem anterior:</strong> {r.origem_anterior || "-"}</div>
                  </div>
                  {r.encaminhamento_atendimento && (
                    <div style={{ marginTop: 8, fontSize: 12, color: "#1d4ed8" }}>
                      📨 {TIPO_LABEL[r.encaminhamento_atendimento.tipo] || r.encaminhamento_atendimento.tipo}
                      {r.encaminhamento_atendimento.onr && " · ONR"}
                      {" · "}
                      {r.encaminhamento_atendimento.status === "pendente" ? "Pendente de Devolução" : "Devolução Concluída"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* ===== Listagem de encaminhamentos ===== */}
      <div className="protocolos-card">
        <div className="card-header-protocolos">
          <h2 className="card-title-protocolos">Protocolos Encaminhados</h2>
          <div className="filtros-area">
            <select
              className="select-moderno"
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
            >
              <option value="pendente">Pendente de Devolução</option>
              <option value="concluido">Devolução Concluída</option>
              <option value="todos">Todos</option>
            </select>
            <button className="btn btn-secondary" onClick={carregar} disabled={loading}>
              🔄 Atualizar
            </button>
          </div>
        </div>

        <div className="table-container">
          <table className="table-moderno">
            <thead>
              <tr>
                <th>Número</th>
                <th>Data do Protocolo</th>
                <th>Enviado em</th>
                <th>Tipo</th>
                <th>ONR</th>
                <th>Enviado por</th>
                <th>Setor Origem</th>
                <th>Responsável Atual</th>
                <th>Status</th>
                <th style={{ position: "sticky", right: 0, background: "#f9fafb" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan="10" style={{ textAlign: "center" }}>Carregando...</td></tr>
              )}
              {!loading && itens.length === 0 && (
                <tr><td colSpan="10" style={{ textAlign: "center" }}>Nenhum protocolo encontrado.</td></tr>
              )}
              {!loading && itens.map((item) => (
                <tr key={item.encaminhamento_id}>
                  <td><strong>#{item.protocolo_numero}</strong></td>
                  <td>{String(item.protocolo_data_entrada).slice(0, 10)}</td>
                  <td>{formatarDataHora(item.enviado_em)}</td>
                  <td>{TIPO_LABEL[item.tipo] || item.tipo}</td>
                  <td>
                    {item.onr && (
                      <span style={{ background: "#fef3c7", color: "#92400e", padding: "0.15rem 0.5rem", borderRadius: 99, fontSize: 11, fontWeight: 700 }}>
                        ONR
                      </span>
                    )}
                  </td>
                  <td>{item.enviado_por_nome || "-"}</td>
                  <td>{item.setor_origem || "-"}</td>
                  <td>{item.responsavel_atual_nome || "-"}</td>
                  <td>
                    <span className={item.status === "pendente" ? "badge-moderno badge-warning-moderno" : "badge-moderno badge-success-moderno"}>
                      {item.status === "pendente" ? "Pendente de Devolução" : "Devolução Concluída"}
                    </span>
                  </td>
                  <td style={{ position: "sticky", right: 0, background: "#fff", boxShadow: "-6px 0 6px -6px rgba(0,0,0,0.15)" }}>
                    {item.status === "pendente" ? (
                      <button
                        className="btn-action"
                        style={{ background: "#dcfce7", color: "#16a34a", fontWeight: 700, whiteSpace: "nowrap" }}
                        onClick={() => concluir(item)}
                        disabled={concluindoId === item.encaminhamento_id}
                        title="Marcar como Concluído"
                      >
                        {concluindoId === item.encaminhamento_id ? "⏳" : "✓ Marcar como Concluído"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 12, color: "#94a3b8" }}>
                        Concluído por {item.concluido_por_nome || "-"} em {formatarDataHora(item.concluido_em)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
