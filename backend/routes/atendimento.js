const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

const CARGOS_ATENDIMENTO = ['Atendente', 'Supervisor', 'Coordenador'];

function checarPermissaoAtendimento(req, res) {
  if (!CARGOS_ATENDIMENTO.includes(req.user.cargo)) {
    res.status(403).json({ message: 'Apenas o setor de Atendimento pode acessar isto' });
    return false;
  }
  return true;
}

// GET /api/atendimento/encaminhamentos - aba "Devolução"
// ?status=pendente (padrão) | concluido | todos
router.get('/encaminhamentos', authMiddleware, async (req, res) => {
  try {
    if (!checarPermissaoAtendimento(req, res)) return;

    const status = req.query.status || 'pendente';
    const params = [];
    let condStatus = '';
    if (status !== 'todos') {
      params.push(status);
      condStatus = `WHERE e.status = $${params.length}`;
    }

    const result = await pool.query(`
      SELECT
        e.id as encaminhamento_id, e.protocolo_id, e.tipo, e.onr,
        e.setor_origem, e.enviado_em, e.status,
        e.concluido_em,
        p.numero as protocolo_numero, p.data_entrada as protocolo_data_entrada,
        p.nome_cliente,
        env.id as enviado_por_id, env.nome as enviado_por_nome,
        conc.nome as concluido_por_nome,
        resp.id as responsavel_atual_id, resp.nome as responsavel_atual_nome,
        resp.setor as responsavel_atual_setor
      FROM protocolo_encaminhamentos_atendimento e
      JOIN protocolos p ON e.protocolo_id = p.id
      LEFT JOIN usuarios env ON e.enviado_por_id = env.id
      LEFT JOIN usuarios conc ON e.concluido_por_id = conc.id
      LEFT JOIN usuarios resp ON p.responsavel_id = resp.id
      ${condStatus}
      ORDER BY e.enviado_em DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar encaminhamentos de atendimento:', error);
    res.status(500).json({ message: 'Erro ao listar encaminhamentos' });
  }
});

// PATCH /api/atendimento/encaminhamentos/:id/concluir
router.patch('/encaminhamentos/:id/concluir', authMiddleware, async (req, res) => {
  try {
    if (!checarPermissaoAtendimento(req, res)) return;

    const { id } = req.params;
    const atual = await pool.query('SELECT id, protocolo_id, status FROM protocolo_encaminhamentos_atendimento WHERE id = $1', [id]);
    if (!atual.rows.length) {
      return res.status(404).json({ message: 'Encaminhamento não encontrado' });
    }
    const e = atual.rows[0];
    if (e.status === 'concluido') {
      return res.status(400).json({ message: 'Este encaminhamento já está concluído' });
    }

    await pool.query(
      `UPDATE protocolo_encaminhamentos_atendimento
       SET status = 'concluido', concluido_por_id = $1, concluido_em = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [req.user.id, id]
    );

    const protocolo = await pool.query('SELECT numero FROM protocolos WHERE id = $1', [e.protocolo_id]);
    const nomeUsuario = req.user.nome || req.user.email;
    await pool.query(
      'INSERT INTO historico (protocolo_id, usuario_id, acao, descricao, created_at) VALUES ($1, $2, $3, $4, NOW())',
      [
        e.protocolo_id, req.user.id, 'DEVOLUCAO_CONCLUIDA',
        `Devolução do Atendimento concluída por ${nomeUsuario} (protocolo ${protocolo.rows[0]?.numero}) - status anterior: Pendente de Devolução, novo status: Devolução Concluída`,
      ]
    );

    res.json({ message: 'Devolução marcada como concluída' });
  } catch (error) {
    console.error('Erro ao concluir devolução:', error);
    res.status(500).json({ message: 'Erro ao concluir devolução' });
  }
});

// GET /api/atendimento/localizacao?busca=168461
// Busca por número do protocolo ou nome do interessado/cliente.
router.get('/localizacao', authMiddleware, async (req, res) => {
  try {
    if (!checarPermissaoAtendimento(req, res)) return;

    const busca = (req.query.busca || '').trim();
    if (busca.length < 2) {
      return res.status(400).json({ message: 'Digite pelo menos 2 caracteres para buscar.' });
    }

    const result = await pool.query(`
      SELECT
        p.id, p.numero, p.status, p.data_entrada, p.nome_cliente,
        resp.id as responsavel_id, resp.nome as responsavel_nome, resp.setor as responsavel_setor,
        enc.status as encaminhamento_status, enc.setor_origem as encaminhamento_setor_origem,
        enc.enviado_em as encaminhamento_enviado_em, enc.tipo as encaminhamento_tipo, enc.onr as encaminhamento_onr,
        hist.created_at as ultima_movimentacao_em, hist.acao as ultima_movimentacao_acao, hist.descricao as ultima_movimentacao_descricao
      FROM protocolos p
      JOIN usuarios resp ON p.responsavel_id = resp.id
      LEFT JOIN LATERAL (
        SELECT * FROM protocolo_encaminhamentos_atendimento e
        WHERE e.protocolo_id = p.id
        ORDER BY e.enviado_em DESC
        LIMIT 1
      ) enc ON true
      LEFT JOIN LATERAL (
        SELECT created_at, acao, descricao FROM historico h
        WHERE h.protocolo_id = p.id
        ORDER BY h.created_at DESC
        LIMIT 1
      ) hist ON true
      WHERE p.numero ILIKE $1 OR p.nome_cliente ILIKE $1
      ORDER BY p.data_entrada DESC
      LIMIT 15
    `, [`%${busca}%`]);

    const itens = result.rows.map((p) => {
      const emAtendimento = p.encaminhamento_status === 'pendente';
      return {
        protocolo_id: p.id,
        numero: p.numero,
        status: p.status,
        data_entrada: p.data_entrada,
        nome_cliente: p.nome_cliente,
        setor_atual: emAtendimento ? 'Atendimento' : (p.responsavel_setor || null),
        responsavel_atual: emAtendimento ? null : p.responsavel_nome,
        origem_anterior: p.encaminhamento_setor_origem || null,
        encaminhamento_atendimento: p.encaminhamento_status
          ? { status: p.encaminhamento_status, tipo: p.encaminhamento_tipo, onr: p.encaminhamento_onr, enviado_em: p.encaminhamento_enviado_em }
          : null,
        ultima_movimentacao: p.ultima_movimentacao_em
          ? { em: p.ultima_movimentacao_em, acao: p.ultima_movimentacao_acao, descricao: p.ultima_movimentacao_descricao }
          : null,
      };
    });

    res.json(itens);
  } catch (error) {
    console.error('Erro ao consultar localização de protocolo:', error);
    res.status(500).json({ message: 'Erro ao consultar localização' });
  }
});

module.exports = router;
