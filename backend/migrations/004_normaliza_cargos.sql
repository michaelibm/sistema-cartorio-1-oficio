-- Corrige o cadastro de funcionários: o formulário salvava "Auxiliar" para
-- Registrador e "Escrevente" para Coordenador (apelidos antigos), mas as
-- checagens de permissão do sistema (backend/routes/protocolos.js e outros)
-- comparam com os nomes atuais ("Registrador"/"Coordenador"). Por isso um
-- registrador recém-cadastrado nunca recebia as permissões corretas.
--
-- Esta migração converte de uma vez os usuários já cadastrados com os
-- valores antigos. O formulário de cadastro já foi corrigido para salvar
-- o valor certo daqui pra frente.
--
-- Execute manualmente no banco já existente:
--   psql -U postgres -d cartorio_db -f backend/migrations/004_normaliza_cargos.sql
-- ou, via docker:
--   cat backend/migrations/004_normaliza_cargos.sql | docker exec -i cartorio-db psql -U postgres -d cartorio_db
--
-- Idempotente: pode ser executado mais de uma vez sem erro.

UPDATE usuarios SET cargo = 'Registrador' WHERE cargo = 'Auxiliar';
UPDATE usuarios SET cargo = 'Coordenador' WHERE cargo = 'Escrevente';

-- Trava esses 4 valores daqui pra frente, pra esse tipo de divergência
-- entre cadastro e permissões nunca mais acontecer silenciosamente.
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_cargo_check;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_cargo_check
    CHECK (cargo IN ('Supervisor', 'Coordenador', 'Registrador', 'Atendente'));
