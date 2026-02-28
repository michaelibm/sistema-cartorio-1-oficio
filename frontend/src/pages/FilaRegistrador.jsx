import React, { useEffect, useState, useCallback } from "react";
import { API_URL } from "../services/api";
import "./Protocolos.css";

const PRIORIDADE_CONFIG = {
  1: { label: "Baixa",   cor: "#6b7280", bg: "#f3f4f6", emoji: "🔵" },
  2: { label: "Média",   cor: "#d97706", bg: "#fef3c7", emoji: "🟡" },
  3: { label: "Oficial", cor: "#dc2626", bg: "#fee2e2", emoji: "🔴" },
};

export default function FilaRegistrador({ usuario }) {
  const [fila, setFila] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selecionados, setSelecionados] = useState(new Set());
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [modalConfirm, setModalConfirm] = useState(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos?status=aguardando`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      const ordenada = Array.isArray(data)
        ? data.sort((a, b) => {
            if ((b.prioridade || 2) !== (a.prioridade || 2)) return (b.prioridade || 2) - (a.prioridade || 2);
            return new Date(a.data_entrada) - new Date(b.data_entrada);
          })
        : [];
      setFila(ordenada);
    } catch {
      setErro("Erro ao carregar fila");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
    const interval = setInterval(carregar, 30000);
    return () => clearInterval(interval);
  }, [carregar]);

  const toggleSelecionado = (id) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      novo.has(id) ? novo.delete(id) : novo.add(id);
      return novo;
    });
  };

  const puxarUm = async (protocoloId) => {
    const token = localStorage.getItem("token");
    const resp = await fetch(`${API_URL}/protocolos/${protocoloId}/transferir`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ novo_responsavel_id: usuario?.id, puxar_fila: true }),
    });
    return resp.ok;
  };

  const iniciarSelecionados = async () => {
    setIniciando(true);
    setErro(""); setSucesso("");
    let ok = 0;
    for (const id of selecionados) {
      if (await puxarUm(id)) ok++;
    }
    setSelecionados(new Set());
    setModalConfirm(null);
    await carregar();
    setSucesso(`✅ ${ok} protocolo(s) iniciado(s)! Acesse Protocolos para trabalhar.`);
    setTimeout(() => setSucesso(""), 7000);
    setIniciando(false);
  };

  const iniciarUm = async (p) => {
    setIniciando(true);
    setErro(""); setSucesso("");
    const ok = await puxarUm(p.id);
    setModalConfirm(null);
    await carregar();
    if (ok) {
      setSucesso(`✅ Protocolo #${p.numero} iniciado! Acesse Protocolos para trabalhar.`);
      setTimeout(() => setSucesso(""), 7000);
    } else {
      setErro(`Erro ao puxar protocolo #${p.numero}`);
    }
    setIniciando(false);
  };

  const oficiais = fila.filter((p) => (p.prioridade || 2) === 3);
  const demais   = fila.filter((p) => (p.prioridade || 2) !== 3);

  return (
    <div className="protocolos-container">
      <div className="protocolos-header">
        <h1 className="protocolos-title">📥 Fila de Atendimento</h1>
        <p className="protocolos-subtitle">Selecione os protocolos que deseja iniciar</p>
      </div>

      {erro && <div className="alert-moderno alert-error-moderno" style={{ marginBottom: "1rem" }}>{erro}</div>}
      {sucesso && (
        <div className="alert-moderno" style={{ background: "#f0fdf4", color: "#065f46", border: "1px solid #d1fae5", marginBottom: "1rem" }}>
          {sucesso}
        </div>
      )}

      {/* Barra de ação */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "1.25rem", padding: "1rem 1.25rem",
        background: "white", borderRadius: 12, border: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span style={{ color: "#64748b", fontSize: 14 }}>
            <strong style={{ color: "#1f2937" }}>{fila.length}</strong> na fila
            {selecionados.size > 0 && (
              <> · <strong style={{ color: "#f59e0b" }}>{selecionados.size}</strong> selecionado(s)</>
            )}
          </span>
          {selecionados.size > 0 && (
            <button onClick={() => setSelecionados(new Set())}
              style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
              Limpar seleção
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn btn-secondary" onClick={carregar} disabled={loading}>
            🔄 Atualizar
          </button>
          {selecionados.size > 0 && (
            <button className="btn btn-primary"
              style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
              onClick={() => setModalConfirm("multi")} disabled={iniciando}>
              ▶ Iniciar {selecionados.size} protocolo(s)
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "4rem", color: "#94a3b8" }}>
          <div style={{ fontSize: "2rem", marginBottom: "1rem" }}>⏳</div>
          Carregando fila...
        </div>
      ) : fila.length === 0 ? (
        <div style={{ textAlign: "center", padding: "5rem", background: "white", borderRadius: 16, border: "1px solid #e5e7eb" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem", color: "#1f2937", marginBottom: 8 }}>Fila vazia!</div>
          <div style={{ color: "#64748b" }}>Nenhum protocolo aguardando atendimento.</div>
        </div>
      ) : (
        <>
          {oficiais.length > 0 && (
            <div style={{ marginBottom: "1.5rem" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                🔴 PRIORIDADE OFICIAL ({oficiais.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {oficiais.map((p) => (
                  <CardProtocolo key={p.id} p={p} selecionado={selecionados.has(p.id)}
                    onToggle={() => toggleSelecionado(p.id)}
                    onPuxar={() => setModalConfirm(p)} />
                ))}
              </div>
            </div>
          )}

          {demais.length > 0 && (
            <div>
              {oficiais.length > 0 && (
                <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.75rem" }}>
                  OUTROS ({demais.length})
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {demais.map((p) => (
                  <CardProtocolo key={p.id} p={p} selecionado={selecionados.has(p.id)}
                    onToggle={() => toggleSelecionado(p.id)}
                    onPuxar={() => setModalConfirm(p)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal confirmação */}
      {modalConfirm && (
        <div className="modal-overlay" onClick={() => setModalConfirm(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div style={{ textAlign: "center", marginBottom: "1rem" }}>
              <span style={{ fontSize: "3rem" }}>📥</span>
            </div>
            <h2 style={{ textAlign: "center", marginBottom: "0.5rem" }}>Iniciar Atendimento</h2>

            {modalConfirm === "multi" ? (
              <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: "1.25rem" }}>
                Você vai iniciar <strong>{selecionados.size} protocolo(s)</strong> simultaneamente.<br />
                Todos vão para <strong>Em andamento</strong> na sua lista.
              </p>
            ) : (
              <p style={{ textAlign: "center", color: "#64748b", fontSize: 14, marginBottom: "1.25rem" }}>
                Protocolo <strong>#{modalConfirm.numero}</strong>
                {modalConfirm.nome_cliente && <> — <strong>{modalConfirm.nome_cliente}</strong></>}
                <br />Vai para <strong>Em andamento</strong> na sua lista.
              </p>
            )}

            <div style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem", fontSize: 13, color: "#1e40af" }}>
              💡 Acesse <strong>Protocolos</strong> para trabalhar neles após iniciar.
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModalConfirm(null)}>Cancelar</button>
              <button className="btn btn-primary"
                style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}
                onClick={modalConfirm === "multi" ? iniciarSelecionados : () => iniciarUm(modalConfirm)}
                disabled={iniciando}>
                {iniciando ? "⏳ Iniciando..." : "▶ Confirmar e Iniciar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CardProtocolo({ p, selecionado, onToggle, onPuxar }) {
  const cfg = PRIORIDADE_CONFIG[p.prioridade] || PRIORIDADE_CONFIG[2];
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const entrada = new Date(p.data_entrada); entrada.setHours(0, 0, 0, 0);
  const diasNaFila = Math.ceil((hoje - entrada) / (1000 * 60 * 60 * 24));

  return (
    <div onClick={onToggle} style={{
      border: `1px solid ${selecionado ? "#10b981" : p.prioridade === 3 ? "#fca5a5" : "#e5e7eb"}`,
      borderLeft: `4px solid ${selecionado ? "#10b981" : cfg.cor}`,
      borderRadius: 12, padding: "1rem 1.25rem",
      background: selecionado ? "#f0fdf4" : p.prioridade === 3 ? "#fff8f8" : "white",
      cursor: "pointer", transition: "all 0.15s",
      display: "flex", alignItems: "center", gap: "1rem",
      boxShadow: selecionado ? "0 0 0 2px #10b98140" : "none",
    }}>
      {/* Checkbox visual */}
      <div style={{
        width: 22, height: 22, borderRadius: 6, flexShrink: 0,
        border: `2px solid ${selecionado ? "#10b981" : "#d1d5db"}`,
        background: selecionado ? "#10b981" : "white",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, color: "white", fontWeight: 700,
      }}>
        {selecionado && "✓"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: 3 }}>
          <strong style={{ fontSize: 15, color: "#1f2937" }}>#{p.numero}</strong>
          <span style={{ padding: "0.15rem 0.5rem", borderRadius: 99, background: cfg.bg, color: cfg.cor, fontSize: 11, fontWeight: 700 }}>
            {cfg.emoji} {cfg.label}
          </span>
          {diasNaFila > 0 && (
            <span style={{ fontSize: 11, color: diasNaFila >= 2 ? "#dc2626" : "#d97706", fontWeight: 600 }}>
              ⏱ {diasNaFila}d na fila
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>{p.servico_nome}</div>
        {p.nome_cliente && <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, marginTop: 2 }}>👤 {p.nome_cliente}</div>}
        {p.observacoes && (
          <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2, fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {p.observacoes}
          </div>
        )}
      </div>

      <button className="btn btn-primary"
        style={{ whiteSpace: "nowrap", fontSize: 13, background: "linear-gradient(135deg,#f59e0b,#d97706)", flexShrink: 0 }}
        onClick={(e) => { e.stopPropagation(); onPuxar(); }}>
        📥 Puxar
      </button>
    </div>
  );
}
