// Testes de integração das rotas de puxada/distribuição/edição contra um banco
// PostgreSQL de DESENVOLVIMENTO (cria e apaga protocolos TESTE-PRAZO-*).
//
// Rodar (banco do docker compose local):
//   cd backend
//   RUN_DB_TESTS=1 DB_HOST=localhost DB_PASSWORD=<senha do .env> npm test
//
// Nunca aponte para o banco de produção: sem RUN_DB_TESTS=1 estes testes são
// ignorados, e eles recusam rodar se DB_HOST não for localhost/127.0.0.1.
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');

const RODAR = process.env.RUN_DB_TESTS === '1';
const HOST_OK = ['localhost', '127.0.0.1'].includes(process.env.DB_HOST || 'localhost');
const opts = { skip: !RODAR ? 'defina RUN_DB_TESTS=1 para rodar' : !HOST_OK ? 'DB_HOST não é local' : false };

const PREFIXO = 'TESTE-PRAZO-';

test('rotas de prazo (puxada, distribuição, edição)', opts, async (t) => {
  const pool = require('../config/database');
  const { calcularVencimento } = require('../services/prazo-service');
  const protocoloRoutes = require('../routes/protocolos');

  // ---------- servidor HTTP em memória ----------
  const app = express();
  app.use(express.json());
  app.use('/api/protocolos', protocoloRoutes);
  const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
  const base = `http://127.0.0.1:${server.address().port}/api/protocolos`;
  const segredo = process.env.JWT_SECRET || 'seu-secret-aqui-mude-em-producao';

  // ---------- massa de teste ----------
  const usuarios = (await pool.query('SELECT id, nome, cargo, email FROM usuarios WHERE ativo = true ORDER BY id')).rows;
  const sup = usuarios.find((u) => u.cargo === 'Supervisor');
  const regs = usuarios.filter((u) => u.cargo === 'Registrador');
  const atendente = usuarios.find((u) => u.cargo === 'Atendente') || sup;
  assert.ok(sup && regs.length >= 1, 'o banco precisa de 1 Supervisor e 1 Registrador');
  const reg1 = regs[0];
  const reg2 = regs[1] || sup; // outro responsável para testar redistribuição

  const token = (u) => jwt.sign({ id: u.id, cargo: u.cargo, email: u.email, nome: u.nome }, segredo);
  const api = async (metodo, caminho, usuario, corpo) => {
    const r = await fetch(`${base}${caminho}`, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token(usuario)}` },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    let json = null;
    try { json = await r.json(); } catch { /* sem corpo */ }
    return { status: r.status, body: json };
  };

  // Serviços de teste (nomes únicos; removidos no fim)
  const sv = {};
  for (const [chave, prazo, tipo] of [['u3', 3, 'uteis'], ['u5', 5, 'uteis'], ['c3', 3, 'corridos'], ['sem', null, 'sem_prazo']]) {
    const r = await pool.query(
      "INSERT INTO servicos (nome, prazo, tipo_prazo, ativo) VALUES ($1, $2, $3, true) RETURNING id",
      [`${PREFIXO}serv-${chave}`, prazo, tipo]
    );
    sv[chave] = r.rows[0].id;
  }

  // Feriados usados pelo cenário (só remove os que o teste inseriu)
  const feriadosInseridos = [];
  for (const d of ['2026-11-20']) {
    const r = await pool.query(
      "INSERT INTO feriados (data, descricao) VALUES ($1, 'TESTE-PRAZO') ON CONFLICT (data) DO NOTHING RETURNING data",
      [d]
    );
    if (r.rowCount) feriadosInseridos.push(d);
  }
  const feriados = (await pool.query('SELECT data FROM feriados')).rows.map((r) => r.data);
  const esperado = (dataBase, prazo, tipo) => calcularVencimento(dataBase, prazo, tipo, feriados);

  let seq = 0;
  const novoProtocolo = async ({ servico, entrada, status = 'aguardando', responsavel = atendente }) => {
    const num = `${PREFIXO}${Date.now()}-${++seq}`;
    const s = (await pool.query('SELECT prazo, tipo_prazo FROM servicos WHERE id = $1', [servico])).rows[0];
    const venc = esperado(entrada, s.prazo, s.tipo_prazo); // como nasce hoje: a partir da entrada
    const r = await pool.query(
      `INSERT INTO protocolos (numero, servico_id, responsavel_id, data_entrada, data_vencimento, prazo_base_data, status)
       VALUES ($1, $2, $3, $4, $5, $4, $6) RETURNING id`,
      [num, servico, responsavel.id, entrada, venc, status]
    );
    return { id: r.rows[0].id, numero: num };
  };
  const ler = async (id) => {
    const r = await pool.query(
      `SELECT status, servico_id, responsavel_id, data_entrada::text AS data_entrada,
              data_vencimento::text AS data_vencimento, prazo_base_data::text AS prazo_base_data
       FROM protocolos WHERE id = $1`, [id]);
    return r.rows[0];
  };

  // Colunas que existem em produção mas não em nenhuma migration/init.sql do
  // repositório (mesma lacuna do orcamento_valor citada no AGENTS.md). Mesmos tipos
  // de produção, só para o banco de desenvolvimento destes testes.
  await pool.query(`
    ALTER TABLE protocolos
      ADD COLUMN IF NOT EXISTS tem_orcamento boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS orcamento_valor numeric,
      ADD COLUMN IF NOT EXISTS orcamento_pago boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS prioridade integer DEFAULT 2`);

  // A rota /iniciar grava em protocolo_sessoes, tabela que existe em produção mas
  // não é criada por nenhuma migration/init.sql do repositório (lacuna antiga).
  // Mesmo DDL de produção, só para o banco de desenvolvimento destes testes.
  await pool.query(`
    CREATE TABLE IF NOT EXISTS protocolo_sessoes (
      id serial PRIMARY KEY,
      protocolo_id integer NOT NULL REFERENCES protocolos(id) ON DELETE CASCADE,
      usuario_id integer NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      iniciado_em timestamptz NOT NULL DEFAULT now(),
      pausado_em timestamptz,
      nota_pausa text,
      created_at timestamptz DEFAULT now()
    )`);

  // Relógio simulado: só o Date (o resto — timers, rede, pg — segue real).
  // Sempre desliga o anterior antes, para uma falha não contaminar o teste seguinte.
  const definirAgora = (iso) => {
    t.mock.timers.reset();
    t.mock.timers.enable({ apis: ['Date'], now: new Date(iso) });
  };
  const pararRelogio = () => t.mock.timers.reset();

  try {
    await t.test('1. caso relatado: entrada 13/11, puxada 17/11 -> prazo de 3 dias úteis conta de 17/11', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      assert.equal((await ler(p.id)).data_vencimento, '2026-11-18'); // contado da entrada (16, 17, 18)

      definirAgora('2026-11-17T13:26:21Z'); // 09:26 em Manaus
      const r = await api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true });
      pararRelogio();

      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.status, 'andamento');
      assert.equal(d.responsavel_id, reg1.id);
      assert.equal(d.prazo_base_data, '2026-11-17');
      assert.equal(d.data_vencimento, '2026-11-23'); // 18, 19, (20 feriado, 21-22 fim de semana), 23: o dia da puxada não conta
      assert.equal(d.data_entrada, '2026-11-13'); // entrada preservada
      assert.equal(r.body.data_vencimento, '2026-11-23');
    });

    await t.test('1b. puxada escolhendo o serviço (como a Fila faz) usa o prazo do serviço escolhido', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T13:26:21Z');
      const r = await api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true, servico_id: sv.u5 });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.servico_id, sv.u5);
      assert.equal(d.prazo_base_data, '2026-11-17');
      assert.equal(d.data_vencimento, esperado('2026-11-17', 5, 'uteis')); // 24/11
    });

    await t.test('2. distribuição: protocolo recebido antes usa a data da distribuição', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-03' });
      definirAgora('2026-11-17T15:00:00Z');
      const r = await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.u3 });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.prazo_base_data, '2026-11-17');
      assert.equal(d.data_vencimento, '2026-11-23');
      assert.equal(d.data_entrada, '2026-11-03');
    });

    await t.test('3+4. distribuição seguida de abertura/Iniciar e requisição repetida NÃO reiniciam o prazo', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-03' });
      definirAgora('2026-11-17T15:00:00Z');
      await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.u3 });
      const antes = await ler(p.id);
      pararRelogio();

      // dias depois: o registrador abre o protocolo e clica em "Iniciar"
      definirAgora('2026-11-19T12:00:00Z');
      const detalhe = await api('GET', `/${p.id}`, reg1);
      assert.equal(detalhe.status, 200);
      const ini = await api('POST', `/${p.id}/iniciar`, reg1);
      assert.equal(ini.status, 200, JSON.stringify(ini.body));
      // e a mesma distribuição é reenviada (duplo clique / retry)
      const repetida = await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.u3 });
      assert.equal(repetida.status, 200);
      assert.equal(repetida.body.novo_prazo, false);
      const repetidaPuxada = await api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true });
      assert.equal(repetidaPuxada.status, 200);
      pararRelogio();

      const depois = await ler(p.id);
      assert.equal(depois.prazo_base_data, antes.prazo_base_data);
      assert.equal(depois.data_vencimento, antes.data_vencimento);
    });

    await t.test('4b. duas puxadas simultâneas do mesmo protocolo: só a primeira inicia o prazo', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T13:00:00Z');
      const [a, b] = await Promise.all([
        api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true }),
        api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true }),
      ]);
      pararRelogio();
      assert.equal(a.status, 200);
      assert.equal(b.status, 200);
      assert.equal([a.body.novo_prazo, b.body.novo_prazo].filter(Boolean).length, 1);
      assert.equal((await ler(p.id)).prazo_base_data, '2026-11-17');
    });

    await t.test('5. calendário: sem feriado/fim de semana no caminho a conta é direta; com eles, pula', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-02' });
      definirAgora('2026-11-09T14:00:00Z'); // segunda
      await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id });
      pararRelogio();
      assert.equal((await ler(p.id)).data_vencimento, '2026-11-12'); // ter 10, qua 11, qui 12

      const c = await novoProtocolo({ servico: sv.c3, entrada: '2026-11-02' });
      definirAgora('2026-11-17T14:00:00Z');
      await api('POST', `/${c.id}/transferir`, sup, { novo_responsavel_id: reg1.id });
      pararRelogio();
      assert.equal((await ler(c.id)).data_vencimento, '2026-11-20'); // corridos: 18, 19, 20
    });

    await t.test('5a. protocolo 224947: puxado na quarta 18/11, 3 úteis = 19, (20 feriado, 21-22 fim de semana), 23 e 24', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-18T14:00:00Z');
      const r = await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.prazo_base_data, '2026-11-18');
      assert.equal(d.data_vencimento, '2026-11-24');
    });

    await t.test('5b. serviço sem prazo: puxar limpa o vencimento e registra a data-base', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T14:00:00Z');
      const r = await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.sem });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.data_vencimento, null);
      assert.equal(d.prazo_base_data, '2026-11-17');
    });

    await t.test('6. serviços sucessivos: nova execução usa a própria data; o histórico anterior é preservado', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-03' });
      definirAgora('2026-11-17T15:00:00Z');
      await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.u3 });
      pararRelogio();
      const h1 = (await pool.query("SELECT id, descricao FROM historico WHERE protocolo_id = $1 AND acao = 'transferencia' ORDER BY id", [p.id])).rows;
      assert.equal(h1.length, 1);

      // 2 dias depois o protocolo passa a um segundo serviço (5 dias úteis)
      definirAgora('2026-11-19T15:00:00Z');
      const r = await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.u5 });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.servico_id, sv.u5);
      assert.equal(d.prazo_base_data, '2026-11-19');
      assert.equal(d.data_vencimento, esperado('2026-11-19', 5, 'uteis'));
      assert.equal(d.data_entrada, '2026-11-03');

      const h2 = (await pool.query("SELECT id, descricao FROM historico WHERE protocolo_id = $1 AND acao = 'transferencia' ORDER BY id", [p.id])).rows;
      assert.equal(h2.length, 2); // o evento da primeira execução continua lá
      assert.equal(h2[0].id, h1[0].id);
      assert.equal(h2[0].descricao, h1[0].descricao);
      assert.match(h2[1].descricao, /iniciado em 19\/11\/2026/);
    });

    await t.test('7. troca só de responsável em andamento (mesmo serviço) NÃO renova o prazo', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-03' });
      definirAgora('2026-11-17T15:00:00Z');
      await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg1.id, servico_id: sv.u3 });
      const antes = await ler(p.id);
      pararRelogio();

      definirAgora('2026-11-19T15:00:00Z');
      const r = await api('POST', `/${p.id}/transferir`, sup, { novo_responsavel_id: reg2.id });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.responsavel_id, reg2.id);
      assert.equal(d.prazo_base_data, antes.prazo_base_data);
      assert.equal(d.data_vencimento, antes.data_vencimento);
    });

    await t.test('8. edição comum (modal envia servico_id e data_entrada sem mudança) não mexe no prazo', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T13:26:21Z');
      await api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true });
      const antes = await ler(p.id);
      assert.equal(antes.data_vencimento, '2026-11-23');
      pararRelogio();

      definirAgora('2026-11-18T13:00:00Z');
      const r = await api('PUT', `/${p.id}`, sup, {
        servico_id: antes.servico_id,
        responsavel_id: antes.responsavel_id,
        data_entrada: antes.data_entrada,
        status: antes.status,
        observacoes: 'só mudei a observação',
        prioridade: 3,
      });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const depois = await ler(p.id);
      assert.equal(depois.data_vencimento, '2026-11-23'); // antes do conserto voltava para o valor contado da entrada
      assert.equal(depois.prazo_base_data, '2026-11-17');
      assert.equal(depois.data_entrada, '2026-11-13');
    });

    await t.test('8b. distribuição pela edição (supervisor troca o responsável de protocolo "aguardando")', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T15:00:00Z');
      const r = await api('PUT', `/${p.id}`, sup, {
        servico_id: sv.u3, responsavel_id: reg1.id, data_entrada: '2026-11-13', status: 'aguardando',
      });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.status, 'andamento');
      assert.equal(d.prazo_base_data, '2026-11-17');
      assert.equal(d.data_vencimento, '2026-11-23');
    });

    await t.test('8c. protocolo ainda na fila: corrigir serviço/entrada recalcula a partir da entrada', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T15:00:00Z');
      const r = await api('PUT', `/${p.id}`, sup, {
        servico_id: sv.u5, data_entrada: '2026-11-13', status: 'aguardando',
      });
      pararRelogio();
      assert.equal(r.status, 200, JSON.stringify(r.body));
      const d = await ler(p.id);
      assert.equal(d.status, 'aguardando');
      assert.equal(d.prazo_base_data, '2026-11-13');
      assert.equal(d.data_vencimento, esperado('2026-11-13', 5, 'uteis'));
    });

    await t.test('9. exibição consistente: lista e detalhe devolvem o mesmo vencimento da puxada', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-17T13:26:21Z');
      await api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true });
      pararRelogio();

      const lista = await api('GET', `/?status=andamento&busca=${encodeURIComponent(p.numero)}`, sup);
      const detalhe = await api('GET', `/${p.id}`, sup);
      const naLista = lista.body.find((x) => x.id === p.id);
      assert.ok(naLista, 'protocolo na listagem');
      const dia = (v) => String(v).slice(0, 10);
      assert.equal(dia(naLista.data_vencimento), dia(detalhe.body.data_vencimento));
      // O backend serializa DATE como meia-noite UTC; o dia civil tem que ser 19/11.
      assert.equal(dia(naLista.data_vencimento), '2026-11-23');
      assert.equal(dia(naLista.prazo_base_data), '2026-11-17');
      assert.equal(dia(naLista.data_entrada), '2026-11-13');
    });

    await t.test('10. fuso: puxada às 22h30 de Manaus (já é dia seguinte em UTC) conta o dia de Manaus', async () => {
      const p = await novoProtocolo({ servico: sv.u3, entrada: '2026-11-13' });
      definirAgora('2026-11-18T02:30:00Z'); // 17/11 22:30 em Manaus
      await api('POST', `/${p.id}/transferir`, reg1, { novo_responsavel_id: reg1.id, puxar_fila: true });
      pararRelogio();
      const d = await ler(p.id);
      assert.equal(d.prazo_base_data, '2026-11-17');
      assert.equal(d.data_vencimento, '2026-11-23');
    });

    await t.test('11. criação direta grava a data-base (= entrada)', async () => {
      // criação direta (Protocolos > Novo): a data-base é a própria entrada
      definirAgora('2026-11-17T13:00:00Z');
      const num = `${PREFIXO}criacao-${Date.now()}`;
      const c = await api('POST', '/', sup, { numero: num, servico_id: sv.u3, responsavel_id: reg1.id, data_entrada: '2026-11-17' });
      pararRelogio();
      assert.equal(c.status, 201, JSON.stringify(c.body));
      const d = await ler(c.body.id);
      assert.equal(d.prazo_base_data, '2026-11-17');
      assert.equal(d.data_vencimento, '2026-11-23');
    });
  } finally {
    t.mock.timers.reset();
    await pool.query("DELETE FROM protocolos WHERE numero LIKE $1", [`${PREFIXO}%`]);
    await pool.query("DELETE FROM servicos WHERE nome LIKE $1", [`${PREFIXO}%`]);
    for (const d of feriadosInseridos) await pool.query('DELETE FROM feriados WHERE data = $1 AND descricao = $2', [d, 'TESTE-PRAZO']);
    await new Promise((r) => server.close(r));
    await pool.end();
  }
});
