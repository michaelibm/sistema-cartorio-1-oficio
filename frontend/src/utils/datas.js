// Datas de calendário (colunas DATE do banco, como data_vencimento).
//
// A API serializa uma coluna DATE como "2026-11-23T00:00:00.000Z" (meia-noite
// UTC). Passar isso direto para `new Date(...)` num navegador em Manaus (UTC-4)
// dá 22/11 às 20h: o protocolo parecia vencer um dia antes e já aparecia como
// "VENCIDO" no próprio dia do vencimento. Para colunas DATE vale só o dia
// (AAAA-MM-DD): estas funções o leem como data LOCAL, sem conversão de fuso.

// "2026-11-23" ou "2026-11-23T00:00:00.000Z" -> Date em 23/11 à meia-noite LOCAL.
// Vazio/nulo/inválido -> null.
export function dataLocal(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(valor));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Dias de calendário até a data (0 = hoje, negativo = já passou). Sem data -> null.
export function diasAte(valor, hoje = new Date()) {
  const d = dataLocal(valor);
  if (!d) return null;
  const h = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((d - h) / 86400000);
}

// "2026-11-23..." -> "23/11/2026"; vazio -> ''.
export function formatarDataBR(valor) {
  const d = dataLocal(valor);
  return d ? d.toLocaleDateString('pt-BR') : '';
}
