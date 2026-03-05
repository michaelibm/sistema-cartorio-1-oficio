

// frontend/src/services/api.js
export const API_URL = 
  import.meta.env.VITE_API_URL || "http://localhost:5000/api";


function getToken() {
  return localStorage.getItem('token');
}

function getAuthHeader() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handleResponse(response) {
  if (!response.ok) {
    let errorMessage = `Erro ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.message || errorMessage;
    } catch (e) {
      // Se não conseguir parsear JSON, usa mensagem padrão
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

// AUTH
export const login = async (email, senha) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  return handleResponse(response);
};

export const register = async (dados) => {
  const response = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

// PROTOCOLOS
export const getProtocolos = async (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  const response = await fetch(`${API_URL}/protocolos?${params.toString()}`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getProtocolo = async (id) => {
  const response = await fetch(`${API_URL}/protocolos/${id}`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const createProtocolo = async (dados) => {
  const response = await fetch(`${API_URL}/protocolos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const updateProtocolo = async (id, dados) => {
  const response = await fetch(`${API_URL}/protocolos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const deleteProtocolo = async (id) => {
  const response = await fetch(`${API_URL}/protocolos/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const addServicoAoProtocolo = async (protocoloId, { servico_id, renovarPrazo }) => {
  const response = await fetch(`${API_URL}/protocolos/${protocoloId}/adicionar-servico`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ servico_id, renovarPrazo: !!renovarPrazo }),
  });
  return handleResponse(response);
};

export const concluirProtocolo = async (id) => {
  const response = await fetch(`${API_URL}/protocolos/${id}/concluir`, {
    method: 'PATCH',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// ✅ NOTAS
export const addNota = async (protocoloId, nota) => {
  const response = await fetch(`${API_URL}/protocolos/${protocoloId}/notas`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify({ nota }),
  });
  return handleResponse(response);
};

export const getNotas = async (protocoloId) => {
  const response = await fetch(`${API_URL}/protocolos/${protocoloId}/notas`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// ✅ HISTÓRICO
export const getHistorico = async (protocoloId) => {
  const response = await fetch(`${API_URL}/protocolos/${protocoloId}/historico`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getDashboardStats = async () => {
  const response = await fetch(`${API_URL}/protocolos/dashboard/stats`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// SERVIÇOS
export const getServicos = async () => {
  const response = await fetch(`${API_URL}/servicos`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const createServico = async (dados) => {
  const response = await fetch(`${API_URL}/servicos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const updateServico = async (id, dados) => {
  const response = await fetch(`${API_URL}/servicos/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const deleteServico = async (id) => {
  const response = await fetch(`${API_URL}/servicos/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// FUNCIONÁRIOS
export const getFuncionarios = async () => {
  const response = await fetch(`${API_URL}/funcionarios`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const createFuncionario = async (dados) => {
  const response = await fetch(`${API_URL}/funcionarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const updateFuncionario = async (id, dados) => {
  const response = await fetch(`${API_URL}/funcionarios/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const deleteFuncionario = async (id) => {
  const response = await fetch(`${API_URL}/funcionarios/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// FERIADOS
export const getFeriados = async () => {
  const response = await fetch(`${API_URL}/feriados`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const createFeriado = async (dados) => {
  const response = await fetch(`${API_URL}/feriados`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeader(),
    },
    body: JSON.stringify(dados),
  });
  return handleResponse(response);
};

export const deleteFeriado = async (id) => {
  const response = await fetch(`${API_URL}/feriados/${id}`, {
    method: 'DELETE',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// RELATÓRIOS
export const getRelatorioGeral = async (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  const response = await fetch(`${API_URL}/relatorios/geral?${params.toString()}`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getRelatorioPorFuncionario = async (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  const response = await fetch(`${API_URL}/relatorios/por-funcionario?${params.toString()}`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getRelatorioPorServico = async (filtros = {}) => {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, value);
    }
  });
  
  const response = await fetch(`${API_URL}/relatorios/por-servico?${params.toString()}`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getProtocolosVencendo = async () => {
  const response = await fetch(`${API_URL}/relatorios/vencendo`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getProtocolosAtrasados = async () => {
  const response = await fetch(`${API_URL}/relatorios/atrasados`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const getHistoricoProtocolo = async (protocoloId) => {
  const response = await fetch(`${API_URL}/relatorios/historico/${protocoloId}`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// SESSÕES DE TRABALHO
export const iniciarSessao = async (protocoloId) => {
  const response = await fetch(`${API_URL}/protocolos/${protocoloId}/iniciar`, {
    method: 'POST',
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

export const pausarSessao = async (protocoloId, nota) => {
  const response = await fetch(`${API_URL}/protocolos/${protocoloId}/pausar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
    body: JSON.stringify({ nota }),
  });
  return handleResponse(response);
};

export const getSessoesAtivas = async () => {
  const response = await fetch(`${API_URL}/protocolos/minhas-sessoes`, {
    headers: getAuthHeader(),
  });
  return handleResponse(response);
};

// Export default
export default {
  login,
  register,
  getProtocolos,
  getProtocolo,
  createProtocolo,
  updateProtocolo,
  deleteProtocolo,
  addServicoAoProtocolo,
  concluirProtocolo,
  addNota,
  getNotas,
  getHistorico,
  getDashboardStats,
  getServicos,
  createServico,
  updateServico,
  deleteServico,
  getFuncionarios,
  createFuncionario,
  updateFuncionario,
  deleteFuncionario,
  getFeriados,
  createFeriado,
  deleteFeriado,
  getRelatorioGeral,
  getRelatorioPorFuncionario,
  getRelatorioPorServico,
  getProtocolosVencendo,
  getProtocolosAtrasados,
  getHistoricoProtocolo,
  iniciarSessao,
  pausarSessao,
  getSessoesAtivas,
};
