const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtps.uhserver.com',
  port:   parseInt(process.env.SMTP_PORT) || 465,
  secure: process.env.SMTP_SECURE !== 'false', // true = SSL/TLS na porta 465
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false, // aceita certificados do servidor UHServer
  },
});

(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS usucapiao (
        id SERIAL PRIMARY KEY,
        nome_requerente     VARCHAR(255) NOT NULL,
        data_entrada        DATE NOT NULL,
        numero_matricula    VARCHAR(100) NOT NULL,
        status              VARCHAR(20) DEFAULT 'em_andamento'
          CHECK (status IN ('em_andamento', 'concluido', 'cancelado')),
        observacoes         TEXT,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const colunas = [
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS numero_recepcao            VARCHAR(100)`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS titulo                      VARCHAR(20) DEFAULT 'usucapiao'`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS responsavel_analise         VARCHAR(255)`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS email_cliente               VARCHAR(255)`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS data_envio_atendimento      DATE`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS enviado_atendimento_por     VARCHAR(255)`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS data_envio_cliente          DATE`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS data_envio_email            DATE`,
      `ALTER TABLE usucapiao ADD COLUMN IF NOT EXISTS data_nova_entrada           DATE`,
    ];
    for (const sql of colunas) await pool.query(sql);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS usucapiao_notas (
        id            SERIAL PRIMARY KEY,
        usucapiao_id  INTEGER REFERENCES usucapiao(id) ON DELETE CASCADE,
        usuario_nome  VARCHAR(255),
        nota          TEXT NOT NULL,
        created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  } catch (err) {
    console.error('Erro ao inicializar tabela usucapiao:', err.message);
  }
})();

async function adicionarDiasUteis(dataInicio, dias) {
  if (!dataInicio) return null;
  const feriadosResult = await pool.query('SELECT data FROM feriados');
  const feriados = new Set(feriadosResult.rows.map(f => f.data.toISOString().split('T')[0]));
  let data = new Date(dataInicio);
  data.setHours(12, 0, 0, 0);
  let adicionados = 0;
  while (adicionados < dias) {
    data.setDate(data.getDate() + 1);
    const dia = data.getDay();
    const str = data.toISOString().split('T')[0];
    if (dia !== 0 && dia !== 6 && !feriados.has(str)) adicionados++;
  }
  return data.toISOString().split('T')[0];
}

async function comPrazos(rows) {
  return Promise.all(rows.map(async (r) => ({
    ...r,
    prazo_desidia:          await adicionarDiasUteis(r.data_envio_cliente, 20),
    // Nova entrada renova os 15 dias; senão usa data_envio_email
    fim_prazo_manifestacao: await adicionarDiasUteis(r.data_nova_entrada || r.data_envio_email, 15),
  })));
}

// Listar todos
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, busca } = req.query;
    let query = 'SELECT * FROM usucapiao WHERE 1=1';
    const params = []; let i = 1;
    if (status) { query += ` AND status = $${i++}`; params.push(status); }
    if (busca) {
      query += ` AND (nome_requerente ILIKE $${i} OR numero_matricula ILIKE $${i} OR numero_recepcao ILIKE $${i})`;
      params.push(`%${busca}%`); i++;
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(await comPrazos(result.rows));
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Buscar por id
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM usucapiao WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Não encontrado' });
    const [row] = await comPrazos(result.rows);
    res.json(row);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Criar
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      nome_requerente, data_entrada, numero_matricula, status, observacoes,
      numero_recepcao, titulo, responsavel_analise, email_cliente,
      data_envio_atendimento, data_envio_cliente, data_envio_email, data_nova_entrada,
    } = req.body;
    if (!nome_requerente || !data_entrada || !numero_matricula)
      return res.status(400).json({ message: 'Requerente, data de entrada e matrícula são obrigatórios.' });

    const nomeUsuario = req.user.nome || req.user.email;
    const enviadoPor = data_envio_atendimento ? nomeUsuario : null;

    const result = await pool.query(
      `INSERT INTO usucapiao
        (nome_requerente, data_entrada, numero_matricula, status, observacoes,
         numero_recepcao, titulo, responsavel_analise, email_cliente,
         data_envio_atendimento, enviado_atendimento_por, data_envio_cliente, data_envio_email, data_nova_entrada)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [
        nome_requerente, data_entrada, numero_matricula,
        status || 'em_andamento', observacoes || null,
        numero_recepcao || null, titulo || 'usucapiao',
        responsavel_analise || null, email_cliente || null,
        data_envio_atendimento || null, enviadoPor,
        data_envio_cliente || null, data_envio_email || null, data_nova_entrada || null,
      ]
    );
    const [row] = await comPrazos(result.rows);
    res.status(201).json(row);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Atualizar
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const {
      nome_requerente, data_entrada, numero_matricula, status, observacoes,
      numero_recepcao, titulo, responsavel_analise, email_cliente,
      data_envio_atendimento, data_envio_cliente, data_envio_email, data_nova_entrada,
    } = req.body;

    // Verifica se data_envio_atendimento está sendo preenchida agora
    const atual = await pool.query('SELECT data_envio_atendimento, enviado_atendimento_por FROM usucapiao WHERE id=$1', [req.params.id]);
    const registroAtual = atual.rows[0];
    const nomeUsuario = req.user.nome || req.user.email;
    let enviadoPor = registroAtual?.enviado_atendimento_por || null;
    if (data_envio_atendimento && !registroAtual?.data_envio_atendimento) {
      enviadoPor = nomeUsuario;
    } else if (!data_envio_atendimento) {
      enviadoPor = null;
    }

    const result = await pool.query(
      `UPDATE usucapiao SET
        nome_requerente=$1, data_entrada=$2, numero_matricula=$3,
        status=$4, observacoes=$5, numero_recepcao=$6, titulo=$7,
        responsavel_analise=$8, email_cliente=$9,
        data_envio_atendimento=$10, enviado_atendimento_por=$11,
        data_envio_cliente=$12, data_envio_email=$13, data_nova_entrada=$14, updated_at=NOW()
       WHERE id=$15 RETURNING *`,
      [
        nome_requerente, data_entrada, numero_matricula,
        status, observacoes || null,
        numero_recepcao || null, titulo || 'usucapiao',
        responsavel_analise || null, email_cliente || null,
        data_envio_atendimento || null, enviadoPor,
        data_envio_cliente || null, data_envio_email || null, data_nova_entrada || null,
        req.params.id,
      ]
    );
    if (!result.rows.length) return res.status(404).json({ message: 'Não encontrado' });
    const [row] = await comPrazos(result.rows);
    res.json(row);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// Excluir
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM usucapiao WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Não encontrado' });
    res.json({ message: 'Excluído com sucesso' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── NOTAS ──────────────────────────────────────────────────────────────────

router.get('/:id/notas', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM usucapiao_notas WHERE usucapiao_id=$1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/:id/notas', authMiddleware, async (req, res) => {
  try {
    const { nota } = req.body;
    if (!nota?.trim()) return res.status(400).json({ message: 'Nota não pode ser vazia.' });
    const result = await pool.query(
      `INSERT INTO usucapiao_notas (usucapiao_id, usuario_nome, nota)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.nome || req.user.email, nota.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── ENVIAR EMAIL REAL VIA SMTP ─────────────────────────────────────────────

router.post('/:id/enviar-email', authMiddleware, async (req, res) => {
  try {
    const { assunto, corpo, destinatario } = req.body;
    if (!destinatario || !assunto || !corpo)
      return res.status(400).json({ message: 'Destinatário, assunto e corpo são obrigatórios.' });

    await transporter.sendMail({
      from:    `"Cartório" <${process.env.SMTP_USER}>`,
      to:      destinatario,
      subject: assunto,
      text:    corpo,
    });

    const nomeUsuario = req.user.nome || req.user.email;
    await pool.query(
      `INSERT INTO usucapiao_notas (usucapiao_id, usuario_nome, nota) VALUES ($1, $2, $3)`,
      [req.params.id, nomeUsuario, `📧 Email enviado para ${destinatario} — Assunto: "${assunto}" — por ${nomeUsuario}`]
    );

    res.json({ message: 'Email enviado com sucesso.' });
  } catch (err) {
    res.status(500).json({ message: `Erro ao enviar email: ${err.message}` });
  }
});

// ── REGISTRAR ENVIO DE EMAIL (grava nota automática) ─────────────────────

router.post('/:id/registrar-email', authMiddleware, async (req, res) => {
  try {
    const { tipo } = req.body; // 'cliente' | 'email'
    const labels = {
      cliente: 'Email enviado ao cliente — início do prazo de desídia (20 dias úteis)',
      email:   'Email de acompanhamento enviado — início do prazo de manifestação (15 dias úteis)',
    };
    const nota = labels[tipo] || 'Email enviado ao cliente';
    const result = await pool.query(
      `INSERT INTO usucapiao_notas (usucapiao_id, usuario_nome, nota)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, req.user.nome || req.user.email, nota]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
