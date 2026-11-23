// Testa scripts/recalcular-prazos-puxada.js (simulação e --apply) com fixtures que
// reproduzem o estado de produção antes da correção. Só banco de DESENVOLVIMENTO.
//   RUN_DB_TESTS=1 DB_HOST=localhost DB_PASSWORD=<senha> npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RODAR = process.env.RUN_DB_TESTS === '1';
const HOST_OK = ['localhost', '127.0.0.1'].includes(process.env.DB_HOST || 'localhost');
const opts = { skip: !RODAR ? 'defina RUN_DB_TESTS=1 para rodar' : !HOST_OK ? 'DB_HOST não é local' : false };
const PREFIXO = 'TESTE-RECALC-';

test('script de recálculo: classifica, simula sem gravar, aplica uma vez só', opts, async () => {
  const pool = require('../config/database');
  const { calcularVencimento } = require('../services/prazo-service');
  const feriados = (await pool.query('SELECT data FROM feriados')).rows.map((r) => r.data);
  // Estados que existem gravados em produção:
  //  LEGADO   (antes de 17/11): vencimento contado da ENTRADA, a partir do dia seguinte;
  //  INTERINO (17 a 23/11): dia da puxada contava como dia 1;
  //  VIGENTE  (desde 23/11): conta a partir do dia útil SEGUINTE à puxada.
  const vencLegado = (base, prazo = 3, tipo = 'uteis') => calcularVencimento(base, prazo, tipo, feriados, { contarDiaBase: false });
  const vencInterino = (base, prazo = 3, tipo = 'uteis') => calcularVencimento(base, prazo, tipo, feriados, { contarDiaBase: true });
  const vencVigente = (base, prazo = 3, tipo = 'uteis') => calcularVencimento(base, prazo, tipo, feriados);

  const reg = (await pool.query("SELECT id FROM usuarios WHERE cargo = 'Registrador' AND ativo = true ORDER BY id LIMIT 1")).rows[0];
  const atd = (await pool.query("SELECT id FROM usuarios WHERE ativo = true ORDER BY id DESC LIMIT 1")).rows[0];
  const srv = (await pool.query(
    "INSERT INTO servicos (nome, prazo, tipo_prazo, ativo) VALUES ($1, 3, 'uteis', true) RETURNING id, nome", [`${PREFIXO}serv`])).rows[0];
  const outro = (await pool.query(
    "INSERT INTO servicos (nome, prazo, tipo_prazo, ativo) VALUES ($1, 3, 'uteis', true) RETURNING id, nome", [`${PREFIXO}outro`])).rows[0];

  // Reproduz o que a rota ANTIGA gravava: vencimento contado da entrada, sem data-base.
  const fixture = async (sufixo, { entrada, vencimento, eventos, base = null, servico = srv }) => {
    const numero = `${PREFIXO}${sufixo}`;
    const p = (await pool.query(
      `INSERT INTO protocolos (numero, servico_id, responsavel_id, data_entrada, data_vencimento, prazo_base_data, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'andamento') RETURNING id`,
      [numero, servico.id, reg.id, entrada, vencimento, base])).rows[0];
    for (const [acao, descricao, quando] of eventos) {
      await pool.query(
        'INSERT INTO historico (protocolo_id, usuario_id, acao, descricao, created_at) VALUES ($1, $2, $3, $4, $5)',
        [p.id, atd.id, acao, descricao, quando]);
    }
    return { id: p.id, numero };
  };
  const criacao = ['CRIACAO', 'Protocolo criado', '2026-11-13 19:36:40'];
  const puxada = (nome = srv.nome, quando = '2026-11-17 13:26:21') =>
    ['transferencia', `Protocolo transferido de X para Y, serviço definido como "${nome}"`, quando];

  const A = await fixture('A-corrigir', { entrada: '2026-11-13', vencimento: vencLegado('2026-11-13'), eventos: [criacao, puxada()] });
  const B = await fixture('B-sem-servico', { entrada: '2026-11-13', vencimento: vencLegado('2026-11-13'),
    eventos: [criacao, ['transferencia', 'Protocolo transferido de X para Y', '2026-11-17 13:26:21']] });
  const C = await fixture('C-venc-diverge', { entrada: '2026-11-13', vencimento: '2026-12-01', eventos: [criacao, puxada()] });
  // puxado no mesmo dia da entrada: o vencimento legado (18, 19, 23) já é o vigente, só falta a data-base
  const D = await fixture('D-mesmo-dia', { entrada: '2026-11-17', vencimento: vencLegado('2026-11-17'),
    eventos: [['CRIACAO', 'criado', '2026-11-17 12:00:00'], puxada(srv.nome, '2026-11-17 13:00:00')] });
  // entrada sexta 13/11 (legado 16, 17, 18 = 18/11), puxada segunda 16/11 (vigente 17, 18, 19 = 19/11)
  const D2 = await fixture('D2-puxada-depois', { entrada: '2026-11-13', vencimento: vencLegado('2026-11-13'),
    eventos: [criacao, puxada(srv.nome, '2026-11-16 13:00:00')] });
  // data-base já gravada com a contagem INTERINA (dia da puxada = dia 1: 19/11): é o caso do 224854
  const E = await fixture('E-base-interina', { entrada: '2026-11-13', vencimento: vencInterino('2026-11-17'), base: '2026-11-17', eventos: [criacao, puxada()] });
  const E2 = await fixture('E2-ja-correto', { entrada: '2026-11-13', vencimento: vencVigente('2026-11-17'), base: '2026-11-17', eventos: [criacao, puxada()] });
  const F = await fixture('F-servico-difere', { entrada: '2026-11-13', vencimento: vencLegado('2026-11-13'), eventos: [criacao, puxada(outro.nome)] });
  const G = await fixture('G-edicao-depois', { entrada: '2026-11-13', vencimento: vencLegado('2026-11-13'),
    eventos: [criacao, puxada(), ['ATUALIZACAO', 'Protocolo atualizado', '2026-11-18 12:00:00']] });
  const todos = [A, B, C, D, D2, E, E2, F, G];

  const estado = async (id) => (await pool.query(
    'SELECT data_vencimento::text AS venc, prazo_base_data::text AS base FROM protocolos WHERE id = $1', [id])).rows[0];
  const eventosRecalculo = async (id) => (await pool.query(
    "SELECT descricao FROM historico WHERE protocolo_id = $1 AND acao = 'RECALCULO_PRAZO'", [id])).rows;

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'recalc-'));
  const rodar = (...args) => {
    const csv = path.join(dir, `saida-${Math.random().toString(36).slice(2)}.csv`);
    execFileSync(process.execPath, [path.join(__dirname, '../scripts/recalcular-prazos-puxada.js'), '--saida', csv, ...args],
      { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const linhas = fs.readFileSync(csv, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
    const cab = linhas[0].split(';');
    const mapa = {};
    for (const l of linhas.slice(1)) {
      const cols = l.match(/"([^"]|"")*"/g).map((c) => c.slice(1, -1).replace(/""/g, '"'));
      const o = Object.fromEntries(cab.map((c, i) => [c, cols[i]]));
      mapa[o.numero] = o;
    }
    return mapa;
  };

  try {
    const antes = {};
    for (const f of todos) antes[f.numero] = await estado(f.id);

    // ---- simulação ----
    const sim = rodar();
    assert.equal(sim[A.numero].classe, 'corrigir');
    assert.equal(sim[A.numero].data_base_proposta, '2026-11-17');
    assert.equal(sim[A.numero].vencimento_atual, vencLegado('2026-11-13')); // 18/11
    assert.equal(sim[A.numero].vencimento_novo, '2026-11-23'); // 18, 19, (20 feriado), 23
    assert.equal(sim[B.numero].classe, 'analisar_puxada_sem_servico_no_evento');
    assert.equal(sim[C.numero].classe, 'analisar_vencimento_nao_bate_com_calculo_pela_entrada');
    assert.equal(sim[D.numero].classe, 'registrar_data_base');
    assert.equal(sim[D.numero].vencimento_novo, sim[D.numero].vencimento_atual); // vencimento já certo
    assert.equal(sim[D2.numero].classe, 'corrigir');
    assert.equal(sim[D2.numero].vencimento_atual, '2026-11-18');
    assert.equal(sim[D2.numero].vencimento_novo, '2026-11-19');
    assert.equal(sim[E.numero].classe, 'corrigir_contagem_dia_base');
    assert.equal(sim[E.numero].vencimento_atual, '2026-11-19');
    assert.equal(sim[E.numero].vencimento_novo, '2026-11-23');
    assert.equal(sim[E2.numero].classe, 'ja_tem_data_base');
    assert.equal(sim[F.numero].classe, 'analisar_servico_do_evento_difere_do_atual');
    assert.equal(sim[G.numero].classe, 'analisar_ultima_movimentacao_alterou_prazo');
    for (const f of todos) assert.deepEqual(await estado(f.id), antes[f.numero], `simulação não pode gravar (${f.numero})`);

    // ---- --desde: só puxados a partir da data; nenhum fixture foi puxado em 18/11 ou depois ----
    rodar('--apply', '--desde', '2026-11-18');
    for (const x of todos) assert.deepEqual(await estado(x.id), antes[x.numero], '--desde 2026-11-18 não podia alterar ' + x.numero);
    // data inválida é recusada (não pode aplicar "tudo" por engano)
    assert.throws(() => rodar('--apply', '--desde', 'ontem'));
    for (const x of todos) assert.deepEqual(await estado(x.id), antes[x.numero], 'data inválida não podia alterar ' + x.numero);

    // ---- --classe: corrige só quem já tinha data-base gravada (como o 224854) e não toca nos antigos ----
    rodar('--apply', '--classe', 'corrigir_contagem_dia_base');
    assert.deepEqual(await estado(E.id), { venc: '2026-11-23', base: '2026-11-17' }); // 19/11 -> 23/11, data-base preservada
    const evE = await eventosRecalculo(E.id);
    assert.equal(evE.length, 1);
    assert.match(evE[0].descricao, /volta a começar no dia útil seguinte/);
    assert.match(evE[0].descricao, /anterior: 19\/11\/2026; novo: 23\/11\/2026/);
    for (const x of [A, B, C, D, D2, E2, F, G]) assert.deepEqual(await estado(x.id), antes[x.numero], 'o filtro --classe não podia alterar ' + x.numero);
    rodar('--apply', '--classe', 'corrigir_contagem_dia_base'); // repetir não faz nada
    assert.equal((await eventosRecalculo(E.id)).length, 1);
    assert.equal(rodar('--numero', E.numero)[E.numero].classe, 'ja_tem_data_base');
    antes[E.numero] = await estado(E.id);

    // ---- aplicação restrita a um protocolo ----
    rodar('--apply', '--numero', A.numero);
    assert.deepEqual(await estado(A.id), { venc: '2026-11-23', base: '2026-11-17' });
    const ev = await eventosRecalculo(A.id);
    assert.equal(ev.length, 1);
    assert.match(ev[0].descricao, /17\/11\/2026/);
    assert.match(ev[0].descricao, new RegExp('anterior: ' + vencLegado('2026-11-13').split('-').reverse().join('/')));
    for (const x of [B, C, D, D2, E, E2, F, G]) assert.deepEqual(await estado(x.id), antes[x.numero], 'não deveria alterar ' + x.numero);

    // ---- repetir a aplicação não faz nada (A já tem data-base e a contagem certa) ----
    rodar('--apply', '--numero', A.numero);
    assert.deepEqual(await estado(A.id), { venc: '2026-11-23', base: '2026-11-17' });
    assert.equal((await eventosRecalculo(A.id)).length, 1);
    assert.equal(rodar('--numero', A.numero)[A.numero].classe, 'ja_tem_data_base');
  } finally {
    await pool.query('DELETE FROM protocolos WHERE numero LIKE $1', [`${PREFIXO}%`]);
    await pool.query('DELETE FROM servicos WHERE nome LIKE $1', [`${PREFIXO}%`]);
    fs.rmSync(dir, { recursive: true, force: true });
    await pool.end();
  }
});
