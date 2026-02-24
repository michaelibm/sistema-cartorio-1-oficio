const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Função auxiliar para construir filtro de data
function buildDateFilter(dataInicio, dataFim) {
  let dateFilter = '';
  const params = [];
  
  if (dataInicio && dataFim) {
    dateFilter = 'AND p.data_entrada BETWEEN $1 AND $2';
    params.push(dataInicio, dataFim);
  } else if (dataInicio) {
    dateFilter = 'AND p.data_entrada >= $1';
    params.push(dataInicio);
  } else if (dataFim) {
    dateFilter = 'AND p.data_entrada <= $1';
    params.push(dataFim);
  }
  
  return { dateFilter, params };
}

// Relatório geral
router.get('/geral', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const { dateFilter, params } = buildDateFilter(data_inicio, data_fim);

    const stats = await pool.query(`
      SELECT 
        COUNT(*)::int as total_protocolos,
        COUNT(*) FILTER (WHERE status = 'andamento')::int as em_andamento,
        COUNT(*) FILTER (WHERE status = 'concluido')::int as concluidos,
        COUNT(*) FILTER (WHERE status = 'concluido' AND data_conclusao <= data_vencimento)::int as concluidos_no_prazo,
        COUNT(*) FILTER (WHERE status = 'concluido' AND data_conclusao > data_vencimento)::int as concluidos_atrasados,
        COUNT(*) FILTER (WHERE status = 'andamento' AND data_vencimento < CURRENT_DATE)::int as atrasados_ativos,
        COALESCE(ROUND(AVG(data_conclusao - data_entrada)), 0)::int as tempo_medio_conclusao
      FROM protocolos p
      WHERE 1=1 ${dateFilter}
    `, params);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Erro ao gerar relatório geral:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// Relatório por funcionário
router.get('/por-funcionario', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const { dateFilter, params } = buildDateFilter(data_inicio, data_fim);

    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cargo,
        COUNT(p.id)::int as total_protocolos,
        COUNT(p.id) FILTER (WHERE p.status = 'andamento')::int as em_andamento,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido')::int as concluidos,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido' AND p.data_conclusao <= p.data_vencimento)::int as no_prazo,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido' AND p.data_conclusao > p.data_vencimento)::int as atrasados,
        CASE 
          WHEN COUNT(p.id) FILTER (WHERE p.status = 'concluido') > 0 THEN
            ROUND(
              (COUNT(p.id) FILTER (WHERE p.status = 'concluido' AND p.data_conclusao <= p.data_vencimento)::numeric / 
               COUNT(p.id) FILTER (WHERE p.status = 'concluido')::numeric) * 100
            )::int
          ELSE 0
        END as taxa_sucesso
      FROM usuarios u
      LEFT JOIN protocolos p ON u.id = p.responsavel_id ${dateFilter.replace('AND', 'AND')}
      WHERE u.ativo = true
      GROUP BY u.id, u.nome, u.cargo
      ORDER BY total_protocolos DESC, u.nome
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório por funcionário:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// Relatório por tipo de serviço
router.get('/por-servico', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    const { dateFilter, params } = buildDateFilter(data_inicio, data_fim);

    const result = await pool.query(`
      SELECT 
        s.id,
        s.nome,
        s.prazo,
        s.tipo_prazo,
        COUNT(p.id)::int as total_protocolos,
        COUNT(p.id) FILTER (WHERE p.status = 'andamento')::int as em_andamento,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido')::int as concluidos,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido' AND p.data_conclusao <= p.data_vencimento)::int as no_prazo,
        COALESCE(
          ROUND(AVG(p.data_conclusao - p.data_entrada) FILTER (WHERE p.status = 'concluido')), 
          0
        )::int as tempo_medio
      FROM servicos s
      LEFT JOIN protocolos p ON s.id = p.servico_id ${dateFilter.replace('AND', 'AND')}
      WHERE s.ativo = true
      GROUP BY s.id, s.nome, s.prazo, s.tipo_prazo
      ORDER BY total_protocolos DESC, s.nome
    `, params);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao gerar relatório por serviço:', error);
    res.status(500).json({ message: 'Erro ao gerar relatório' });
  }
});

// Protocolos vencendo (próximos 7 dias)
router.get('/vencendo', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        s.nome as servico_nome,
        u.nome as responsavel_nome,
        (p.data_vencimento - CURRENT_DATE)::int as dias_restantes
      FROM protocolos p
      JOIN servicos s ON p.servico_id = s.id
      JOIN usuarios u ON p.responsavel_id = u.id
      WHERE p.status = 'andamento' 
        AND p.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
      ORDER BY p.data_vencimento ASC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar protocolos vencendo:', error);
    res.status(500).json({ message: 'Erro ao buscar protocolos' });
  }
});

// Protocolos atrasados
router.get('/atrasados', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        s.nome as servico_nome,
        u.nome as responsavel_nome,
        (CURRENT_DATE - p.data_vencimento)::int as dias_atraso
      FROM protocolos p
      JOIN servicos s ON p.servico_id = s.id
      JOIN usuarios u ON p.responsavel_id = u.id
      WHERE p.status = 'andamento' 
        AND p.data_vencimento < CURRENT_DATE
      ORDER BY dias_atraso DESC
    `);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar protocolos atrasados:', error);
    res.status(500).json({ message: 'Erro ao buscar protocolos' });
  }
});

// Histórico de um protocolo
router.get('/historico/:protocolo_id', authMiddleware, async (req, res) => {
  try {
    const { protocolo_id } = req.params;

    const result = await pool.query(`
      SELECT 
        h.*,
        u.nome as usuario_nome,
        u.email as usuario_email
      FROM historico h
      LEFT JOIN usuarios u ON h.usuario_id = u.id
      WHERE h.protocolo_id = $1
      ORDER BY h.created_at DESC
    `, [protocolo_id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar histórico:', error);
    res.status(500).json({ message: 'Erro ao buscar histórico' });
  }
});

// Produção diária (últimos 30 dias)
router.get('/producao-diaria', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        data_entrada::date as dia,
        COUNT(*)::int as criados,
        COUNT(*) FILTER (WHERE status = 'concluido')::int as concluidos
      FROM protocolos
      WHERE data_entrada >= CURRENT_DATE - 30
      GROUP BY data_entrada::date
      ORDER BY dia ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar produção diária:', error);
    res.status(500).json({ message: 'Erro ao buscar produção diária' });
  }
});

// Produção por funcionário detalhada
router.get('/produtividade', authMiddleware, async (req, res) => {
  try {
    const { data_inicio, data_fim } = req.query;
    
    const dataIni = data_inicio || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    const dataFm = data_fim || new Date().toISOString().slice(0, 10);

    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cargo,
        u.setor,
        COUNT(p.id)::int as total_criados,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido')::int as total_concluidos,
        COUNT(p.id) FILTER (WHERE p.status = 'andamento')::int as em_andamento,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido' AND p.data_conclusao <= p.data_vencimento)::int as no_prazo,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido' AND p.data_conclusao > p.data_vencimento)::int as atrasados,
        COALESCE(ROUND(
          COUNT(p.id)::numeric / NULLIF(($2::date - $1::date + 1), 0), 2
        ), 0)::float as media_diaria,
        MIN(p.data_entrada)::text as primeiro_protocolo,
        MAX(p.data_entrada)::text as ultimo_protocolo
      FROM usuarios u
      LEFT JOIN protocolos p ON u.id = p.responsavel_id 
        AND p.data_entrada BETWEEN $1 AND $2
      WHERE u.ativo = true
      GROUP BY u.id, u.nome, u.cargo, u.setor
      ORDER BY total_criados DESC
    `, [dataIni, dataFm]);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar produtividade:', error);
    res.status(500).json({ message: 'Erro ao buscar produtividade' });
  }
});

// KPIs executivos
router.get('/kpis', authMiddleware, async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const inicioSemana = new Date();
    inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay());
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE data_entrada = $1)::int as criados_hoje,
        COUNT(*) FILTER (WHERE data_entrada >= $2)::int as criados_semana,
        COUNT(*) FILTER (WHERE data_entrada >= $3)::int as criados_mes,
        COUNT(*) FILTER (WHERE status = 'concluido' AND data_entrada = $1)::int as concluidos_hoje,
        COUNT(*) FILTER (WHERE status = 'concluido' AND data_entrada >= $3)::int as concluidos_mes,
        COUNT(*) FILTER (WHERE status = 'andamento')::int as em_andamento,
        COUNT(*) FILTER (WHERE status = 'andamento' AND data_vencimento < $1)::int as atrasados,
        COUNT(DISTINCT responsavel_id)::int as funcionarios_ativos
      FROM protocolos
    `, [hoje, inicioSemana.toISOString().slice(0, 10), inicioMes]);

    // Média por funcionário no mês
    const mediaResult = await pool.query(`
      SELECT COALESCE(ROUND(
        COUNT(p.id)::numeric / NULLIF(COUNT(DISTINCT p.responsavel_id), 0), 1
      ), 0)::float as media_por_funcionario
      FROM protocolos p
      WHERE p.data_entrada >= $1
    `, [inicioMes]);

    res.json({ ...result.rows[0], media_por_funcionario: mediaResult.rows[0].media_por_funcionario });
  } catch (error) {
    console.error('Erro ao buscar KPIs:', error);
    res.status(500).json({ message: 'Erro ao buscar KPIs' });
  }
});

// Tendência mensal (últimos 6 meses)
router.get('/tendencia-mensal', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        TO_CHAR(data_entrada, 'YYYY-MM') as mes,
        TO_CHAR(data_entrada, 'Mon/YY') as mes_label,
        COUNT(*)::int as criados,
        COUNT(*) FILTER (WHERE status = 'concluido')::int as concluidos,
        COUNT(*) FILTER (WHERE status = 'andamento' AND data_vencimento < CURRENT_DATE)::int as atrasados
      FROM protocolos
      WHERE data_entrada >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY TO_CHAR(data_entrada, 'YYYY-MM'), TO_CHAR(data_entrada, 'Mon/YY')
      ORDER BY mes ASC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar tendência mensal:', error);
    res.status(500).json({ message: 'Erro ao buscar tendência mensal' });
  }
});

// Ranking funcionários do mês
router.get('/ranking', authMiddleware, async (req, res) => {
  try {
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
    
    const result = await pool.query(`
      SELECT 
        u.id,
        u.nome,
        u.cargo,
        u.setor,
        COUNT(p.id)::int as total,
        COUNT(p.id) FILTER (WHERE p.status = 'concluido')::int as concluidos,
        CASE 
          WHEN COUNT(p.id) > 0 THEN
            ROUND((COUNT(p.id) FILTER (WHERE p.status = 'concluido')::numeric / COUNT(p.id)) * 100)::int
          ELSE 0
        END as taxa_conclusao
      FROM usuarios u
      LEFT JOIN protocolos p ON u.id = p.responsavel_id AND p.data_entrada >= $1
      WHERE u.ativo = true AND u.cargo != 'Supervisor'
      GROUP BY u.id, u.nome, u.cargo, u.setor
      ORDER BY concluidos DESC, total DESC
      LIMIT 10
    `, [inicioMes]);

    res.json(result.rows);
  } catch (error) {
    console.error('Erro ao buscar ranking:', error);
    res.status(500).json({ message: 'Erro ao buscar ranking' });
  }
});

module.exports = router;
