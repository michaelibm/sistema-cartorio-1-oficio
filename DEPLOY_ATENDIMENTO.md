# Deploy - Enviar para Atendimento / Devolução

Guia para atualizar um servidor de produção com a feature "Enviar para
Atendimento" (módulo Protocolo) + "Devolução" (módulo Atendimento).
Execute os passos na ordem, no servidor, dentro da pasta do projeto (onde
está o `docker-compose.yml`).

> Este arquivo é atualizado a cada mudança nesta feature - não crie um
> `.md` novo para cada ajuste, edite este. O changelog abaixo mostra o que
> já está incluído.

## Changelog desta feature

| Commit | O que mudou | Precisa de migration? |
|---|---|---|
| `776f1d9`..`8bbc648` | Enviar para Atendimento + aba Devolução (feature completa) | Sim - `008_encaminhamentos_atendimento.sql` |
| `4530237` | Fix: rotas de Atendimento usavam coluna `p.nome_cliente` (inexistente) causando 500 na lista e na busca por localização | Não |
| `68483f4` | Criação deste guia | - |
| `ecf2278` | Fix: coluna "Ações" da tabela Devolução sumia em telas largas (agora sticky) + badge com contagem de pendentes no menu lateral | Não |

Se o servidor já está atualizado até um desses commits, pule direto para
o próximo `git pull` - as migrations continuam idempotentes e seguras de
rodar de novo mesmo assim.

## 1. Backup antes de qualquer coisa

```bash
docker compose exec postgres pg_dump -U postgres cartorio_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

Se o comando acima falhar por causa do nome do serviço/usuário, confira com:

```bash
docker compose ps
cat .env | grep POSTGRES
```

e ajuste `postgres` / `-U postgres` conforme o `.env` do servidor.

## 2. Atualizar o código

```bash
git status
```

Se houver alterações locais não commitadas, **pare e avise** - não descarte
nada sem confirmar antes.

```bash
git pull origin main
```

## 3. Aplicar as migrations pendentes

Todas as migrations em `backend/migrations/*.sql` são idempotentes (usam
`IF NOT EXISTS` / `DROP ... IF EXISTS` + recriação), então é seguro rodar
todas de novo mesmo que algumas já tenham sido aplicadas antes. Rode nesta
ordem:

```bash
for f in backend/migrations/00{2,3,4,5,6,7,8}_*.sql; do
  echo "== aplicando $f =="
  cat "$f" | docker compose exec -T postgres psql -U postgres -d cartorio_db
done
```

A migration nova desta feature é a **008_encaminhamentos_atendimento.sql**
(cria a tabela `protocolo_encaminhamentos_atendimento`). As demais (002-007)
são de features anteriores; rodá-las de novo não tem efeito se já foram
aplicadas.

### Verificação rápida

```bash
docker compose exec postgres psql -U postgres -d cartorio_db -c "\d protocolo_encaminhamentos_atendimento"
```

Deve listar a tabela com as colunas `id, protocolo_id, tipo, onr,
setor_origem, enviado_por_id, enviado_em, status, concluido_por_id,
concluido_em, created_at, updated_at`.

## 4. Rebuild e restart do backend e frontend

O backend/frontend rodam a partir de imagens construídas do código-fonte
(não há volume montado com o host), então é obrigatório rebuild - só
reiniciar o container NÃO pega o código novo.

```bash
docker compose up -d --build backend frontend
```

## 5. Checar os logs

```bash
docker compose logs --tail 50 backend
```

Não deve haver erros do tipo `column "..." does not exist` logo após o
restart. Se aparecer algum erro de coluna/tabela ausente, é sinal de que
alguma migration não foi aplicada - repita o passo 3.

## 6. Smoke test manual

1. Logar como um usuário `Registrador` ou `Supervisor`.
2. Ir em Protocolos, achar um protocolo com status **Concluído**.
3. Clicar no botão 📨 "Enviar para Atendimento", preencher o modal
   (tipo + ONR opcional) e confirmar. Deve aparecer mensagem de sucesso.
4. Ir em "Devolução" (menu lateral, ↩️) - visível para
   `Atendente`/`Supervisor`/`Coordenador`. O protocolo enviado deve
   aparecer com status "Pendente de Devolução".
5. Clicar em "✓ Marcar como Concluído", confirmar - status deve virar
   "Devolução Concluída" e o registro **não** deve sumir da listagem
   (some só do filtro "Pendente de Devolução", continua em "Todos").
6. Usar a busca "Com quem está o protocolo?" com o número do protocolo -
   deve retornar Protocolo, Status atual, Setor atual, Responsável atual,
   Última movimentação e Origem anterior.
7. Com algum protocolo pendente de devolução, o menu lateral deve mostrar
   um badge vermelho com a quantidade ao lado de "Devolução".
8. Na tabela de "Protocolos Encaminhados", mesmo em telas largas, a coluna
   "Ações" deve continuar visível (fixa à direita) sem precisar rolar.

## Observação - bug pré-existente não relacionado a esta feature

Foi identificado durante o teste local que `GET
/api/protocolos/dashboard/stats` pode retornar 500 com o erro `column
"orcamento_valor" does not exist` em bancos mais antigos, porque essa
coluna está no `init.sql` (instalação nova) mas nunca teve uma migration
numerada para bancos já existentes. **Não é causado por esta atualização**
e não é corrigido por este guia. Se aparecer no `docker compose logs
backend` deste servidor, reporte antes de seguir para outro serviço - a
correção (uma migration `ADD COLUMN IF NOT EXISTS`) deve ser tratada à
parte.
