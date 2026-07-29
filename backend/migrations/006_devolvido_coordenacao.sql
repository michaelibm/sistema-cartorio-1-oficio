-- Permite que um registrador "devolva" um protocolo para a coordenação.
-- Guarda quem devolveu e quando, para sinalizar isso na tela de Protocolos
-- (linha laranja + "veio do registrador X"). O flag é limpo automaticamente
-- quando o protocolo é reatribuído (PUT /:id ou /transferir).
--
-- Execute manualmente no banco já existente:
--   psql -U postgres -d cartorio_db -f backend/migrations/006_devolvido_coordenacao.sql
-- ou, via docker:
--   cat backend/migrations/006_devolvido_coordenacao.sql | docker exec -i cartorio-db psql -U postgres -d cartorio_db
--
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TABLE protocolos ADD COLUMN IF NOT EXISTS devolvido_por_id integer REFERENCES usuarios(id);
ALTER TABLE protocolos ADD COLUMN IF NOT EXISTS devolvido_em timestamp;
