const express = require('express');
const router = express.Router();
const pool = require('../config/database');

// Rota pública - sem autenticação
router.get('/dados', async (req, res) => {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

    // KPIs principais
    const kpis = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE LOWER(status) = 'concluido' AND data_conclusao::date = $1)::int as concluidos_hoje,
        COUNT(*) FILTER (WHERE LOWER(status) = 'concluido' AND data_entrada >= $2)::int as concluidos_mes,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento')::int as em_andamento,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento' AND data_vencimento < $1)::int as atrasados,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento' AND data_vencimento = $1)::int as vencendo_hoje,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento' AND data_vencimento BETWEEN $1 AND ($1::date + 3))::int as vencendo_3dias,
        COUNT(*) FILTER (WHERE LOWER(status) = 'andamento' AND data_vencimento BETWEEN $1 AND ($1::date + 7))::int as vencendo_7dias,
        COUNT(*) FILTER (WHERE data_entrada = $1)::int as criados_hoje,
        COUNT(*) FILTER (WHERE data_entrada >= $2)::int as criados_mes
      FROM protocolos
    `, [hoje, inicioMes]);

    // Ranking anônimo do mês (sem nomes)
    const ranking = await pool.query(`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY COUNT(p.id) FILTER (WHERE LOWER(p.status) = 'concluido') DESC, COUNT(p.id) DESC) as posicao,
        COUNT(p.id) FILTER (WHERE LOWER(p.status) = 'concluido')::int as concluidos,
        COUNT(p.id)::int as total,
        CASE 
          WHEN COUNT(p.id) > 0 THEN
            ROUND((COUNT(p.id) FILTER (WHERE LOWER(p.status) = 'concluido')::numeric / COUNT(p.id)) * 100)::int
          ELSE 0
        END as taxa
      FROM usuarios u
      LEFT JOIN protocolos p ON u.id = p.responsavel_id AND p.data_entrada >= $1
      WHERE u.ativo = true AND u.cargo = 'Registrador'
      GROUP BY u.id
      ORDER BY concluidos DESC, total DESC
      LIMIT 5
    `, [inicioMes]);

    // Próximos a vencer (sem identificar responsável)
    const vencendo = await pool.query(`
      SELECT 
        p.numero,
        s.nome as servico_nome,
        p.data_vencimento,
        (p.data_vencimento - CURRENT_DATE)::int as dias_restantes
      FROM protocolos p
      JOIN servicos s ON p.servico_id = s.id
      WHERE LOWER(p.status) = 'andamento'
        AND p.data_vencimento BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
      ORDER BY p.data_vencimento ASC
      LIMIT 8
    `);

    // Streak - dias sem atrasar (último protocolo que atrasou)
    const streak = await pool.query(`
      SELECT 
        COALESCE(
          (CURRENT_DATE - MAX(data_conclusao)::date)::int,
          (CURRENT_DATE - MIN(data_entrada)::date)::int
        ) as dias_sem_atraso
      FROM protocolos
      WHERE status = 'concluido' 
        AND data_conclusao > data_vencimento
    `);

    const diasSemAtraso = streak.rows[0]?.dias_sem_atraso ?? null;

    res.json({
      kpis: kpis.rows[0],
      ranking: ranking.rows,
      vencendo: vencendo.rows,
      dias_sem_atraso: diasSemAtraso,
      atualizado_em: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Erro no painel público:', error);
    res.status(500).json({ message: 'Erro ao carregar painel' });
  }
});

module.exports = router;
