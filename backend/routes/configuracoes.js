const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../config/database');
const { authMiddleware, supervisorOnly } = require('../middleware/auth');

// Consulta a chave de API do painel externo (painel-corregedoria)
router.get('/painel-api-key', authMiddleware, supervisorOnly, async (req, res) => {
  try {
    const result = await pool.query("SELECT valor FROM configuracoes WHERE chave = 'painel_api_key'");
    res.json({ valor: result.rows[0]?.valor || null });
  } catch (error) {
    console.error('Erro ao buscar chave do painel:', error);
    res.status(500).json({ message: 'Erro ao buscar chave do painel' });
  }
});

// Gera (ou substitui) a chave de API do painel externo
router.post('/painel-api-key/gerar', authMiddleware, supervisorOnly, async (req, res) => {
  try {
    const novaChave = crypto.randomBytes(24).toString('hex');
    await pool.query(
      `INSERT INTO configuracoes (chave, valor, updated_at)
       VALUES ('painel_api_key', $1, NOW())
       ON CONFLICT (chave) DO UPDATE SET valor = $1, updated_at = NOW()`,
      [novaChave]
    );
    res.json({ valor: novaChave });
  } catch (error) {
    console.error('Erro ao gerar chave do painel:', error);
    res.status(500).json({ message: 'Erro ao gerar chave do painel' });
  }
});

module.exports = router;
