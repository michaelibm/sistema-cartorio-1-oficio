# API de Produtividade (`/api/produtividade/*`)

API para integração com sistemas externos que precisam consultar a produtividade
dos registradores **com nome** (diferente de `/api/painel/dados`, que é anônima —
veja [PAINEL_API.md](PAINEL_API.md)).

## Autenticação

Mesma chave usada pelo painel externo:

```
Header: X-API-Key: <chave>
```

Gerada/consultada em **Configurações → Painel Externo (Corregedoria)**, ou pela
variável de ambiente `PAINEL_API_KEY`. Se nenhuma das duas estiver configurada,
as rotas ficam públicas (compatibilidade).

## Período (comum a quase todas as rotas)

- `periodo=hoje` | `semana` | `mes` | `ano` — atalhos. **Padrão: `mes` (mês atual)**
  quando nada é informado.
- ou `data_inicio=AAAA-MM-DD&data_fim=AAAA-MM-DD` — intervalo explícito, tem
  prioridade sobre `periodo` se os dois forem enviados.

Datas usam o fuso `America/Manaus`.

**Importante:** "concluídos" é sempre contado pelo **histórico** (ação
`CONCLUSAO`), não pelo status atual do protocolo — assim a produtividade não
some se o protocolo for reaberto ou reatribuído depois de concluído.

## Rotas

### `GET /api/produtividade/registradores`

Lista de referência (id, nome, email, setor, ativo). Sem filtro de período.

```json
[
  { "id": 12, "nome": "Bruno Leonardo", "email": "bruno.leonardo@...", "setor": "Registro", "ativo": true }
]
```

### `GET /api/produtividade/resumo`

Totais por registrador no período. Aceita `periodo`/`data_inicio`+`data_fim` e
`registrador_id` (opcional, filtra um só).

```
GET /api/produtividade/resumo?periodo=semana
GET /api/produtividade/resumo?data_inicio=2026-08-01&data_fim=2026-08-31&registrador_id=12
```

```json
{
  "periodo": { "tipo": "semana" },
  "registradores": [
    {
      "id": 12,
      "nome": "Bruno Leonardo",
      "email": "bruno.leonardo@...",
      "setor": "Registro",
      "concluidos": 18,
      "tempo_medio_dias": 3.2,
      "em_andamento_atual": 6,
      "atrasados_atual": 1
    }
  ]
}
```

`em_andamento_atual` e `atrasados_atual` são um **retrato de agora** (não são
limitados pelo período pedido — "atrasado" só faz sentido em relação a hoje).

### `GET /api/produtividade/serie`

Conclusões agrupadas por dia/semana/mês, por registrador — para gráficos de
tendência. Aceita `agrupar_por=dia|semana|mes` (padrão `dia`), mais
`periodo`/`data_inicio`+`data_fim` e `registrador_id`.

```
GET /api/produtividade/serie?periodo=mes&agrupar_por=dia&registrador_id=12
```

```json
{
  "agrupado_por": "dia",
  "periodo": { "tipo": "mes" },
  "serie": [
    { "periodo_inicio": "2026-08-01", "registrador_id": 12, "registrador_nome": "Bruno Leonardo", "concluidos": 3 },
    { "periodo_inicio": "2026-08-02", "registrador_id": 12, "registrador_nome": "Bruno Leonardo", "concluidos": 5 }
  ]
}
```

### `GET /api/produtividade/detalhe`

Lista granular — uma linha por protocolo concluído no período. Paginação via
`limit` (padrão 200, máximo 1000) e `offset`.

```
GET /api/produtividade/detalhe?periodo=hoje&registrador_id=12&limit=50
```

```json
{
  "periodo": { "tipo": "hoje" },
  "limit": 50,
  "offset": 0,
  "total_retornado": 3,
  "itens": [
    {
      "historico_id": 4821,
      "concluido_em": "2026-08-25T14:32:10.000Z",
      "protocolo_id": 168461,
      "numero": "168461",
      "data_entrada": "2026-07-23",
      "data_vencimento": "2026-08-06",
      "servico_nome": "Registro de Imóvel",
      "registrador_id": 12,
      "registrador_nome": "Bruno Leonardo",
      "registrador_setor": "Registro",
      "dias_para_concluir": 8
    }
  ]
}
```

### `GET /api/produtividade/atrasados`

Protocolos em andamento e vencidos **agora** (sempre relativo a hoje — não usa
`periodo`). Aceita `registrador_id` opcional.

```
GET /api/produtividade/atrasados?registrador_id=12
```

```json
{
  "total": 2,
  "atualizado_em": "2026-08-25T18:40:00.000Z",
  "itens": [
    {
      "protocolo_id": 168040,
      "numero": "168040",
      "data_entrada": "2026-07-22",
      "data_vencimento": "2026-08-05",
      "dias_atrasado": 20,
      "servico_nome": "Registro de Imóvel",
      "registrador_id": 12,
      "registrador_nome": "Bruno Leonardo",
      "registrador_setor": "Registro"
    }
  ]
}
```

## Onde muda

Código-fonte em `backend/routes/produtividade.js` e `backend/middleware/apiKey.js`
(middleware de autenticação, compartilhado com `backend/routes/painel.js`).
