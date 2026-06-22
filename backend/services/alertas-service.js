const pool = require('../config/database');

// 🔔 WEBHOOK N8N (opcional)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL;

if (N8N_WEBHOOK_URL) {
  console.log('✅ Webhook N8N configurado:', N8N_WEBHOOK_URL);
} else {
  console.log('ℹ️  N8N_WEBHOOK_URL não configurado — alertas via webhook desativados.');
}

/**
 * Verifica protocolos vencendo considerando dias_alerta de cada serviço
 */
async function verificarProtocolosVencendo() {
  if (!N8N_WEBHOOK_URL) return { success: true, total: 0, enviados: 0, info: 'webhook não configurado' };
  try {
    console.log('[ALERTA] Verificando protocolos vencendo...');

    // Buscar protocolos considerando o dias_alerta específico de cada serviço
    const result = await pool.query(`
      SELECT 
        p.id,
        p.numero,
        p.data_vencimento,
        p.status,
        (p.data_vencimento - CURRENT_DATE)::int as dias_restantes,
        s.nome as servico_nome,
        s.dias_alerta as servico_dias_alerta,
        u.nome as responsavel_nome,
        u.email as responsavel_email,
        u.cargo as responsavel_cargo,
        u.setor as responsavel_setor
      FROM protocolos p
      JOIN servicos s ON p.servico_id = s.id
      JOIN usuarios u ON p.responsavel_id = u.id
      WHERE p.status = 'andamento'
        AND p.data_vencimento >= CURRENT_DATE
        AND (p.data_vencimento - CURRENT_DATE)::int <= s.dias_alerta
      ORDER BY p.data_vencimento ASC
    `);

    if (result.rows.length === 0) {
      console.log('[ALERTA] Nenhum protocolo vencendo no período de alerta configurado.');
      return { success: true, total: 0, enviados: 0 };
    }

    console.log(`[ALERTA] Encontrados ${result.rows.length} protocolos vencendo.`);

    let enviados = 0;

    // Enviar alertas para o n8n
    for (const protocolo of result.rows) {
      try {
        await enviarAlertaN8n(protocolo);
        enviados++;
      } catch (error) {
        console.error(`[ALERTA] Erro ao enviar alerta do protocolo ${protocolo.numero}:`, error.message);
      }
    }

    console.log(`[ALERTA] Total enviado: ${enviados}/${result.rows.length}`);

    return {
      success: true,
      total: result.rows.length,
      enviados,
      protocolos: result.rows.map(p => ({
        numero: p.numero,
        dias_restantes: p.dias_restantes,
        responsavel: p.responsavel_nome,
        servico: p.servico_nome,
        dias_alerta_servico: p.servico_dias_alerta,
      })),
    };
  } catch (error) {
    console.error('[ALERTA] Erro ao verificar protocolos:', error);
    throw error;
  }
}

/**
 * Envia alerta individual para o webhook n8n
 */
async function enviarAlertaN8n(protocolo) {
  const { dias_restantes, servico_dias_alerta } = protocolo;

  // Determinar urgência baseado nos dias restantes
  let urgencia = 'NORMAL';
  let mensagem = '';
  let emoji = '📅';

  if (dias_restantes === 0) {
    urgencia = 'CRÍTICA';
    emoji = '⚠️';
    mensagem = `${emoji} VENCE HOJE! Protocolo ${protocolo.numero}`;
  } else if (dias_restantes === 1) {
    urgencia = 'ALTA';
    emoji = '⏰';
    mensagem = `${emoji} VENCE AMANHÃ! Protocolo ${protocolo.numero}`;
  } else if (dias_restantes <= Math.ceil(servico_dias_alerta / 3)) {
    urgencia = 'ALTA';
    emoji = '⏰';
    mensagem = `${emoji} Vence em ${dias_restantes} ${dias_restantes === 1 ? 'dia' : 'dias'} - Protocolo ${protocolo.numero}`;
  } else {
    urgencia = 'MÉDIA';
    emoji = '📅';
    mensagem = `${emoji} Vence em ${dias_restantes} ${dias_restantes === 1 ? 'dia' : 'dias'} - Protocolo ${protocolo.numero}`;
  }

  // Payload para enviar ao n8n
  const payload = {
    tipo: 'alerta_vencimento',
    urgencia,
    mensagem,
    protocolo: {
      id: protocolo.id,
      numero: protocolo.numero,
      servico: protocolo.servico_nome,
      servico_dias_alerta: servico_dias_alerta,
      data_vencimento: protocolo.data_vencimento,
      dias_restantes,
      status: protocolo.status,
    },
    responsavel: {
      nome: protocolo.responsavel_nome,
      email: protocolo.responsavel_email,
      cargo: protocolo.responsavel_cargo,
      setor: protocolo.responsavel_setor,
    },
    timestamp: new Date().toISOString(),
  };

  console.log(`[ALERTA] Enviando para ${N8N_WEBHOOK_URL}...`);

  // Enviar para o webhook n8n
  const response = await fetch(N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Webhook retornou status ${response.status}: ${errorText}`);
  }

  console.log(`[ALERTA] ✓ Enviado: ${mensagem}`);
  return { success: true, protocolo: protocolo.numero };
}

/**
 * Verifica protocolos JÁ VENCIDOS (atrasados)
 */
async function verificarProtocolosAtrasados() {
  if (!N8N_WEBHOOK_URL) return { success: true, total: 0, info: 'webhook não configurado' };
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.numero,
        p.data_vencimento,
        (CURRENT_DATE - p.data_vencimento)::int as dias_atraso,
        s.nome as servico_nome,
        u.nome as responsavel_nome,
        u.email as responsavel_email,
        u.setor as responsavel_setor
      FROM protocolos p
      JOIN servicos s ON p.servico_id = s.id
      JOIN usuarios u ON p.responsavel_id = u.id
      WHERE p.status = 'andamento'
        AND p.data_vencimento < CURRENT_DATE
      ORDER BY dias_atraso DESC
    `);

    if (result.rows.length === 0) {
      console.log('[ATRASADOS] Nenhum protocolo atrasado.');
      return { success: true, total: 0 };
    }

    console.log(`[ATRASADOS] ${result.rows.length} protocolos atrasados encontrados.`);

    // Enviar relatório consolidado dos atrasados
    const payload = {
      tipo: 'relatorio_atrasados',
      urgencia: 'CRÍTICA',
      total: result.rows.length,
      protocolos: result.rows.map(p => ({
        numero: p.numero,
        servico: p.servico_nome,
        dias_atraso: p.dias_atraso,
        responsavel: p.responsavel_nome,
        responsavel_email: p.responsavel_email,
        setor: p.responsavel_setor,
      })),
      timestamp: new Date().toISOString(),
    };

    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return { success: true, total: result.rows.length };
  } catch (error) {
    console.error('[ATRASADOS] Erro:', error);
    throw error;
  }
}

module.exports = {
  verificarProtocolosVencendo,
  verificarProtocolosAtrasados,
  enviarAlertaN8n,
};
