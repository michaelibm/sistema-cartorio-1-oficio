# Deploy - Prazo do serviço conta da puxada/distribuição

Correção: o prazo de um serviço passava a contar da **data de entrada** do
protocolo (ex.: entrou 13/11, Raquel puxou 17/11, serviço de 3 dias úteis
vencia 18/11). Agora conta da **data em que o protocolo é puxado da fila ou
distribuído** para executar aquele serviço (17/11 -> vence 23/11, pulando o
feriado de 20/11 e o fim de semana).

> Este arquivo é o guia vivo desta mudança; atualize-o em vez de criar outro.
> **Esta mudança TEM migration** (`009_prazo_base_data.sql`) e ela deve ser
> aplicada **antes** de subir o backend novo.

## HANDOFF - status e o que falta (leia primeiro)

**Regra de ouro do Michael: antes de QUALQUER alteração em produção (migration,
rebuild, recálculo), faça backup do banco e confirme que o arquivo está
completo.** Os comandos estão na seção 1. Nunca pule, mesmo que já exista um
backup de dias atrás.

### Já feito (código no git, validado fora de produção)

- [x] Regra central do prazo, rotas de puxada/distribuição/edição corrigidas.
- [x] Migration `009_prazo_base_data.sql` escrita (idempotente) e `init.sql` x2 sincronizados.
- [x] Script de recálculo com simulação (`backend/scripts/recalcular-prazos-puxada.js`).
- [x] Testes: `cd backend && npm test` (unitários) e, com banco de DESENVOLVIMENTO,
      `RUN_DB_TESTS=1 DB_HOST=localhost DB_PASSWORD=<senha> npm test` (30 testes, todos passando).
- [x] Testado na interface no Docker local (puxar na Fila -> vencimento 23/11 no caso do 224854).
- [x] Simulação **somente leitura** em produção em 17/11/2026 (nada foi gravado; ver seção 4).

### NÃO feito - nada disso foi executado em produção

Produção (192.168.0.95) ainda roda o código **anterior** a esta correção e **não
tem** a coluna `prazo_base_data`. Quem for fazer o deploy executa, nesta ordem:

- [ ] 1. Backup do banco + tag de rollback das imagens (seção 1). **Obrigatório.**
- [ ] 2. Aplicar a migration 009 **antes** do código (seção 2).
- [ ] 3. `git pull` + `docker compose up -d --build backend` (seção 3). Frontend não muda.
- [ ] 4. Smoke test (seção 6).
- [ ] 5. Rodar a simulação de novo (seção 4) - os números mudam com o tempo - e
      mostrar o resumo ao Michael.
- [ ] 6. **Só com autorização explícita do Michael**: aplicar o recálculo, gradual
      (seção 5). Corrigir muda os KPIs de "atrasados" retroativamente. Primeiro o
      protocolo 224854 (esperado: 18/11 -> 23/11), depois lotes.
- [ ] 7. Atualizar o changelog deste arquivo com o commit implantado e a data.

### Pendências de decisão / trabalho futuro (precisam do Michael)

- [ ] **Frontend marca "VENCIDO" um dia antes em Manaus** (detalhes em "Pontos em
      aberto"). Correção sugerida: tratar só `YYYY-MM-DD` como data local, em 14
      pontos de `Protocolos.jsx` e `Dashboard.jsx`. Não foi feita porque é uma
      mudança de exibição separada; pedir aprovação. Exige rebuild do frontend.
- [ ] Redistribuir protocolo já em andamento no mesmo serviço **não** renova o
      prazo (decisão tomada por falta de regra definida). Confirmar com o cartório.
- [ ] Corrigir a lacuna de schema (`protocolo_sessoes`, `tem_orcamento`,
      `orcamento_valor`, `orcamento_pago`, `prioridade` não estão em migrations nem
      `init.sql`): uma migration `IF NOT EXISTS` à parte. Em produção já existem.
- [ ] Consultas do backend com `CURRENT_DATE` (alertas, painel, relatórios) usam o
      dia UTC: das 20h à meia-noite de Manaus consideram o dia seguinte.
- [ ] 46 protocolos ficam para análise manual no recálculo (sem evidência
      suficiente no histórico); decidir caso a caso com o Michael.

### Acesso ao servidor

Servidor 192.168.0.95, usuário `user`, projeto em `~/sistema-cartorio-1-oficio`
(Docker Compose). A senha **não** está no repositório: peça ao Michael. O servidor
tem um commit local de personalizações do 1º Ofício, por isso o `git pull` é
sempre merge (comando na seção 3); confira antes com
`git merge-tree --write-tree HEAD origin/main` que não há conflito.

## Regra implementada

Código central: [backend/services/prazo-service.js](backend/services/prazo-service.js).

| Situação | Data-base do prazo |
|---|---|
| Puxada da fila (`POST /protocolos/:id/transferir`) | dia da puxada (America/Manaus) |
| Distribuição (mesma rota, ou edição que tira o protocolo de "aguardando") | dia da distribuição |
| Protocolo concluído que volta a andamento (reabertura) | dia da reabertura |
| Serviço do protocolo muda enquanto está em andamento (serviços sucessivos) | dia da mudança (nova execução) |
| Troca **só de responsável** em andamento, mesmo serviço | **não muda** (prazo continua) |
| Requisição repetida / duplo clique / abrir / "Iniciar" sessão / editar observações | **não muda** |
| Criação direta de protocolo (Protocolos > Novo) | a própria data de entrada |
| Transferência para o Arquivo, adicionar serviço com renovação | hoje (como já era), agora no dia de Manaus |

`protocolos.data_entrada` continua sendo o recebimento original e **nunca** é
alterada pela puxada/distribuição. `protocolos.data_vencimento` continua sendo
a única data que telas, filtros, relatórios e alertas leem. A nova coluna
`protocolos.prazo_base_data` registra de onde o vencimento da execução atual
foi calculado (`NULL` = registro antigo, data-base não registrada).

**Convenção de contagem (inalterada):** o dia-base não conta, a contagem começa
no dia seguinte; em prazo "úteis" pulam-se sábado, domingo e as datas da tabela
`feriados`; em "corridos" todos os dias contam; o vencimento é uma data (só fica
atrasado quando hoje > vencimento); "sem prazo" não gera vencimento. Não existe
tabela de "suspensões" no sistema: o único calendário é `feriados` (se a
serventia tiver suspensão de expediente, cadastre-a como feriado).

**Ponto de decisão (indefinição documentada):** redistribuir para outro
registrador um protocolo que já está em andamento no mesmo serviço não renova o
prazo. Se o cartório quiser que a redistribuição reinicie o prazo, é uma
mudança de regra em `iniciaNovaExecucao()`.

## Changelog

| O que mudou | Migration |
|---|---|
| `/transferir` (puxada e distribuição) calcula o prazo de hoje, dentro de transação com `FOR UPDATE` (requisições simultâneas/repetidas não reiniciam o prazo) | **009** |
| `PUT /protocolos/:id` deixa de recalcular o vencimento a partir da entrada a cada edição (o modal envia sempre servico_id e data_entrada) | 009 |
| Arquivo, reabertura e adicionar-serviço usam o dia de Manaus (antes: dia UTC, que vira às 20h locais) e gravam a data-base | 009 |
| Script de recálculo dos protocolos já afetados (simulação por padrão) | - |

## 1. Backup (obrigatório)

```bash
docker compose exec -T postgres pg_dump -U postgres cartorio_db > ~/backups_cartorio/backup_$(date +%Y%m%d_%H%M%S)_antes_prazo.sql
docker tag sistema-cartorio-1-oficio-backend:latest sistema-cartorio-1-oficio-backend:rollback-prazo
docker tag sistema-cartorio-1-oficio-frontend:latest sistema-cartorio-1-oficio-frontend:rollback-prazo
```

## 2. Migration ANTES do código

```bash
cat backend/migrations/009_prazo_base_data.sql | docker compose exec -T postgres psql -U postgres -d cartorio_db
```

Só adiciona uma coluna nula; o backend antigo continua funcionando com ela.
Se o backend novo subir sem a coluna, puxar/distribuir devolve erro 500
(`column "prazo_base_data" does not exist`).

## 3. Atualizar e subir

```bash
git -c user.name=DeployLocal -c user.email=deploy@1rimanaus pull --no-rebase --no-edit origin main
docker compose up -d --build backend
```

O frontend **não** mudou nesta correção (não precisa rebuild).

## 4. Simulação dos registros existentes (não grava nada)

```bash
docker compose exec backend node scripts/recalcular-prazos-puxada.js
docker compose exec backend node scripts/recalcular-prazos-puxada.js --numero 224854
```

Gera `recalculo-prazos-<data-hora>.csv` dentro do container com protocolo,
serviço, data da puxada, vencimento atual e vencimento recalculado, e imprime o
resumo por classe. Só é "corrigir" quando: a última movimentação do histórico é
a puxada, o texto dela nomeia o serviço atual e o vencimento gravado é exatamente
o que o cálculo antigo (pela entrada) produziria. O resto é sinalizado para
análise e **não** é alterado. Copie o CSV para fora do container
(`docker compose cp backend:/app/recalculo-prazos-....csv .`) antes de aplicar:
ele é o registro dos valores anteriores.

Simulação feita em produção em 17/11/2026 (908 protocolos em andamento): 670
são de serviços sem prazo (nada a fazer), **170 mudam de vencimento**
(27 deles aparecem hoje como vencidos; 16 deixariam de estar vencidos), 17 só
registram a data-base, 43 + 3 ficam para análise manual.

## 5. Aplicar a correção (decisão do cartório)

Corrigir muda KPIs de "atrasados"/produtividade retroativamente, então aplique
de forma gradual e só depois de revisar o CSV:

```bash
docker compose exec backend node scripts/recalcular-prazos-puxada.js --numero 224854 --apply
docker compose exec backend node scripts/recalcular-prazos-puxada.js --apply --limite 50
docker compose exec backend node scripts/recalcular-prazos-puxada.js --apply
```

Cada linha só é alterada se o vencimento no banco ainda for o simulado; cada
correção gera um evento `RECALCULO_PRAZO` no histórico do protocolo com o valor
anterior. Rodar de novo não repete nada (a data-base passa a estar registrada).

## 6. Smoke test

1. Backend: `docker compose logs --tail 50 backend` sem `does not exist`.
2. Um protocolo "aguardando" na Fila: Puxar, escolher serviço de prazo conhecido.
   O vencimento deve ser (dia de hoje + prazo, pulando fim de semana/feriados),
   e a data de entrada não pode mudar.
3. Editar só as observações de um protocolo puxado: o vencimento não pode mudar.
4. Clicar "Iniciar" num protocolo distribuído: o vencimento não pode mudar.

## Rollback

```bash
docker tag sistema-cartorio-1-oficio-backend:rollback-prazo sistema-cartorio-1-oficio-backend:latest
docker compose up -d backend
```

A coluna `prazo_base_data` pode ficar (é inofensiva). Se aplicou o recálculo, os
valores anteriores estão no CSV e nos eventos `RECALCULO_PRAZO`.

## Testes

```bash
cd backend
npm test                                                           # unitários (sem banco)
RUN_DB_TESTS=1 DB_HOST=localhost DB_PASSWORD=<senha> npm test      # + integração (banco de DESENVOLVIMENTO)
```

Os testes de integração criam/removem protocolos `TESTE-*` e recusam rodar se
`DB_HOST` não for localhost. Eles também criam, se faltarem, a tabela
`protocolo_sessoes` e as colunas `tem_orcamento`, `orcamento_valor`,
`orcamento_pago` e `prioridade` de `protocolos`, que existem em produção mas não
estão em nenhuma migration/init.sql do repositório (lacuna antiga; ver abaixo).

## Pontos em aberto (não fazem parte desta correção)

- **Frontend marca "VENCIDO" um dia antes em Manaus.** O backend envia
  `"2026-11-17T00:00:00.000Z"` e `new Date(...)` no navegador de Manaus lê
  16/11 20h. Um protocolo que vence hoje aparece como "⚠️ VENCIDO" em
  Protocolos (cor da linha, filtro "Vencidos", coluna Vencimento) e o Dashboard
  mostra a data um dia antes. Os alertas/KPIs do backend dizem que ainda não
  venceu. Verificado na tela em 17/11/2026. Correção sugerida: interpretar só
  `YYYY-MM-DD` como data local (14 pontos em `Protocolos.jsx` e `Dashboard.jsx`).
- Consultas do backend que usam `CURRENT_DATE` (alertas, painel, relatórios) usam
  o dia UTC do banco: das 20h à meia-noite de Manaus consideram o dia seguinte.
- Lacuna de schema: `protocolo_sessoes` e as colunas `tem_orcamento`,
  `orcamento_valor`, `orcamento_pago`, `prioridade` existem em produção mas não
  em `init.sql`/migrations - uma instalação nova pelo `init.sql` ficaria sem elas.
- `reabrir` (Balcão) continua definindo `data_entrada = hoje` ao reabrir; não
  foi alterado.
