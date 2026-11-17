#!/usr/bin/env node
// Recalcula o vencimento de protocolos EM ANDAMENTO gravados com a regra antiga:
//   (a) puxados/distribuídos antes da correção da data-base (prazo contado da data
//       de entrada em vez da data da puxada/distribuição) e
//   (b) já com data-base, mas calculados sem contar o dia-base (até 17/11/2026 o
//       sistema começava a contar no dia seguinte; a regra agora é o dia-base
//       contar como dia 1: puxado em 17/11, 3 dias úteis = 17, 18, 19).
//
// SIMULAÇÃO POR PADRÃO: sem --apply nada é gravado no banco; o script só lista,
// grava um CSV com valor atual x valor recalculado e imprime o resumo.
//
// Uso (no servidor, dentro do container do backend; ou local com DB_* no ambiente):
//   docker compose exec backend node scripts/recalcular-prazos-puxada.js
//   docker compose exec backend node scripts/recalcular-prazos-puxada.js --numero 224854
//   docker compose exec backend node scripts/recalcular-prazos-puxada.js --numero 224854 --apply
//   docker compose exec backend node scripts/recalcular-prazos-puxada.js --apply --limite 50
//
// Opções:
//   --apply          grava as correções (uma transação; cada linha só é alterada se
//                    o vencimento no banco ainda for o mesmo que foi simulado)
//   --numero <n>     restringe a um protocolo
//   --limite <n>     com --apply, corrige no máximo n protocolos (lote gradual)
//   --classe <c>     com --apply, só aplica a essa classe do relatório (ex.: corrigir_contagem_dia_base)
//   --desde <data>   com --apply, só aplica a protocolos puxados/distribuídos a partir dessa
//                    data AAAA-MM-DD (dia civil de Manaus), ex.: --desde 2026-11-11
//   --saida <arq>    caminho do CSV (padrão: ./recalculo-prazos-<data-hora>.csv)
//
// EVIDÊNCIA usada (nada é chutado):
//   - A data da puxada/distribuição vem do evento 'transferencia' mais recente do
//     histórico, convertido para o dia civil de America/Manaus.
//   - Só é considerada corrigível quando esse evento é a ÚLTIMA movimentação que
//     pode ter mexido no prazo, o texto do evento nomeia o serviço atual
//     ('serviço definido como "..."', escrito pela rota /transferir quando um
//     serviço foi escolhido) e o vencimento gravado é exatamente o que o cálculo
//     antigo (a partir da data de entrada) produziria.
//   - Todo o resto é SINALIZADO para análise e não é alterado.
//
// Nunca usa a data atual nem updated_at como data-base.

const fs = require('fs');
const pool = require('../config/database');
const { calcularVencimento, formatarDataBR } = require('../services/prazo-service');
const ANTIGA = { contarDiaBase: false }; // contagem usada até 17/11/2026

const args = process.argv.slice(2);
const opt = (nome) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const APLICAR = args.includes('--apply');
const NUMERO = opt('--numero');
const LIMITE = opt('--limite') ? Number(opt('--limite')) : Infinity;
const CLASSE = opt('--classe');
const DESDE = opt('--desde');
if (DESDE && !/^\d{4}-\d{2}-\d{2}$/.test(DESDE)) {
  console.error('--desde precisa estar no formato AAAA-MM-DD');
  process.exit(1);
}
const agora = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const SAIDA = opt('--saida') || `recalculo-prazos-${agora}.csv`;

const CLASSES = {
  CORRIGIR: 'corrigir',                          // vencimento muda
  CORRIGIR_CONTAGEM: 'corrigir_contagem_dia_base', // data-base já gravada; só falta contar o dia-base
  REGISTRAR_BASE: 'registrar_data_base',         // vencimento já certo; só grava a data-base
  JA_REGISTRADO: 'ja_tem_data_base',             // criado/puxado depois da correção
  SEM_PRAZO: 'servico_sem_prazo',
  ANALISAR_SEM_SERVICO: 'analisar_puxada_sem_servico_no_evento',
  ANALISAR_SERVICO_DIFERENTE: 'analisar_servico_do_evento_difere_do_atual',
  ANALISAR_VENC_DIVERGE: 'analisar_vencimento_nao_bate_com_calculo_pela_entrada',
  ANALISAR_OUTRA_ACAO: 'analisar_ultima_movimentacao_alterou_prazo',
  OK_SEM_TRANSFERENCIA: 'ok_sem_transferencia',  // nunca puxado: prazo da entrada é o certo
  OK_JA_RECALCULADO: 'ok_reabertura_ou_arquivo', // essas rotas já contavam de "hoje"
};

const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

async function main() {
  const feriados = (await pool.query('SELECT data FROM feriados')).rows.map((r) => r.data);

  // A simulação pode rodar ANTES da migration 009 (coluna ainda não existe); a
  // aplicação não: ela grava prazo_base_data.
  const temColuna = (await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name = 'protocolos' AND column_name = 'prazo_base_data'"
  )).rowCount > 0;
  if (!temColuna && APLICAR) {
    throw new Error('A coluna protocolos.prazo_base_data não existe. Aplique antes backend/migrations/009_prazo_base_data.sql.');
  }
  if (!temColuna) console.log('(coluna prazo_base_data ainda não existe: simulação considera todos os protocolos sem data-base registrada)');
  const colunaBase = temColuna ? 'p.prazo_base_data::text' : 'NULL::text';

  const filtroNumero = NUMERO ? 'AND p.numero = $1' : '';
  const { rows } = await pool.query(
    `WITH ult AS (
       SELECT DISTINCT ON (h.protocolo_id)
              h.protocolo_id, h.id AS evento_id, h.acao, h.descricao,
              uu.nome AS evento_usuario,
              (h.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Manaus') AS evento_em_manaus,
              ((h.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Manaus')::date)::text AS evento_dia
       FROM historico h
       LEFT JOIN usuarios uu ON uu.id = h.usuario_id
       WHERE h.acao IN ('transferencia','transferencia_arquivo','reabertura','ADICIONAR_SERVICO','ATUALIZACAO','CRIACAO')
       ORDER BY h.protocolo_id, h.created_at DESC, h.id DESC
     )
     SELECT p.id, p.numero, p.data_entrada::text AS data_entrada, p.data_vencimento::text AS data_vencimento,
            ${colunaBase} AS prazo_base_data,
            s.nome AS servico_nome, s.prazo, s.tipo_prazo,
            u.nome AS responsavel_nome,
            ult.evento_id, ult.acao, ult.descricao, ult.evento_usuario,
            to_char(ult.evento_em_manaus, 'DD/MM/YYYY HH24:MI') AS evento_quando, ult.evento_dia
     FROM protocolos p
     JOIN servicos s ON s.id = p.servico_id
     JOIN usuarios u ON u.id = p.responsavel_id
     LEFT JOIN ult ON ult.protocolo_id = p.id
     WHERE p.status = 'andamento' ${filtroNumero}
     ORDER BY p.numero`,
    NUMERO ? [NUMERO] : []
  );

  const itens = rows.map((p) => {
    const item = {
      id: p.id, numero: p.numero, servico: p.servico_nome, responsavel: p.responsavel_nome,
      data_entrada: p.data_entrada, vencimento_atual: p.data_vencimento || '',
      prazo: p.prazo, tipo_prazo: p.tipo_prazo,
      evento: p.acao ? `${p.acao} em ${p.evento_quando} por ${p.evento_usuario || '?'}` : '',
      evento_dia: p.evento_dia || '',
      data_base_proposta: '', vencimento_novo: '', classe: '', motivo: '',
      base_atual: p.prazo_base_data || '',
    };

    if (p.tipo_prazo === 'sem_prazo') { item.classe = p.prazo_base_data ? CLASSES.JA_REGISTRADO : CLASSES.SEM_PRAZO; return item; }
    if (p.prazo_base_data) {
      // Data-base já gravada: só corrige se o vencimento é exatamente o da contagem
      // antiga (sem o dia-base) e difere do da regra atual.
      const antigo = calcularVencimento(p.prazo_base_data, p.prazo, p.tipo_prazo, feriados, ANTIGA);
      const atual = calcularVencimento(p.prazo_base_data, p.prazo, p.tipo_prazo, feriados);
      if (p.data_vencimento === antigo && antigo !== atual) {
        item.classe = CLASSES.CORRIGIR_CONTAGEM;
        item.data_base_proposta = p.prazo_base_data;
        item.vencimento_novo = atual;
        item.motivo = 'vencimento gravado sem contar o dia-base';
      } else {
        item.classe = CLASSES.JA_REGISTRADO;
      }
      return item;
    }
    if (!p.acao || p.acao === 'CRIACAO') { item.classe = CLASSES.OK_SEM_TRANSFERENCIA; return item; }
    if (p.acao === 'reabertura' || p.acao === 'transferencia_arquivo') { item.classe = CLASSES.OK_JA_RECALCULADO; return item; }
    if (p.acao !== 'transferencia') {
      item.classe = CLASSES.ANALISAR_OUTRA_ACAO;
      item.motivo = `a última movimentação (${p.acao}) pode ter alterado o prazo depois da puxada`;
      return item;
    }

    const m = /serviço definido como "([^"]+)"/.exec(p.descricao || '');
    if (!m) {
      item.classe = CLASSES.ANALISAR_SEM_SERVICO;
      item.motivo = 'o evento não diz se foi puxada da fila ou só troca de responsável';
      return item;
    }
    if (m[1] !== p.servico_nome) {
      item.classe = CLASSES.ANALISAR_SERVICO_DIFERENTE;
      item.motivo = `o evento define "${m[1]}" mas o serviço atual é "${p.servico_nome}"`;
      return item;
    }

    const pelaEntrada = calcularVencimento(p.data_entrada, p.prazo, p.tipo_prazo, feriados, ANTIGA);
    if (p.data_vencimento !== pelaEntrada) {
      item.classe = CLASSES.ANALISAR_VENC_DIVERGE;
      item.motivo = `vencimento gravado ${p.data_vencimento} difere do cálculo pela entrada (${pelaEntrada}); alguém alterou depois`;
      return item;
    }

    item.data_base_proposta = p.evento_dia;
    item.vencimento_novo = calcularVencimento(p.evento_dia, p.prazo, p.tipo_prazo, feriados);
    item.classe = item.vencimento_novo === p.data_vencimento ? CLASSES.REGISTRAR_BASE : CLASSES.CORRIGIR;
    return item;
  });

  // ---------- relatório ----------
  const cabecalho = ['numero', 'servico', 'responsavel', 'data_entrada', 'evento', 'data_base_proposta',
    'prazo', 'tipo_prazo', 'vencimento_atual', 'vencimento_novo', 'classe', 'motivo'];
  fs.writeFileSync(
    SAIDA,
    '﻿' + [cabecalho.join(';'), ...itens.map((i) => cabecalho.map((c) => csv(i[c])).join(';'))].join('\r\n') + '\r\n'
  );

  const porClasse = {};
  for (const i of itens) porClasse[i.classe] = (porClasse[i.classe] || 0) + 1;
  console.log(`\nProtocolos em andamento analisados: ${itens.length}`);
  for (const [c, n] of Object.entries(porClasse).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(5)}  ${c}`);

  const corrigir = itens.filter((i) => i.classe === CLASSES.CORRIGIR || i.classe === CLASSES.CORRIGIR_CONTAGEM);
  const jaVencidosHoje = corrigir.filter((i) => i.vencimento_atual < new Date().toISOString().slice(0, 10)).length;
  console.log(`\nA CORRIGIR: ${corrigir.length} protocolo(s) mudam de vencimento` +
    ` (${jaVencidosHoje} deles hoje aparecem como vencidos pelo valor atual).`);
  for (const i of corrigir.slice(0, 15)) {
    console.log(`  #${i.numero}  ${i.servico} (${i.prazo} ${i.tipo_prazo})  entrada ${formatarDataBR(i.data_entrada)}  ` +
      `puxado ${formatarDataBR(i.data_base_proposta)}  vence ${formatarDataBR(i.vencimento_atual)} -> ${formatarDataBR(i.vencimento_novo)}`);
  }
  if (corrigir.length > 15) console.log(`  ... e mais ${corrigir.length - 15} (veja o CSV)`);
  console.log(`\nCSV completo: ${SAIDA}`);

  if (!APLICAR) {
    console.log('\nSIMULAÇÃO: nada foi gravado. Para aplicar use --apply (recomendado: primeiro com --numero ou --limite).');
    return;
  }

  // ---------- aplicação ----------
  const alvo = itens
    .filter((i) => i.classe === CLASSES.CORRIGIR || i.classe === CLASSES.CORRIGIR_CONTAGEM || i.classe === CLASSES.REGISTRAR_BASE)
    .filter((i) => !CLASSE || i.classe === CLASSE)
    .filter((i) => !DESDE || (i.data_base_proposta && i.data_base_proposta >= DESDE))
    .slice(0, LIMITE);
  console.log(`\nAPLICANDO em ${alvo.length} protocolo(s) (corrigir + registrar data-base)...`);

  const client = await pool.connect();
  let alterados = 0;
  let pulados = 0;
  try {
    await client.query('BEGIN');
    for (const i of alvo) {
      // Guarda otimista: só altera se ninguém mexeu desde a simulação.
      const r = await client.query(
        `UPDATE protocolos
         SET data_vencimento = $1, prazo_base_data = $2, updated_at = updated_at
         WHERE id = $3 AND status = 'andamento'
           AND prazo_base_data IS NOT DISTINCT FROM $5::date
           AND data_vencimento IS NOT DISTINCT FROM $4::date`,
        [i.vencimento_novo || null, i.data_base_proposta, i.id, i.vencimento_atual || null, i.base_atual || null]
      );
      if (r.rowCount === 0) { pulados++; continue; }
      alterados++;
      await client.query(
        `INSERT INTO historico (protocolo_id, usuario_id, acao, descricao, created_at)
         VALUES ($1, NULL, 'RECALCULO_PRAZO', $2, NOW())`,
        [i.id, (i.classe === CLASSES.CORRIGIR_CONTAGEM
          ? `Prazo ajustado: o dia da puxada/distribuição (${formatarDataBR(i.data_base_proposta)}) passa a contar como dia 1. `
          : `Prazo recalculado a partir da puxada/distribuição em ${formatarDataBR(i.data_base_proposta)} (evento ${i.evento}). `) +
          `Vencimento anterior: ${formatarDataBR(i.vencimento_atual)}; novo: ${formatarDataBR(i.vencimento_novo)}. ` +
          `Correção em lote (scripts/recalcular-prazos-puxada.js).`]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  console.log(`Concluído: ${alterados} alterado(s), ${pulados} pulado(s) (mudaram desde a simulação). O CSV acima guarda os valores anteriores.`);
}

main()
  .catch((e) => { console.error('Falha:', e.message); process.exitCode = 1; })
  .finally(() => pool.end());
