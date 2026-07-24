-- Tabela genérica de configurações (chave/valor), usada para a chave de API do
-- painel externo (painel-corregedoria) — gerenciável pela tela de Configurações,
-- sem precisar editar .env nem reiniciar o servidor.
--
-- Execute manualmente no banco já existente:
--   psql -U postgres -d cartorio_db -f backend/migrations/005_configuracoes.sql
-- ou, via docker:
--   cat backend/migrations/005_configuracoes.sql | docker exec -i cartorio-db psql -U postgres -d cartorio_db
--
-- Idempotente: pode ser executado mais de uma vez sem erro.

CREATE TABLE IF NOT EXISTS configuracoes (
    chave varchar(100) PRIMARY KEY,
    valor text,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP
);
