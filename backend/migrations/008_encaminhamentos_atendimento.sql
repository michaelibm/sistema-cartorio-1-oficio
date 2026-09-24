-- Fluxo "Enviar para Atendimento": um protocolo Concluído pode ser encaminhado
-- ao setor de Atendimento (Orçamento ou Nota Devolutiva, com indicação de ONR),
-- fica "Pendente de Devolução" até o Atendimento marcar como concluído.
--
-- NÃO usa protocolos.status pra isso (esse campo só aceita os 5 códigos
-- internos fixos - já corrigimos um bug grave de gravar rótulo customizado
-- ali). O status pendente/concluído fica isolado nesta tabela, igual o padrão
-- já usado em protocolo_notas/protocolo_servicos (tabela filha por protocolo).
--
-- Execute manualmente no banco já existente:
--   psql -U postgres -d cartorio_db -f backend/migrations/008_encaminhamentos_atendimento.sql
-- ou, via docker:
--   cat backend/migrations/008_encaminhamentos_atendimento.sql | docker exec -i cartorio-db psql -U postgres -d cartorio_db
--
-- Idempotente: pode ser executado mais de uma vez sem erro.

CREATE TABLE IF NOT EXISTS protocolo_encaminhamentos_atendimento (
    id serial PRIMARY KEY,
    protocolo_id integer NOT NULL REFERENCES protocolos(id) ON DELETE CASCADE,
    tipo varchar(30) NOT NULL CHECK (tipo IN ('orcamento', 'nota_devolutiva')),
    onr boolean NOT NULL DEFAULT false,
    enviado_por_id integer REFERENCES usuarios(id),
    setor_origem varchar(100),
    enviado_em timestamp NOT NULL DEFAULT NOW(),
    status varchar(20) NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'concluido')),
    concluido_por_id integer REFERENCES usuarios(id),
    concluido_em timestamp,
    created_at timestamp NOT NULL DEFAULT NOW(),
    updated_at timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encaminhamentos_protocolo ON protocolo_encaminhamentos_atendimento(protocolo_id);
CREATE INDEX IF NOT EXISTS idx_encaminhamentos_status ON protocolo_encaminhamentos_atendimento(status);
