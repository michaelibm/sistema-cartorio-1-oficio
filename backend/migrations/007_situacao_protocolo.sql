-- Coluna "situacao": etiqueta visual opcional para o protocolo, separada do
-- status interno (aguardando/andamento/concluido/concluido_parcial/cancelado),
-- que continua sendo a unica coisa que a logica do sistema (fila, botoes de
-- acao, prazos) enxerga. Usada inicialmente pela transferencia para o setor
-- Arquivo, marcando o protocolo como "fechamento/digitalização" sem alterar
-- seu status real.
--
-- Execute manualmente no banco já existente:
--   psql -U postgres -d cartorio_db -f backend/migrations/007_situacao_protocolo.sql
-- ou, via docker:
--   cat backend/migrations/007_situacao_protocolo.sql | docker exec -i cartorio-db psql -U postgres -d cartorio_db
--
-- Idempotente: pode ser executado mais de uma vez sem erro.

ALTER TABLE protocolos ADD COLUMN IF NOT EXISTS situacao varchar(100);
