// Regra única de prazo dos serviços (backend é a única fonte do cálculo; o
// frontend só exibe protocolos.data_vencimento).
//
// DATA-BASE: o prazo de um serviço conta a partir do momento em que o protocolo
// é PUXADO ou DISTRIBUÍDO para a execução daquele serviço - não da data de
// entrada. A data de entrada continua sendo o recebimento original; a data-base
// da execução atual fica em protocolos.prazo_base_data.
//
// CONVENÇÃO DE CONTAGEM (definida pelo cartório em 17/11/2026):
//   - o dia-base CONTA como dia 1 (se for dia útil, no caso de prazo "uteis").
//     Ex.: puxado na terça 17/11, 3 dias úteis = 17, 18 e 19 -> vence 19/11;
//   - até 17/11/2026 o sistema NÃO contava o dia-base (começava no dia seguinte).
//     Valores gravados nessa época seguem a contagem antiga; só o script de
//     recálculo as reconhece (opção contarDiaBase: false);
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
// contarDiaBase=false reproduz a contagem ANTIGA (dia-base fora); use só para
// reconhecer vencimentos gravados antes de 17/11/2026, nunca para calcular novos.
function calcularVencimento(dataBase, prazo, tipoPrazo, feriados = [], { contarDiaBase = true } = {}) {
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
  hojeManaus,
  paraDataISO,
  formatarDataBR,
  calcularVencimento,
  calcularDataVencimento,
  iniciaNovaExecucao,
};
