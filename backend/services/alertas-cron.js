const cron = require('node-cron');
const { verificarProtocolosVencendo, verificarProtocolosAtrasados } = require('./alertas-service');

/**
 * Configurar e iniciar os jobs de alertas automáticos
 */
function iniciarAlertasAutomaticos() {
  console.log('[CRON] Iniciando sistema de alertas automáticos...');

  // 🔔 Job 1: Verificar protocolos vencendo
  // Executa todo dia às 8:00 da manhã
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Executando verificação de protocolos vencendo...');
    try {
      const resultado = await verificarProtocolosVencendo();
      console.log('[CRON] ✓ Verificação concluída:', resultado);
    } catch (error) {
      console.error('[CRON] ✗ Erro na verificação:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 🔔 Job 2: Verificar protocolos atrasados
  // Executa de segunda a sexta às 9:00
  cron.schedule('0 9 * * 1-5', async () => {
    console.log('[CRON] Executando verificação de protocolos atrasados...');
    try {
      const resultado = await verificarProtocolosAtrasados();
      console.log('[CRON] ✓ Verificação de atrasados concluída:', resultado);
    } catch (error) {
      console.error('[CRON] ✗ Erro na verificação de atrasados:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  // 🔔 Job 3: Alerta urgente - Verificar a cada 2 horas durante horário comercial
  // De segunda a sexta, das 8h às 18h, a cada 2 horas
  cron.schedule('0 8-18/2 * * 1-5', async () => {
    console.log('[CRON] Verificação rápida de urgências...');
    try {
      await verificarProtocolosVencendo();
    } catch (error) {
      console.error('[CRON] Erro na verificação rápida:', error);
    }
  }, {
    timezone: 'America/Sao_Paulo'
  });

  console.log('[CRON] ✓ Sistema de alertas configurado com sucesso!');
  console.log('[CRON] - Verificação diária: 7:00 AM');
  console.log('[CRON] - Relatório atrasados: 8:00 AM (seg-sex)');
  console.log('[CRON] - Verificações rápidas: a cada 7h (8h-18h, seg-sex)');
}

/**
 * Testar manualmente os alertas (para debug)
 */
async function testarAlertasManualmente() {
  console.log('[TESTE] Executando teste manual de alertas...');
  try {
    const resultado = await verificarProtocolosVencendo();
    console.log('[TESTE] Resultado:', resultado);
    return resultado;
  } catch (error) {
    console.error('[TESTE] Erro:', error);
    throw error;
  }
}

module.exports = {
  iniciarAlertasAutomaticos,
  testarAlertasManualmente,
};
