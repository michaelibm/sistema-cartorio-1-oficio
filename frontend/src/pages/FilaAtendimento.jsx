import React, { useEffect, useState, useCallback } from "react";
import { API_URL, getServicos } from "../services/api";
import "./Protocolos.css";

const PRIORIDADE_CONFIG = {
  1: { label: "Baixa",   cor: "#6b7280", bg: "#f3f4f6", emoji: "🔵" },
  2: { label: "Média",   cor: "#d97706", bg: "#fef3c7", emoji: "🟡" },
  3: { label: "Oficial", cor: "#dc2626", bg: "#fee2e2", emoji: "🔴" },
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export default function FilaAtendimento({ usuario }) {
  const [servicos, setServicos] = useState([]);
  const [minhaFila, setMinhaFila] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState("");
  const [form, setForm] = useState({
    numero: "",
    servico_id: "",
    nome_cliente: "",
    observacoes: "",
    prioridade: 2,
  });

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const [s, fila] = await Promise.all([
        getServicos(),
        fetch(`${API_URL}/protocolos?status=aguardando`, {
          headers: { Authorization: `Bearer ${token}` },
        }).then((r) => r.json()),
      ]);
      setServicos(Array.isArray(s) ? s : []);
      const filaFiltrada = Array.isArray(fila)
        ? fila.filter((p) => p.responsavel_id === usuario?.id)
        : [];
      setMinhaFila(filaFiltrada.sort((a, b) => (b.prioridade || 2) - (a.prioridade || 2)));
    } catch {
      setErro("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  }, [usuario?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (servicos.length > 0 && !form.servico_id) {
      setForm((f) => ({ ...f, servico_id: String(servicos[0].id) }));
    }
  }, [servicos]); // eslint-disable-line

  const enviar = async (e) => {
    e.preventDefault();
    setErro(""); setSucesso("");
    if (!form.numero.trim() || !form.servico_id) {
      setErro("Preencha o número do protocolo e o serviço.");
      return;
    }
    setSaving(true);
    try {
      const token = localStorage.getItem("token");
      const resp = await fetch(`${API_URL}/protocolos`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          numero: form.numero.trim(),
          servico_id: Number(form.servico_id),
          responsavel_id: Number(usuario?.id),
          data_entrada: todayISO(),
          nome_cliente: form.nome_cliente.trim() || null,
          observacoes: form.observacoes.trim() || null,
          prioridade: Number(form.prioridade),
          status: "aguardando",
          tem_orcamento: false,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        if (data.code === "PROTOCOLO_AGUARDANDO")
          setErro(`⚠️ Protocolo ${form.numero} já está na fila aguardando um registrador.`);
        else if (data.code === "PROTOCOLO_EM_ANDAMENTO")
          setErro(`⚠️ Protocolo ${form.numero} já está em andamento com ${data.responsavel_nome}.`);
        else if (data.code === "PROTOCOLO_CONCLUIDO")
          setErro(`⚠️ Protocolo ${form.numero} já foi concluído por ${data.responsavel_nome}.`);
        else
          setErro(data.message || "Erro ao enviar protocolo.");
        return;
      }
      setSucesso(`✅ Protocolo ${form.numero} enviado para a fila!`);
      setForm((f) => ({ numero: "", servico_id: f.servico_id, nome_cliente: "", observacoes: "", prioridade: 2 }));
      carregar();
      setTimeout(() => setSucesso(""), 5000);
    } catch {
      setErro("Erro de conexão. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="protocolos-container">
      <div className="protocolos-header">
        <h1 className="protocolos-title">🎫 Balcão de Atendimento</h1>
        <p className="protocolos-subtitle">
          Olá, <strong>{usuario?.nome}</strong>! Registre os protocolos recebidos para os registradores.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* Formulário */}
        <div className="protocolos-card" style={{ padding: "1.75rem" }}>
          <h3 style={{ margin: "0 0 1.5rem", color: "#1f2937", fontSize: "1.1rem", fontWeight: 700 }}>
            📋 Novo Protocolo na Fila
          </h3>

          {erro && <div className="alert-moderno alert-error-moderno" style={{ marginBottom: "1.25rem" }}>{erro}</div>}
          {sucesso && (
            <div className="alert-moderno" style={{ background: "#f0fdf4", color: "#065f46", border: "1px solid #d1fae5", marginBottom: "1.25rem" }}>
              {sucesso}
            </div>
          )}

          <form onSubmit={enviar}>
            <div className="form-group">
              <label>Número do Protocolo *</label>
              <input className="form-input" value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                placeholder="Ex: 216500" autoFocus
                style={{ fontSize: "1.1rem", fontWeight: 600 }} />
            </div>

            <div className="form-group">
              <label>Serviço *</label>
              <select className="form-select" value={form.servico_id}
                onChange={(e) => setForm({ ...form, servico_id: e.target.value })}>
                <option value="">Selecione o serviço...</option>
                {servicos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label>Nome do Cliente</label>
              <input className="form-input" value={form.nome_cliente}
                onChange={(e) => setForm({ ...form, nome_cliente: e.target.value })}
                placeholder="Nome do solicitante" />
            </div>

            <div className="form-group">
              <label>Prioridade</label>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                {[1, 2, 3].map((nivel) => {
                  const cfg = PRIORIDADE_CONFIG[nivel];
                  const ativo = Number(form.prioridade) === nivel;
                  return (
                    <button key={nivel} type="button" onClick={() => setForm({ ...form, prioridade: nivel })}
                      style={{
                        flex: 1, padding: "0.7rem", borderRadius: 10,
                        border: ativo ? `2px solid ${cfg.cor}` : "2px solid #e5e7eb",
                        background: ativo ? cfg.bg : "white", color: ativo ? cfg.cor : "#6b7280",
                        fontWeight: ativo ? 700 : 500, fontSize: 13, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                      }}>
                      {cfg.emoji} {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="form-group">
              <label>Observações para o Registrador</label>
              <textarea className="form-input" rows="2" value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Informações importantes..." />
            </div>

            <button type="submit" disabled={saving} style={{
              width: "100%", padding: "0.9rem",
              background: saving ? "#9ca3af" : "linear-gradient(135deg, #f59e0b, #d97706)",
              color: "white", border: "none", borderRadius: 10,
              fontSize: "1rem", fontWeight: 700, cursor: saving ? "not-allowed" : "pointer",
              boxShadow: saving ? "none" : "0 4px 12px rgba(245,158,11,0.3)",
            }}>
              {saving ? "⏳ Enviando..." : "🎫 Enviar para a Fila"}
            </button>
          </form>
        </div>

        {/* Minha fila */}
        <div className="protocolos-card" style={{ padding: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem" }}>
            <h3 style={{ margin: 0, color: "#1f2937", fontSize: "1.1rem", fontWeight: 700 }}>📬 Enviados por mim</h3>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ background: "#fef3c7", color: "#92400e", padding: "0.25rem 0.75rem", borderRadius: 99, fontSize: 13, fontWeight: 700 }}>
                {minhaFila.length} aguardando
              </span>
              <button onClick={carregar} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "#94a3b8" }} title="Atualizar">🔄</button>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: "center", padding: "3rem", color: "#94a3b8" }}>Carregando...</div>
          ) : minhaFila.length === 0 ? (
            <div style={{ textAlign: "center", padding: "3rem" }}>
              <div style={{ fontSize: "3rem", marginBottom: "0.75rem" }}>✅</div>
              <div style={{ color: "#64748b", fontWeight: 600 }}>Nenhum protocolo aguardando.</div>
              <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Os registradores puxaram tudo!</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", maxHeight: 520, overflowY: "auto" }}>
              {minhaFila.map((p) => {
                const cfg = PRIORIDADE_CONFIG[p.prioridade] || PRIORIDADE_CONFIG[2];
                return (
                  <div key={p.id} style={{
                    border: `1px solid ${p.prioridade === 3 ? "#fca5a5" : "#e5e7eb"}`,
                    borderLeft: `4px solid ${cfg.cor}`, borderRadius: 10,
                    padding: "0.875rem 1rem",
                    background: p.prioridade === 3 ? "#fff8f8" : "#fafafa",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 15, color: "#1f2937" }}>#{p.numero}</div>
                        <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{p.servico_nome}</div>
                        {p.nome_cliente && <div style={{ fontSize: 13, color: "#374151", fontWeight: 500, marginTop: 2 }}>👤 {p.nome_cliente}</div>}
                        {p.observacoes && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4, fontStyle: "italic" }}>{p.observacoes}</div>}
                      </div>
                      <span style={{ padding: "0.2rem 0.6rem", borderRadius: 99, background: cfg.bg, color: cfg.cor, fontSize: 11, fontWeight: 700 }}>
                        {cfg.emoji} {cfg.label}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: "#cbd5e1", marginTop: 6 }}>
                      Enviado em {String(p.data_entrada).slice(0, 10)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
