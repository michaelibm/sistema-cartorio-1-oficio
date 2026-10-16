# Águia 5.0 - Guia para o agente

Este arquivo é para quem (humano ou IA) está pegando este projeto pela
primeira vez numa máquina nova. Leia antes de mexer em qualquer coisa.

## O que é o sistema

Sistema de gestão de produtividade e controle de protocolos para o
Cartório 1º Ofício de Imóveis de Manaus (em uso em produção, não é
protótipo). Veja [README.md](README.md) para a visão funcional completa e
[APRESENTACAO_SISTEMA.md](APRESENTACAO_SISTEMA.md) para um resumo de alto
nível de todos os módulos.

- **Repositório:** `https://github.com/michaelibm/sistema-cartorio-1-oficio.git`
  (branch principal: `main`).
- **Stack:** backend Node.js/Express + PostgreSQL (JWT + bcrypt); frontend
  React (CRA) + React Router; tudo containerizado com Docker Compose.
- **Deploy real:** múltiplos servidores físicos, um por cartório, cada um
  rodando sua própria stack Docker (backend, frontend, postgres) a partir
  deste mesmo repositório.

## Rodando local (Docker - forma recomendada)

```bash
cp .env.example .env     # editar com os valores reais antes de subir
docker compose up -d --build
```

- Frontend: `http://localhost:3001` (ou a porta configurada no `.env`)
- Backend: `http://localhost:5000/api`
- Containers: `cartorio-db` (Postgres), `cartorio-backend`, `cartorio-frontend`
- **Backend e frontend NÃO têm volume montado com o host** - qualquer
  mudança de código exige `docker compose up -d --build <serviço>`, só
  `restart` não pega código novo.
- O Postgres usa um volume nomeado (`postgres_data`). O `init.sql` só roda
  sozinho em volume **vazio**. Se o volume já existe de uma instalação
  anterior, as migrations precisam ser aplicadas manualmente (ver abaixo).

Sem Docker: `backend/` com `npm install && npm run dev`, `frontend/` com
`npm install && npm start`. Detalhes em [README.md](README.md) e
[README-DOCKER.md](README-DOCKER.md).

## Regra crítica: `protocolos.status`

A coluna `protocolos.status` só pode conter um destes 5 valores fixos:
`aguardando`, `andamento`, `concluido`, `concluido_parcial`, `cancelado`.
**Nunca** escrever um label livre/custom nessa coluna - isso já causou
dois incidentes graves em produção (149 protocolos corrompidos ao todo).
Qualquer novo "sub-status" ou "situação" precisa de uma coluna ou tabela
própria (veja o padrão em `situacao` e em
`protocolo_encaminhamentos_atendimento`, que tem seu próprio `status`
interno `pendente`/`concluido`, desacoplado de `protocolos.status`).

## Migrations

- Ficam em `backend/migrations/*.sql`, numeradas sequencialmente.
- **Não existe runner automático.** Cada arquivo precisa ser aplicado à
  mão em cada servidor:
  ```bash
  cat backend/migrations/00X_nome.sql | docker compose exec -T postgres psql -U postgres -d cartorio_db
  ```
- Sempre escritas de forma idempotente (`ADD COLUMN IF NOT EXISTS`,
  `CREATE TABLE IF NOT EXISTS`, `DROP CONSTRAINT IF EXISTS` + recriar) -
  então é seguro rodar todas de novo mesmo que algumas já tenham sido
  aplicadas.
- `init.sql` (raiz) e `backend/config/init.sql` precisam ser mantidos em
  sincronia com as migrations - são o schema completo para instalação
  nova. Toda migration nova também vira um bloco equivalente nesses dois
  arquivos.
- **Toda mudança de schema precisa ser sinalizada claramente** na mensagem
  de commit (qual migration, se precisa rodar manualmente) e para o
  usuário (comando exato para aplicar). Isso já causou bugs confusos antes
  (`column "..." does not exist` em servidor onde o código foi atualizado
  mas a migration não).
- Bug conhecido e **ainda não corrigido**: `orcamento_valor` existe no
  `init.sql` mas nunca teve migration numerada - bancos antigos podem não
  ter essa coluna e dar 500 em `GET /api/protocolos/dashboard/stats`.

## Deploy em produção

Para a feature mais recente (Enviar para Atendimento / Devolução), siga
[DEPLOY_ATENDIMENTO.md](DEPLOY_ATENDIMENTO.md) - backup, `git pull`,
aplicar migrations pendentes, rebuild, smoke test. **Esse arquivo é
atualizado a cada mudança relacionada a essa feature (tem uma tabela de
changelog no topo) - não criar um `.md` novo a cada ajuste, editar o
existente.** Se uma feature nova e não relacionada precisar de guia de
deploy próprio, aí sim cria um arquivo novo.

## Git neste projeto

- Commits: mensagens em português, sem aspas duplas literais dentro do
  texto (dependendo do shell/terminal da máquina, aspas dentro da
  mensagem podem quebrar o comando) - use heredoc para mensagens
  multi-linha.
- Nunca commitar `.env` (já está no `.gitignore`).
- Sempre criar commit novo em vez de `--amend`, a não ser que o usuário
  peça explicitamente.

## Contas de teste

Credenciais reais de produção não ficam neste repositório. Em um banco
local recém-populado pelo `init.sql`, o usuário padrão é:
```
Email: admin@cartorio.com
Senha: admin123
Cargo: Supervisor
```
Outros usuários de teste (Registrador, Atendente) variam por ambiente -
confira com `SELECT nome, email, cargo FROM usuarios;` no banco local; se
a senha for desconhecida e for um banco **local de teste** (nunca em
produção), pode-se gerar um novo hash bcrypt (`bcrypt.hash(senha, 10)`,
rodando dentro do container do backend, que já tem a lib) e fazer
`UPDATE usuarios SET senha = '<hash>' WHERE email = '...'` - sempre
confirmando com o usuário antes, é uma escrita destrutiva no banco.

## Documentos existentes neste repositório

- [README.md](README.md) - visão geral funcional, instalação sem Docker, endpoints.
- [README-DOCKER.md](README-DOCKER.md) - guia genérico de Docker.
- [PAINEL_API.md](PAINEL_API.md) - API anônima consumida pela tela de TV e pelo painel externo da Corregedoria.
- [PRODUTIVIDADE_API.md](PRODUTIVIDADE_API.md) - API de produtividade com nome, para integrações externas.
- [DEPLOY_ATENDIMENTO.md](DEPLOY_ATENDIMENTO.md) - guia de deploy vivo da feature Atendimento/Devolução (ver regra acima).
- [APRESENTACAO_SISTEMA.md](APRESENTACAO_SISTEMA.md) - prompt pronto para gerar uma apresentação/slides do sistema em outra IA.
- Este arquivo (`AGENTS.md`) - handoff entre agentes/máquinas.

## Preferências do usuário (Michael Oliveira)

- Sempre sinalizar migrations de banco em commits e para o usuário (ver seção acima).
- Manter um único arquivo de deploy vivo por feature em vez de criar `.md` novo a cada ajuste.
- Evitar ações destrutivas/irreversíveis sem confirmação explícita (reset de senha, `git push --force`, etc.).
- Testar no Docker local antes de considerar algo pronto, usando o skill `browser-automation` quando a mudança é de UI.
