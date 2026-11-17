// Testes unitários da regra de prazo (sem banco).
// Rodar: cd backend && npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const {
  hojeManaus,
  calcularVencimento,
  iniciaNovaExecucao,
  formatarDataBR,
} = require('../services/prazo-service');

// Feriados de novembro/2026 cadastrados na serventia.
const FERIADOS = ['2026-11-02', '2026-11-15', '2026-11-20'];

test('caso relatado (protocolo 224854): 3 dias úteis a partir da puxada em 17/11 vencem em 23/11', () => {
  // 17/11 (ter) -> 18 (1) -> 19 (2) -> 20 feriado -> 21 sáb -> 22 dom -> 23 seg (3)
  assert.equal(calcularVencimento('2026-11-17', 3, 'uteis', FERIADOS), '2026-11-23');
});

test('o cálculo antigo (a partir da entrada 13/11) dava 18/11 - o valor errado em produção', () => {
  assert.equal(calcularVencimento('2026-11-13', 3, 'uteis', FERIADOS), '2026-11-18');
  assert.notEqual(
    calcularVencimento('2026-11-13', 3, 'uteis', FERIADOS),
    calcularVencimento('2026-11-17', 3, 'uteis', FERIADOS)
  );
});

test('convenção: o dia-base não conta e o vencimento é o último dia do prazo', () => {
  assert.equal(calcularVencimento('2026-11-09', 1, 'uteis', []), '2026-11-10');
  assert.equal(calcularVencimento('2026-11-09', 0, 'uteis', []), '2026-11-09');
});

test('calendário: pula sábados e domingos', () => {
  // sexta 13/11 + 1 útil = segunda 16/11
  assert.equal(calcularVencimento('2026-11-13', 1, 'uteis', []), '2026-11-16');
  // sábado 14/11 + 1 útil = segunda 16/11
  assert.equal(calcularVencimento('2026-11-14', 1, 'uteis', []), '2026-11-16');
});

test('calendário: pula feriados cadastrados, inclusive em dia de semana', () => {
  // quinta 19/11 + 1 útil: 20/11 é feriado, 21-22 fim de semana -> segunda 23/11
  assert.equal(calcularVencimento('2026-11-19', 1, 'uteis', FERIADOS), '2026-11-23');
  assert.equal(calcularVencimento('2026-11-19', 1, 'uteis', []), '2026-11-20');
});

test('calendário: feriado que cai no domingo não pula um dia útil a mais', () => {
  // 15/11/2026 é domingo (feriado): sexta 13/11 + 1 útil continua sendo segunda 16/11
  assert.equal(calcularVencimento('2026-11-13', 1, 'uteis', FERIADOS), '2026-11-16');
});

test('prazo corrido ignora fim de semana e feriado', () => {
  assert.equal(calcularVencimento('2026-11-17', 3, 'corridos', FERIADOS), '2026-11-20');
});

test('sem_prazo não gera vencimento', () => {
  assert.equal(calcularVencimento('2026-11-17', null, 'sem_prazo', FERIADOS), null);
});

test('aceita Date do driver pg (DATE = meia-noite local) e ISO completo', () => {
  assert.equal(calcularVencimento(new Date(2026, 10, 17), 3, 'uteis', FERIADOS.map((d) => new Date(d + 'T00:00:00'))), '2026-11-23');
  assert.equal(calcularVencimento('2026-11-17T00:00:00.000Z', 3, 'uteis', FERIADOS), '2026-11-23');
});

test('resultado não depende do fuso do servidor (UTC x Manaus x outros)', () => {
  const script = `
    const { calcularVencimento } = require(${JSON.stringify(path.join(__dirname, '../services/prazo-service'))});
    const feriados = ['2026-11-20'].map((d) => new Date(d + 'T00:00:00'));
    console.log(calcularVencimento(new Date(2026, 10, 17), 3, 'uteis', feriados));
    process.exit(0);
  `;
  for (const tz of ['UTC', 'America/Manaus', 'America/Sao_Paulo', 'Asia/Tokyo']) {
    const saida = execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz } }).toString().trim();
    assert.equal(saida, '2026-11-23', `TZ=${tz}`);
  }
});

test('hojeManaus usa o dia civil de Manaus, não o dia UTC', () => {
  // 17/11 09:26 em Manaus (a puxada do caso relatado) = 13:26 UTC
  assert.equal(hojeManaus(new Date('2026-11-17T13:26:21Z')), '2026-11-17');
  // 17/11 22:30 em Manaus já é 18/11 02:30 UTC: o dia ainda é 17
  assert.equal(hojeManaus(new Date('2026-11-18T02:30:00Z')), '2026-11-17');
  // fronteiras da meia-noite de Manaus (UTC-4)
  assert.equal(hojeManaus(new Date('2026-11-17T03:59:59Z')), '2026-11-16');
  assert.equal(hojeManaus(new Date('2026-11-17T04:00:00Z')), '2026-11-17');
});

test('formatarDataBR', () => {
  assert.equal(formatarDataBR('2026-11-23'), '23/11/2026');
  assert.equal(formatarDataBR(null), '');
});

test('iniciaNovaExecucao: quando o prazo reinicia e quando NÃO reinicia', () => {
  const nova = (o) => iniciaNovaExecucao(o);

  // puxada/distribuição da fila, reabertura -> nova execução
  assert.equal(nova({ statusAtual: 'aguardando', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: null }), true);
  assert.equal(nova({ statusAtual: 'aguardando', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: 5 }), true);
  assert.equal(nova({ statusAtual: 'concluido', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: 5 }), true);
  assert.equal(nova({ statusAtual: 'concluido_parcial', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: null }), true);

  // serviço diferente em andamento -> nova execução (serviços sucessivos)
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: 7 }), true);
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: '7' }), true);

  // requisição repetida / troca só de responsável / edição comum -> NÃO reinicia
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: 5 }), false);
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: '5' }), false);
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'andamento', servicoAtualId: 5, servicoNovoId: undefined }), false);

  // ainda na fila ou saindo de andamento -> nada começa
  assert.equal(nova({ statusAtual: 'aguardando', statusNovo: 'aguardando', servicoAtualId: 5, servicoNovoId: 7 }), false);
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'concluido', servicoAtualId: 5, servicoNovoId: 5 }), false);
  assert.equal(nova({ statusAtual: 'andamento', statusNovo: 'cancelado', servicoAtualId: 5, servicoNovoId: 7 }), false);
});
