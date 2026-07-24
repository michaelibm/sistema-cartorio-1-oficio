# API do Painel (`/api/painel/dados`)

Endpoint consumido por dois clientes:

- a tela de TV interna de cada cartório (`frontend/src/pages/Painel.jsx`);
- o projeto externo `painel-corregedoria`, que consulta o painel de vários cartórios.

## Requisição

```
GET /api/painel/dados
Header: X-API-Key: <chave>
```

A chave é obrigatória sempre que o cartório tiver uma configurada (veja
[Configurações → Painel Externo (Corregedoria)](frontend/src/pages/Configuracoes.jsx),
ou a variável de ambiente `PAINEL_API_KEY`). Se nenhuma das duas estiver definida, o
endpoint responde sem exigir a chave (comportamento antigo, mantido por compatibilidade).

Sem a chave certa (ou faltando), a resposta é `401`:
```json
{ "message": "API key inválida ou ausente" }
```

## Resposta (200)

```json
{
  "kpis": {
    "concluidos_hoje": 2,
    "concluidos_mes": 2,
    "em_andamento": 0,
    "atrasados": 0,
    "vencendo_hoje": 0,
    "vencendo_3dias": 0,
    "vencendo_7dias": 0,
    "criados_hoje": 2,
    "criados_mes": 2
  },
  "ranking": [
    { "posicao": 1, "concluidos": 1, "total": 1, "taxa": 100 },
    { "posicao": 2, "concluidos": 0, "total": 0, "taxa": 0 }
  ],
  "vencendo": [
    { "numero": "80123", "servico_nome": "Certidão", "data_vencimento": "2026-07-28", "dias_restantes": 4 }
  ],
  "dias_sem_atraso": null,
  "atualizado_em": "2026-07-24T18:25:27.413Z"
}
```

### `kpis`

| Campo | Significado |
|---|---|
| `concluidos_hoje` | Protocolos concluídos com `data_conclusao` = hoje |
| `concluidos_mes` | Protocolos concluídos com `data_entrada` dentro do mês atual |
| `em_andamento` | Protocolos com status `andamento` (= "Protocolos Ativos") |
| `atrasados` | Status `andamento` com `data_vencimento` no passado |
| `vencendo_hoje` | Status `andamento` vencendo hoje |
| `vencendo_3dias` | Status `andamento` vencendo entre hoje e +3 dias |
| `vencendo_7dias` | Status `andamento` vencendo entre hoje e +7 dias |
| `criados_hoje` | Protocolos com `data_entrada` = hoje |
| `criados_mes` | Protocolos com `data_entrada` dentro do mês atual |

### `ranking`

Top 5 registradores do mês, **sem nome** (anônimo por design) — só posição, quantidade
concluída, total de protocolos e taxa de conclusão (%).

### `vencendo`

Até 8 protocolos vencendo nos próximos 7 dias (não identifica o responsável).

### `dias_sem_atraso`

Dias corridos desde o último protocolo concluído com atraso (`null` se nunca houve atraso
registrado, ou se não há dado suficiente pra calcular).

### `atualizado_em`

Timestamp ISO de quando a resposta foi gerada (para exibir "atualizado às…" no cliente).

## Onde muda

O código-fonte deste endpoint está em `backend/routes/painel.js` — se os campos mudarem,
atualize este documento junto.
