const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { apiKeyMiddleware } = require('../middleware/apiKey');

// API de produtividade para integração com sistemas externos. Protegida pela
// mesma chave usada em /api/painel/dados (ver Configurações -> Painel Externo,
// ou a variável PAINEL_API_KEY). Diferente do /api/painel/dados, esta API
// identifica os registradores pelo nome - não é anônima.
//
// Todas as rotas aceitam, para delimitar o período:
//   - periodo=hoje | semana | mes | ano   (atalhos, "mes" é o padrão)
//   - ou data_inicio=AAAA-MM-DD&data_fim=AAAA-MM-DD (intervalo explícito, tem prioridade)
// "Concluídos" sempre é contado pelo histórico (ação CONCLUSAO), não pelo
// status atual do protocolo - assim a produtividade não se perde quando um
// protocolo concluído é reaberto ou reatribuído depois.

// Monta a condição SQL de período sobre uma expressão de data/timestamp já
// convertida para o fuso de Manaus (ex: "(h.created_at AT TIME ZONE 'America/Manaus')").
function filtroPeriodo(query, coluna) {
  const { periodo, data_inicio, data_fim } = query;
  const params = [];

  if (data_inicio && data_fim) {
    params.push(data_inicio, data_fim);
    return {
      sql: `${coluna}::date >= $1::date AND ${coluna}::date <= $2::date`,
      params,
      periodo: { tipo: 'personalizado', inicio: data_inicio, fim: data_fim },
    };
  }
  if (periodo === 'hoje') {
    return {
      sql: `${coluna}::date = (NOW() AT TIME ZONE 'America/Manaus')::date`,
      params,
      periodo: { tipo: 'hoje' },
    };
  }
  if (periodo === 'semana') {
    return {
      sql: `${coluna} >= date_trunc('week', NOW() AT TIME ZONE 'America/Manaus')`,
      params,
      periodo: { tipo: 'semana' },
    };
  }
  if (periodo === 'ano') {
    return {
      sql: `${coluna} >= date_trunc('year', NOW() AT TIME ZONE 'America/Manaus')`,
      params,
      periodo: { tipo: 'ano' },
    };
  }
  return {
    sql: `${coluna} >= date_trunc('month', NOW() AT TIME ZONE 'America/Manaus')`,
    params,
    periodo: { tipo: 'mes' },
  };
}

// Aplica um condicional extra (ex: filtro por registrador) reaproveitando o
// array de params já usado pelo filtroPeriodo, devolvendo o fragmento SQL
// pronto (" AND coluna = $N") ou string vazia se o valor não foi enviado.
function condOpcional(params, coluna, valor) {
  if (valor === undefined || valor === null || valor === '') return '';
  params.push(valor);
  return ` AND ${coluna} = $${params.length}`;
}

// GET /registradores - lista de referência (id, nome, email, setor, ativo)
router.get('/registradores', apiKeyMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nome, email, setor, ativo FROM usuarios WHERE cargo = 'Registrador' ORDER BY nome`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao listar registradores (API produtividade):', error);
    res.status(500).json({ message: 'Erro ao listar registradores' });
  }
});

// GET /resumo - totais por registrador no período (concluídos, tempo médio,
// + snapshot atual de em andamento/atrasados, que não é limitado pelo período)
router.get('/resumo', apiKeyMiddleware, async (req, res) => {
  try {
    const filtro = filtroPeriodo(req.query, `(h.created_at AT TIME ZONE 'America/Manaus')`);
    const params = [...filtro.params];
    const condRegistrador = condOpcional(params, 'u.id', req.query.registrador_id ? Number(req.query.registrador_id) : undefined);

    const concluidosResult = await pool.query(`
      SELECT
        u.id, u.nome, u.email, u.setor,
        COUNT(h.id) FILTER (WHERE h.acao = 'CONCLUSAO')::int as concluidos,
        ROUND(AVG(h.created_at::date - p.data_entrada::date) FILTER (WHERE h.acao = 'CONCLUSAO'), 1) as tempo_medio_dias
      FROM usuarios u
      LEFT JOIN historico h ON h.usuario_id = u.id AND h.acao = 'CONCLUSAO' AND ${filtro.sql}
      LEFT JOIN protocolos p ON h.protocolo_id = p.id
      WHERE u.cargo = 'Registrador'${condRegistrador}
      GROUP BY u.id, u.nome, u.email, u.setor
      ORDER BY concluidos DESC, u.nome ASC
    `, params);

    const atualResult = await pool.query(`
      SELECT
        responsavel_id as id,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento')::int as em_andamento_atual,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento' AND data_vencimento < CURRENT_DATE)::int as atrasados_atual
      FROM protocolos
      WHERE responsavel_id IN (SELECT id FROM usuarios WHERE cargo = 'Registrador')
      GROUP BY responsavel_id
    `);
    const atualPorId = new Map(atualResult.rows.map((r) => [r.id, r]));

    const registradores = concluidosResult.rows.map((r) => ({
      id: r.id,
      nome: r.nome,
      email: r.email,
      setor: r.setor,
      concluidos: r.concluidos,
      tempo_medio_dias: r.tempo_medio_dias !== null ? Number(r.tempo_medio_dias) : null,
      em_andamento_atual: atualPorId.get(r.id)?.em_andamento_atual || 0,
      atrasados_atual: atualPorId.get(r.id)?.atrasados_atual || 0,
    }));

    res.json({ periodo: filtro.periodo, registradores });
  } catch (error) {
    console.error('Erro ao gerar resumo de produtividade:', error);
    res.status(500).json({ message: 'Erro ao gerar resumo de produtividade' });
  }
});

// GET /serie - conclusões agrupadas por dia/semana/mês, por registrador
// (agrupar_por=dia|semana|mes, padrão "dia") - pra gráficos de tendência.
router.get('/serie', apiKeyMiddleware, async (req, res) => {
  try {
    const bucket = ['dia', 'semana', 'mes'].includes(req.query.agrupar_por) ? req.query.agrupar_por : 'dia';
    const truncUnit = bucket === 'dia' ? 'day' : bucket === 'semana' ? 'week' : 'month';

    const filtro = filtroPeriodo(req.query, `(h.created_at AT TIME ZONE 'America/Manaus')`);
    const params = [...filtro.params];
    const condRegistrador = condOpcional(params, 'h.usuario_id', req.query.registrador_id ? Number(req.query.registrador_id) : undefined);

    const result = await pool.query(`
      SELECT
        date_trunc('${truncUnit}', h.created_at AT TIME ZONE 'America/Manaus')::date as periodo_inicio,
        u.id as registrador_id, u.nome as registrador_nome,
        COUNT(*)::int as concluidos
      FROM historico h
      JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.acao = 'CONCLUSAO' AND ${filtro.sql}${condRegistrador}
      GROUP BY periodo_inicio, u.id, u.nome
      ORDER BY periodo_inicio ASC, u.nome ASC
    `, params);

    res.json({ agrupado_por: bucket, periodo: filtro.periodo, serie: result.rows });
  } catch (error) {
    console.error('Erro ao gerar série de produtividade:', error);
    res.status(500).json({ message: 'Erro ao gerar série de produtividade' });
  }
});

// GET /detalhe - lista granular de conclusões no período (uma linha por
// protocolo concluído), com paginação (limit/offset).
router.get('/detalhe', apiKeyMiddleware, async (req, res) => {
  try {
    const filtro = filtroPeriodo(req.query, `(h.created_at AT TIME ZONE 'America/Manaus')`);
    const params = [...filtro.params];
    const condRegistrador = condOpcional(params, 'h.usuario_id', req.query.registrador_id ? Number(req.query.registrador_id) : undefined);

    const limit = Math.min(Number(req.query.limit) || 200, 1000);
    const offset = Number(req.query.offset) || 0;
    params.push(limit);
    const limitIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const result = await pool.query(`
      SELECT
        h.id as historico_id,
        (h.created_at AT TIME ZONE 'America/Manaus') as concluido_em,
        p.id as protocolo_id, p.numero, p.data_entrada, p.data_vencimento,
        s.nome as servico_nome,
        u.id as registrador_id, u.nome as registrador_nome, u.setor as registrador_setor,
        (h.created_at::date - p.data_entrada::date) as dias_para_concluir
      FROM historico h
      JOIN protocolos p ON h.protocolo_id = p.id
      JOIN servicos s ON p.servico_id = s.id
      JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.acao = 'CONCLUSAO' AND ${filtro.sql}${condRegistrador}
      ORDER BY h.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `, params);

    res.json({ periodo: filtro.periodo, limit, offset, total_retornado: result.rows.length, itens: result.rows });
  } catch (error) {
    console.error('Erro ao buscar detalhe de produtividade:', error);
    res.status(500).json({ message: 'Erro ao buscar detalhe de produtividade' });
  }
});

// GET /atrasados - protocolos em andamento e vencidos AGORA (não é filtrado
// por período - "atrasado" é sempre relativo a hoje), com detalhe por
// protocolo. Filtra por registrador_id opcionalmente.
router.get('/atrasados', apiKeyMiddleware, async (req, res) => {
  try {
    const params = [];
    const condRegistrador = condOpcional(params, 'p.responsavel_id', req.query.registrador_id ? Number(req.query.registrador_id) : undefined);

    const result = await pool.query(`
      SELECT
        p.id as protocolo_id, p.numero, p.data_entrada, p.data_vencimento,
        (CURRENT_DATE - p.data_vencimento::date)::int as dias_atrasado,
        s.nome as servico_nome,
        u.id as registrador_id, u.nome as registrador_nome, u.setor as registrador_setor
      FROM protocolos p
      JOIN servicos s ON p.servico_id = s.id
      JOIN usuarios u ON p.responsavel_id = u.id
      WHERE LOWER(p.status) = 'andamento'
        AND p.data_vencimento IS NOT NULL
        AND p.data_vencimento < CURRENT_DATE${condRegistrador}
      ORDER BY p.data_vencimento ASC
    `, params);

    res.json({ total: result.rows.length, atualizado_em: new Date().toISOString(), itens: result.rows });
  } catch (error) {
    console.error('Erro ao buscar protocolos atrasados (API produtividade):', error);
    res.status(500).json({ message: 'Erro ao buscar protocolos atrasados' });
  }
});

module.exports = router;
