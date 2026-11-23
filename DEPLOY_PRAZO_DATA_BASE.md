# Deploy - Prazo do serviço conta da puxada/distribuição

Correção: o prazo de um serviço passava a contar da **data de entrada** do
protocolo (ex.: entrou 13/11, Raquel puxou 17/11, serviço de 3 dias úteis
vencia 18/11). Agora conta da **data em que o protocolo é puxado da fila ou
distribuído** para executar aquele serviço, e o **dia da puxada NÃO conta**: a contagem
começa no dia útil seguinte (puxado quarta 18/11, 3 dias úteis = 19, 23 e 24 -> vence 24/11,
pulando o feriado de 20/11 e o fim de semana).

> **Histórico da regra (importante para quem for ler os eventos antigos):** de 17 a 23/11/2026
> vigorou a regra inversa (o dia da puxada contava como dia 1, 17+3 úteis = 19/11), por pedido
> feito em 17/11. Em 23/11 o Michael mostrou o protocolo 224947 e confirmou que o certo é contar
> a partir do dia seguinte. Os vencimentos gravados nesse intervalo foram revertidos pelo script
> (classe `corrigir_contagem_dia_base`); no histórico dos protocolos há eventos `RECALCULO_PRAZO`
> de ida e de volta.

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
- [x] Testado na interface no Docker local (puxar na Fila -> vencimento do caso do 224854).
- [x] Simulação **somente leitura** em produção em 17/11/2026 (nada foi gravado; ver seção 4).

### Implantado em produção em 17/11/2026 (servidor do 1º Ofício)

- [x] 1. Backup: `~/backups_cartorio/backup_20261117_102624_antes_prazo.sql` (8,7 MB, 15 tabelas,
      7.584 protocolos; cópia na máquina do Michael) + tags de rollback `:rollback-prazo`
      nas imagens backend e frontend + commit anterior em `commit_antes_prazo.txt`.
- [x] 2. Migration 009 aplicada (coluna `prazo_base_data`, 0 registros preenchidos).
- [x] 3. `git pull` (merge `e92759e`, sem conflito, personalizações do 1º Ofício preservadas)
      e rebuild **só do backend**. Frontend não mudou.
- [x] 4. Verificação: backend sem erros no log, frontend HTTP 200, API 401 sem token,
      testes unitários passando dentro do container de produção (Node 18).
      Não foi feito teste autenticado em produção (sem criar protocolo de teste lá):
      **conferir com um usuário real** na primeira puxada do dia (seção 6).
- [x] 5. Simulação do recálculo (somente leitura): 913 em andamento, 669 sem prazo,
      **176 mudam de vencimento** (27 já vencidos pelo valor atual), 17 só registram a
      data-base, 46 para análise manual. CSV no servidor:
      `~/backups_cartorio/sim_pos_deploy_20261117.csv`.

### Ainda NÃO feito em produção

- [ ] 6. **Aplicar o recálculo dos protocolos antigos** - só com autorização explícita do
      Michael (seção 5). Muda os KPIs de "atrasados" retroativamente. Faça um novo backup
      antes, lotes de 50.
      Protocolos puxados a partir do deploy já nascem corretos e não entram no recálculo.
- [x] 6a. **Protocolo 224854 corrigido em 17/11/2026** (autorizado pelo Michael como teste): primeiro
      gravado 23/11 (sistema ainda não contava o dia da puxada), depois ajustado para **19/11**
      (17, 18 e 19) com a regra nova. Backups: `backup_20261117_103102_antes_recalculo_224854.sql` e
      `backup_20261117_104908_antes_contagem_dia_base.sql` (em `~/backups_cartorio/`). Dois eventos
      `RECALCULO_PRAZO` no histórico guardam os valores anteriores.
- [x] 6a2. Regra "dia-base conta como dia 1" implantada no backend de produção (commit `e6d0905`).
- [x] 6b+6c. **Recálculo geral aplicado em 17/11/2026** (autorizado pelo Michael), com backup antes
      (`backup_20261117_110848_antes_recalculo_geral.sql`): 8 protocolos puxados pelo código
      intermediário (25/11 -> 24/11) + 187 antigos em 4 lotes de 50 (34 mudaram de vencimento, 153
      só registraram a data-base). 0 pulados. Total: 196 protocolos / 197 eventos `RECALCULO_PRAZO`.
      Valores anteriores: CSVs `etapa1_20261117.csv` e `etapa2_antes_20261117.csv` em
      `~/backups_cartorio/` do servidor, e o evento no histórico de cada protocolo. Simulação final:
      0 protocolos a corrigir.
- [x] 7. Concluído em 17/11/2026 (ver 6a, 6b e 6c).

**Sobraram sem recálculo, de propósito (decidir caso a caso com o Michael):** 45 protocolos de
análise manual (43 cuja última movimentação do histórico — edição ou serviço adicionado — pode
ter alterado o prazo depois da puxada, e 2 puxados sem serviço no evento, sem prova de que foi
puxada da fila) e 4 que vieram de reabertura, Arquivo ou nunca foram puxados (gravados com a
contagem antiga a partir de "hoje"/entrada, podem estar 1 dia útil à frente). Listados na coluna
`classe` do CSV `etapa2_antes_20261117.csv`.

### Outros cartórios

**6RI (VPS, `/opt/sistema-cartorio`) - implantado em 17/11/2026, recálculo NÃO aplicado.**
Compartilha o servidor com outras aplicações (Traefik, n8n, Evolution, Portainer, Sisconf): só o
`cartorio-backend` foi recriado (`docker compose build backend` + `up -d --no-deps backend`), nada mais.
O frontend **não** foi reconstruído (memória apertada; ele não é necessário para esta correção).
- [x] Backup `backup_6ri_20261117_112320_antes_prazo.sql` (`/root/backups_cartorio/`), tag
      `sistema-cartorio-backend:rollback-prazo`.
- [x] Migration 009 aplicada (1.891 protocolos, coluna vazia). Merge `9b3caff` sem conflito.
- [x] Backend no ar, site público 200, API 401 sem token, testes unitários OK no container.
- [x] Simulação (CSV `sim_6ri_antes_20261117.csv`): 932 em andamento -> **404 mudam de vencimento**
      (348 já vencidos hoje; **148 deixariam de estar vencidos**, 200 continuariam, só menos
      atrasados; deslocamento de -1 a +178 dias porque há fila parada desde maio), 84 só registram
      a data-base, 95 sem prazo, 17 análise manual e **331 sem serviço no evento** (puxadas sem
      escolher serviço; sem prova de origem, não corrigíveis automaticamente).
- [x] **Recálculo dos recentes no 6RI aplicado em 17/11/2026** (autorizado): puxados desde 11/11
      (`--desde 2026-11-11`), 187 protocolos em 4 lotes de 50 (141 mudaram de vencimento, 46 só
      registraram a data-base), 0 pulados; 89 deles apareciam como vencidos e nenhum aparece agora.
      Backup antes: `backup_6ri_20261117_113748_antes_recalculo_recentes.sql`; valores anteriores em
      `recentes_antes_20261117.csv` (`/root/backups_cartorio/`) e no evento `RECALCULO_PRAZO`.
      Rollback do backend: `sistema-cartorio-backend:rollback-desde`.
- [ ] **Falta no 6RI (não autorizado):** 263 protocolos que mudam de vencimento (259 já vencidos
      hoje) + 36 que só registram a data-base, todos puxados antes de 11/11. Comando, por lotes:
      `docker exec cartorio-backend node scripts/recalcular-prazos-puxada.js --apply --limite 50`
      (backup novo antes).
- [ ] Decidir os 331 "puxada sem serviço no evento" (maioria Registro de Imóvel).
- [ ] Pendências do 6RI fora desta correção: faltam feriados de 2027; a tabela `protocolo_sessoes`
      não existe no banco (Iniciar/Pausar sessão devem dar erro 500); o fuso do servidor é -03 e o
      código usa America/Manaus fixo (confirmar o fuso do 6RI); frontend ainda no código antigo
      (não mostra "criado por" na Fila).

**4RI (VPS Hostinger, `/opt/sistema-cartorio`, `4rimanaus.aguia.net.br`) - diagnosticado em 17/11/2026, NADA alterado.**
VPS só com o cartório + Traefik, fuso UTC (cartório em Manaus: fuso do código correto), 3 GB de memória livre
e disco vazio (dá para reconstruir o frontend). Mesmo código dos outros (merge de 25/09, sem alteração local),
`git pull` sem conflito (13 commits), banco sem `prazo_base_data`.
- Banco: 314 em andamento (só 30 vencidos), 73 aguardando (o mais antigo é de 21/08/2024), 4.013 puxadas com
  serviço no histórico. Sem `protocolo_sessoes` e sem feriados de 2027 (como no 6RI).
- Simulação (sem gravar; CSV `sim_4ri_antes_20261117.csv`): **47 mudam de vencimento** (11 já vencidos,
  deslocamento -1 a +24 dias; todos puxados nos últimos 30 dias, 45 nos últimos 7), **39 só registram a
  data-base**, 77 sem prazo, 25+3 de reabertura/Arquivo/nunca puxados (contagem antiga), e para análise
  manual **91** (90 tiveram "adicionar serviço" depois da puxada) + **32** com vencimento vazio apesar do
  serviço ter prazo.
- [x] **4RI implantado em 17/11/2026** (só o `cartorio-backend` foi recriado): backup
      `backup_4ri_20261117_114526_antes_prazo.sql` (`/root/backups_cartorio/`, 4 MB), tag
      `sistema-cartorio-backend:rollback-prazo`, migration 009 (2.598 protocolos, coluna vazia),
      merge `8b41e6b`, site público 200, API 401 sem token, testes unitários OK no container.
      Frontend não reconstruído. Simulação pós-deploy: `antes_recalculo_20261117.csv`.
- [x] **Recálculo do 4RI aplicado em 17/11/2026** (autorizado): 86 protocolos em 2 lotes (50 + 36), 0 pulados
      (47 mudaram de vencimento, 39 só registraram a data-base). Backup antes:
      `backup_4ri_20261117_114834_antes_recalculo.sql`; valores anteriores em `antes_recalculo_20261117.csv`
      (`/root/backups_cartorio/`) e no evento `RECALCULO_PRAZO`. Vencidos em andamento: 30 -> 21.
      Ficam de propósito: 91 com movimentação posterior (90 "adicionar serviço"), 32 com vencimento
      vazio, 28 de reabertura/Arquivo/nunca puxados.
- [ ] Melhoria possível do script (não feita): corrigir também as reaberturas e transferências para o
      Arquivo (o evento dá a data exata e o vencimento gravado é o da contagem antiga a partir dela):
      4RI 25+, 1RI 3, e avaliar os 32 "vencimento vazio".

### Pendências de decisão / trabalho futuro (precisam do Michael)

- [ ] **DECISÃO ABERTA - contagem do dia da puxada (23/11/2026).** Em 17/11 o Michael definiu que o dia
      da puxada conta como dia 1 (puxado 17/11, 3 úteis = 17, 18, 19). Em 23/11 ele mostrou o protocolo
      224947 (1RI), puxado em 18/11, e esperava vencer em **24/11**, contando a partir do dia
      seguinte (19, 23, 24, pulando o feriado do dia 20), o oposto da regra de 17/11. O sistema hoje
      grava 23/11 (18, 19, 23). **Não alterar a regra sem a confirmação do Michael:** inverter exige
      mudar `calcularVencimento` (padrão `contarDiaBase`) e refazer o recálculo nos 3 cartórios
      (1RI, 4RI e 6RI), com backup antes. Ver a pergunta registrada na conversa.
- [x] **Frontend marcava "VENCIDO" um dia antes em Manaus** - corrigido em 23/11/2026 (commit
      `3586652`, `frontend/src/utils/datas.js`): protocolo que vence hoje mostra "HOJE" e só vira
      vencido no dia seguinte. **Implantado só no 1RI** (backup `backup_20261123_092124_antes_fix_vencido.sql`,
      tag `rollback-vencido`, rebuild só do frontend). **4RI e 6RI ainda com o frontend antigo**
      (continuam mostrando VENCIDO um dia antes): rebuild do frontend pendente em cada um
      (6RI: memória apertada, avaliar antes).
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

**Convenção de contagem (confirmada pelo Michael em 23/11/2026, vale para TODOS os prazos):**
o dia em que o prazo começa (puxada, distribuição, reabertura, criação) **não conta**; o
dia 1 é o dia útil seguinte. Em prazo "úteis" pulam-se sábado,
domingo e as datas da tabela `feriados`; em "corridos" todos os dias contam; o vencimento é uma data (só fica
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

Simulação feita em produção em 17/11/2026 ANTES da regra do dia-base (913 protocolos
em andamento): 669 são de serviços sem prazo; 176 mudavam de vencimento; 17 só
registravam a data-base; 46 ficam para análise manual. **Os números mudam com a regra
nova** (revertida em 23/11 para o dia seguinte): rode a simulação de novo e use o resumo atual.

## 5. Aplicar a correção (decisão do cartório)

Corrigir muda KPIs de "atrasados"/produtividade retroativamente, então aplique
de forma gradual e só depois de revisar o CSV:

```bash
docker compose exec backend node scripts/recalcular-prazos-puxada.js --apply --classe corrigir_contagem_dia_base
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
