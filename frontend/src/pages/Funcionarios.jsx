import React, { useEffect, useState } from 'react';
import { createFuncionario, deleteFuncionario, getFuncionarios, updateFuncionario } from '../services/api';

function Funcionarios() {
  const [itens, setItens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    nome: '',
    email: '',
    cargo: 'Escrevente',
    setor: '',
    senha: '',
  });

  const carregar = async () => {
    setLoading(true);
    setErro('');
    try {
      const res = await getFuncionarios();
      setItens(Array.isArray(res) ? res : []);
    } catch (e) {
      setErro(e?.message || 'Erro ao listar funcionários');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const abrirNovo = () => {
    setEditId(null);
    setForm({ nome: '', email: '', cargo: 'Escrevente', setor: '', senha: '' });
    setModalOpen(true);
  };

  const abrirEdicao = (u) => {
    setEditId(u.id);
    setForm({ 
      nome: u.nome || '', 
      email: u.email || '', 
      cargo: u.cargo || 'Escrevente', 
      setor: u.setor || '',
      senha: '' 
    });
    setModalOpen(true);
  };

  const fecharModal = () => {
    setModalOpen(false);
    setEditId(null);
    setSaving(false);
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSaving(true);
    setErro('');
    try {
      if (!form.nome || !form.email || !form.cargo) {
        throw new Error('Preencha nome, email e cargo');
      }

      if (editId) {
        await updateFuncionario(editId, { 
          nome: form.nome, 
          email: form.email, 
          cargo: form.cargo,
          setor: form.setor 
        });
      } else {
        if (!form.senha) throw new Error('Informe uma senha');
        await createFuncionario({ 
          nome: form.nome, 
          email: form.email, 
          cargo: form.cargo, 
          setor: form.setor,
          senha: form.senha 
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

  const remover = async (id) => {
    if (!window.confirm('Desativar este funcionário?')) return;
    setErro('');
    try {
      await deleteFuncionario(id);
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Erro ao desativar');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1>Funcionários</h1>
        <p>Cadastro e manutenção de usuários (Supervisor).</p>
      </div>

      {erro && <div className="alert alert-danger">{erro}</div>}

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Lista</h3>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary btn-sm" onClick={carregar} disabled={loading}>
              {loading ? '⟳' : '↻'}
            </button>
            <button className="btn btn-primary btn-sm" onClick={abrirNovo}>+ Novo</button>
          </div>
        </div>

        <div className="card-body">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Email</th>
                  <th>Cargo</th>
                  <th>Setor</th>
                  <th style={{ width: 220 }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>Carregando...</td></tr>
                )}
                {!loading && itens.length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center' }}>Nenhum funcionário cadastrado.</td></tr>
                )}
                {!loading && itens.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{u.nome}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <span className={`status-badge ${
                        u.cargo === 'Supervisor' ? 'info' : 
                        u.cargo === 'Auxiliar' ? 'success' : 
                        u.cargo === 'Escrevente' ? 'warning' : 'info'
                      }`}>
                        {u.cargo === 'Auxiliar' ? 'Registrador' : 
                         u.cargo === 'Escrevente' ? 'Coordenador' : 
                         u.cargo}
                      </span>
                    </td>
                    <td>{u.setor || '-'}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-action btn-edit" onClick={() => abrirEdicao(u)}>
                          Editar
                        </button>
                        <button className="btn-action btn-delete" onClick={() => remover(u.id)}>
                          Desativar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={fecharModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editId ? 'Editar Funcionário' : 'Novo Funcionário'}</h2>

            <form onSubmit={salvar}>
              <div className="form-group">
                <label htmlFor="nome">Nome</label>
                <input 
                  type="text"
                  id="nome"
                  className="form-input" 
                  value={form.nome} 
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} 
                  placeholder="Nome completo"
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input 
                  type="email"
                  id="email" 
                  className="form-input" 
                  value={form.email} 
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} 
                  placeholder="email@exemplo.com"
                  required 
                />
              </div>

              <div className="form-group">
                <label htmlFor="cargo">Cargo</label>
                <select 
                  id="cargo"
                  className="form-select" 
                  value={form.cargo} 
                  onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
                >
                  <option value="Supervisor">Supervisor</option>
                  <option value="Escrevente">Coordenador</option>
                  <option value="Auxiliar">Registrador</option>
                  <option value="Atendente">Atendente</option>
                </select>
              </div>

              {/* ✅ Campo Setor */}
              <div className="form-group">
                <label htmlFor="setor">Setor</label>
                <input 
                  type="text"
                  id="setor"
                  className="form-input" 
                  value={form.setor} 
                  onChange={(e) => setForm((f) => ({ ...f, setor: e.target.value }))} 
                  placeholder="Ex: Recursos Humanos, Financeiro, Jurídico..."
                />
                <small style={{ display: 'block', marginTop: '0.25rem', color: '#666' }}>
                  O setor será automaticamente vinculado aos protocolos deste funcionário
                </small>
              </div>

              {!editId && (
                <div className="form-group">
                  <label htmlFor="senha">Senha</label>
                  <input 
                    type="password"
                    id="senha" 
                    className="form-input" 
                    value={form.senha} 
                    onChange={(e) => setForm((f) => ({ ...f, senha: e.target.value }))} 
                    placeholder="Mínimo 6 caracteres"
                    required 
                  />
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={fecharModal} disabled={saving}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Salvando…' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Funcionarios;
