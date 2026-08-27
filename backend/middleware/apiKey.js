const pool = require('../config/database');

// Middleware para rotas públicas consumidas por sistemas externos (painel-
// corregedoria, integrações de produtividade). Não usa o JWT normal (clientes
// sem login) - exige uma chave via header X-API-Key.
//
// Aceita a chave fixa do .env (PAINEL_API_KEY, configurada no deploy) e/ou a
// chave gerada pela tela Configurações -> Painel Externo (Corregedoria),
// guardada na tabela `configuracoes`. Se nenhuma das duas estiver definida,
// a rota fica pública (comportamento antigo, mantido por compatibilidade).
const apiKeyMiddleware = async (req, res, next) => {
  try {
    let apiKeyBanco = null;
    try {
      const cfg = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'painel_api_key'");
      apiKeyBanco = cfg.rows[0]?.valor || null;
    } catch (e) {
      // Tabela "configuracoes" pode não existir ainda em bancos não migrados - ignora.
    }

    const chavesValidas = [process.env.PAINEL_API_KEY, apiKeyBanco].filter(Boolean);
    if (chavesValidas.length > 0 && !chavesValidas.includes(req.header('X-API-Key'))) {
      return res.status(401).json({ message: 'API key inválida ou ausente' });
    }
    next();
  } catch (error) {
    console.error('Erro no middleware de API key:', error);
    res.status(500).json({ message: 'Erro ao validar API key' });
  }
};

module.exports = { apiKeyMiddleware };
