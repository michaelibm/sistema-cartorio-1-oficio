// Regra única de prazo dos serviços (backend é a única fonte do cálculo; o
// frontend só exibe protocolos.data_vencimento).
//
// DATA-BASE: o prazo de um serviço conta a partir do momento em que o protocolo
// é PUXADO ou DISTRIBUÍDO para a execução daquele serviço - não da data de
// entrada. A data de entrada continua sendo o recebimento original; a data-base
// da execução atual fica em protocolos.prazo_base_data.
//
// CONVENÇÃO DE CONTAGEM (confirmada pelo Michael em 23/11/2026):
//   - o dia-base (puxada/distribuição) NÃO conta: a contagem começa no dia útil
//     SEGUINTE. Ex.: puxado na quarta 18/11, 3 dias úteis = 19, 23 e 24 (20 é
//     feriado, 21-22 fim de semana) -> vence 24/11;
//   - HISTÓRICO: de 17 a 23/11/2026 vigorou a regra inversa (pedido inicial, depois
//     corrigido pelo Michael) (o dia-base contava como dia 1: puxado 17/11 = 17, 18, 19). Vencimentos
//     gravados nesse intervalo seguem aquela regra e foram revertidos pelo script de
//     recálculo (opção contarDiaBase: true reproduz essa contagem, só para o script
//     reconhecê-los; nunca use para calcular prazos novos);
//   - em prazo "uteis" pulam-se sábados, domingos e datas da tabela feriados;
//   - em prazo "corridos" todos os dias contam;
//   - o resultado é uma DATE: o serviço vence ao fim desse dia (só fica atrasado
//     quando hoje > data_vencimento);
//   - "sem_prazo" não gera vencimento (null).
//
// Tudo aqui trabalha com strings 'YYYY-MM-DD' e aritmética em UTC, então o
// resultado não depende do fuso do servidor. O "hoje" é o dia civil em
// America/Manaus (não o dia UTC, que vira às 20h locais).

const pool = require('../config/database');

const FUSO = 'America/Manaus';

// Regra vigente: o dia-base não conta (ver cabeçalho). Único interruptor da regra.
const CONTAR_DIA_BASE = false;

// Dia civil atual em Manaus no formato YYYY-MM-DD.
function hojeManaus(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(agora);
}

// Normaliza string ('2026-11-17' ou ISO completo) ou Date vinda do driver pg
// (coluna DATE chega como Date à meia-noite LOCAL do servidor) para YYYY-MM-DD.
function paraDataISO(valor) {
  if (valor instanceof Date) {
    const a = valor.getFullYear();
    const m = String(valor.getMonth() + 1).padStart(2, '0');
    const d = String(valor.getDate()).padStart(2, '0');
    return `${a}-${m}-${d}`;
  }
  return String(valor).slice(0, 10);
}

// '2026-11-17' -> '17/11/2026' (para mensagens de histórico).
function formatarDataBR(valor) {
  if (!valor) return '';
  const [a, m, d] = paraDataISO(valor).split('-');
  return `${d}/${m}/${a}`;
}

// Cálculo puro (sem banco): feriados é uma lista de datas (string ou Date).
// contarDiaBase=true reproduz a contagem de 17 a 23/11/2026 (dia-base conta como dia 1);
// use só para reconhecer vencimentos gravados nesse intervalo, nunca para calcular novos.
function calcularVencimento(dataBase, prazo, tipoPrazo, feriados = [], { contarDiaBase = CONTAR_DIA_BASE } = {}) {
  if (tipoPrazo === 'sem_prazo') return null;

  const [a, m, d] = paraDataISO(dataBase).split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d));
  const ehFeriado = new Set(feriados.map(paraDataISO));

  // Sem prazo numérico (ou zero): vence no próprio dia-base.
  if (!(prazo > 0)) return dia.toISOString().slice(0, 10);

  // Contar o dia-base como dia 1 equivale a começar a contagem na véspera.
  if (contarDiaBase) dia.setUTCDate(dia.getUTCDate() - 1);

  let diasAdicionados = 0;
  while (diasAdicionados < prazo) {
    dia.setUTCDate(dia.getUTCDate() + 1);

    if (tipoPrazo === 'uteis') {
      const diaSemana = dia.getUTCDay();
      const iso = dia.toISOString().slice(0, 10);
      if (diaSemana !== 0 && diaSemana !== 6 && !ehFeriado.has(iso)) {
        diasAdicionados++;
      }
    } else {
      diasAdicionados++;
    }
  }

  return dia.toISOString().slice(0, 10);
}

// Versão com banco: carrega feriados cadastrados. `db` pode ser o pool ou um
// client de transação.
async function calcularDataVencimento(dataBase, prazo, tipoPrazo, db = pool) {
  if (tipoPrazo === 'sem_prazo') return null;
  const feriadosResult = await db.query('SELECT data FROM feriados');
  return calcularVencimento(dataBase, prazo, tipoPrazo, feriadosResult.rows.map((f) => f.data));
}

// Decide se uma mudança no protocolo inicia uma NOVA execução de serviço (e
// portanto uma nova data-base) ou é só uma alteração comum.
//
// Nova execução:
//   - o protocolo passa a "andamento" vindo de outro status (puxada da fila,
//     distribuição, reabertura);
//   - o serviço executado muda enquanto está em andamento.
// NÃO é nova execução:
//   - trocar apenas o responsável de um protocolo que já está em andamento
//     (redistribuição) - o prazo continua o mesmo;
//   - repetir a mesma requisição (o protocolo já está em andamento com o mesmo
//     serviço, então a segunda chamada cai no caso acima);
//   - abrir/iniciar sessão de trabalho, editar observações, orçamento, etc.
function iniciaNovaExecucao({ statusAtual, statusNovo, servicoAtualId, servicoNovoId }) {
  if (statusNovo !== 'andamento') return false;
  if (statusAtual !== 'andamento') return true;
  return servicoNovoId != null && Number(servicoNovoId) !== Number(servicoAtualId);
}

module.exports = {
  FUSO,
  CONTAR_DIA_BASE,
  hojeManaus,
  paraDataISO,
  formatarDataBR,
  calcularVencimento,
  calcularDataVencimento,
  iniciaNovaExecucao,
};
