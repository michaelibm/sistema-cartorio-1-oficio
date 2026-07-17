-- Script de inicialização do banco de dados PostgreSQL
-- Sistema de Cartório - 1º Ofício de Imóveis de Manaus
-- Schema gerado do pgAdmin 4 + Dados Iniciais

BEGIN;

-- ============================================================
-- TABELAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.feriados
(
    id serial NOT NULL,
    data date NOT NULL,
    descricao character varying(255) COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT feriados_pkey PRIMARY KEY (id),
    CONSTRAINT feriados_data_key UNIQUE (data)
);

CREATE TABLE IF NOT EXISTS public.historico
(
    id serial NOT NULL,
    protocolo_id integer,
    usuario_id integer,
    acao character varying(100) COLLATE pg_catalog."default" NOT NULL,
    descricao text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT historico_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.pgmigrations
(
    id serial NOT NULL,
    name character varying(255) COLLATE pg_catalog."default" NOT NULL,
    run_on timestamp without time zone NOT NULL,
    CONSTRAINT pgmigrations_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.protocolo_historico
(
    id serial NOT NULL,
    protocolo_id integer NOT NULL,
    acao text COLLATE pg_catalog."default" NOT NULL,
    usuario_id integer,
    data timestamp without time zone DEFAULT now(),
    CONSTRAINT protocolo_historico_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.protocolo_notas
(
    id serial NOT NULL,
    protocolo_id integer NOT NULL,
    usuario_id integer NOT NULL,
    nota text COLLATE pg_catalog."default" NOT NULL,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT protocolo_notas_pkey PRIMARY KEY (id)
);

COMMENT ON TABLE public.protocolo_notas
    IS 'Notas adicionadas pelos usuários aos protocolos';

COMMENT ON COLUMN public.protocolo_notas.nota
    IS 'Conteúdo da nota adicionada ao protocolo';

CREATE TABLE IF NOT EXISTS public.protocolo_servicos
(
    id serial NOT NULL,
    protocolo_id integer NOT NULL,
    servico_id integer NOT NULL,
    criado_em timestamp without time zone DEFAULT now(),
    adicionado_por integer,
    CONSTRAINT protocolo_servicos_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.protocolos
(
    id serial NOT NULL,
    numero character varying(100) COLLATE pg_catalog."default" NOT NULL,
    servico_id integer,
    responsavel_id integer,
    data_entrada date NOT NULL,
    data_vencimento date,
    data_conclusao date,
    status character varying(20) COLLATE pg_catalog."default" DEFAULT 'andamento'::character varying,
    observacoes text COLLATE pg_catalog."default",
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    setor character varying(100) COLLATE pg_catalog."default",
    tem_orcamento boolean DEFAULT false,
    orcamento_valor numeric(10,2),
    orcamento_pago boolean DEFAULT false,
    prioridade character varying(20) COLLATE pg_catalog."default" DEFAULT 'normal',
    nome_cliente character varying(255) COLLATE pg_catalog."default",
    iniciado_em timestamp without time zone,
    pausado_em timestamp without time zone,
    CONSTRAINT protocolos_pkey PRIMARY KEY (id),
    CONSTRAINT protocolos_numero_key UNIQUE (numero)
);

COMMENT ON COLUMN public.protocolos.setor
    IS 'Setor responsável pelo protocolo';

CREATE TABLE IF NOT EXISTS public.servicos
(
    id serial NOT NULL,
    nome character varying(255) COLLATE pg_catalog."default" NOT NULL,
    prazo integer,
    tipo_prazo character varying(20) COLLATE pg_catalog."default" NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    dias_alerta integer DEFAULT 3,
    visivel_atendimento boolean NOT NULL DEFAULT true,
    CONSTRAINT servicos_pkey PRIMARY KEY (id),
    CONSTRAINT servicos_tipo_prazo_check CHECK (tipo_prazo IN ('uteis', 'corridos', 'sem_prazo'))
);

COMMENT ON COLUMN public.servicos.dias_alerta
    IS 'Quantidade de dias de antecedência para gerar alertas de vencimento (padrão: 3 dias)';

CREATE TABLE IF NOT EXISTS public.status_protocolos
(
    id serial NOT NULL,
    nome character varying(50) COLLATE pg_catalog."default" NOT NULL,
    cor character varying(20) COLLATE pg_catalog."default" DEFAULT 'info'::character varying,
    ordem integer DEFAULT 0,
    ativo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT status_protocolos_pkey PRIMARY KEY (id),
    CONSTRAINT status_protocolos_nome_key UNIQUE (nome)
);

COMMENT ON TABLE public.status_protocolos
    IS 'Status personalizáveis para protocolos';

COMMENT ON COLUMN public.status_protocolos.nome
    IS 'Nome do status (ex: Aguardando Documentos)';

COMMENT ON COLUMN public.status_protocolos.cor
    IS 'Cor do badge: info, success, warning, danger, primary, secondary';

COMMENT ON COLUMN public.status_protocolos.ordem
    IS 'Ordem de exibição no dropdown';

CREATE TABLE IF NOT EXISTS public.usuarios
(
    id serial NOT NULL,
    nome character varying(255) COLLATE pg_catalog."default" NOT NULL,
    email character varying(255) COLLATE pg_catalog."default" NOT NULL,
    senha character varying(255) COLLATE pg_catalog."default" NOT NULL,
    cargo character varying(50) COLLATE pg_catalog."default" NOT NULL,
    ativo boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    setor character varying(100) COLLATE pg_catalog."default",
    CONSTRAINT usuarios_pkey PRIMARY KEY (id),
    CONSTRAINT usuarios_email_key UNIQUE (email)
);

COMMENT ON COLUMN public.usuarios.setor
    IS 'Setor ao qual o usuário pertence (ex: RH, Financeiro, Jurídico)';

-- ============================================================
-- FOREIGN KEYS E ÍNDICES
-- ============================================================

ALTER TABLE IF EXISTS public.historico
    ADD CONSTRAINT historico_protocolo_id_fkey FOREIGN KEY (protocolo_id)
    REFERENCES public.protocolos (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.historico
    ADD CONSTRAINT historico_usuario_id_fkey FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.protocolo_historico
    ADD CONSTRAINT protocolo_historico_protocolo_id_fkey FOREIGN KEY (protocolo_id)
    REFERENCES public.protocolos (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

ALTER TABLE IF EXISTS public.protocolo_notas
    ADD CONSTRAINT protocolo_notas_protocolo_id_fkey FOREIGN KEY (protocolo_id)
    REFERENCES public.protocolos (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_protocolo_notas_protocolo_id
    ON public.protocolo_notas(protocolo_id);

ALTER TABLE IF EXISTS public.protocolo_notas
    ADD CONSTRAINT protocolo_notas_usuario_id_fkey FOREIGN KEY (usuario_id)
    REFERENCES public.usuarios (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.protocolo_servicos
    ADD CONSTRAINT protocolo_servicos_adicionado_por_fkey FOREIGN KEY (adicionado_por)
    REFERENCES public.usuarios (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.protocolo_servicos
    ADD CONSTRAINT protocolo_servicos_protocolo_id_fkey FOREIGN KEY (protocolo_id)
    REFERENCES public.protocolos (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_protocolo_servicos_protocolo
    ON public.protocolo_servicos(protocolo_id);

ALTER TABLE IF EXISTS public.protocolo_servicos
    ADD CONSTRAINT protocolo_servicos_servico_id_fkey FOREIGN KEY (servico_id)
    REFERENCES public.servicos (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE NO ACTION;

ALTER TABLE IF EXISTS public.protocolos
    ADD CONSTRAINT protocolos_responsavel_id_fkey FOREIGN KEY (responsavel_id)
    REFERENCES public.usuarios (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_protocolos_responsavel
    ON public.protocolos(responsavel_id);

ALTER TABLE IF EXISTS public.protocolos
    ADD CONSTRAINT protocolos_servico_id_fkey FOREIGN KEY (servico_id)
    REFERENCES public.servicos (id) MATCH SIMPLE
    ON UPDATE NO ACTION
    ON DELETE RESTRICT;

-- ============================================================
-- TRIGGERS PARA UPDATED_AT
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON public.usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON public.servicos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocolos_updated_at BEFORE UPDATE ON public.protocolos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocolo_notas_updated_at BEFORE UPDATE ON public.protocolo_notas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

-- Inserir usuário administrador padrão
-- Usuário inicial (APENAS DESENVOLVIMENTO)
-- Email: admin@cartorio.com
-- Senha: admin123
-- A senha abaixo já está com hash bcrypt válido.
-- IMPORTANTE: em produção, altere a senha imediatamente ou remova este seed.
INSERT INTO public.usuarios (nome, email, senha, cargo, setor) 
VALUES (
    'Administrador',
    'admin@cartorio.com',
    '$2b$10$eQAJxpDO.jiVkMWtEbc.5Oy.u1aJdv868tTInrBBz1VJ.fEN6r8YO',
    'Supervisor',
    'TI'
) ON CONFLICT (email) DO NOTHING;

-- Inserir serviços padrão
INSERT INTO public.servicos (nome, prazo, tipo_prazo, dias_alerta) VALUES
    ('Averbação', 10, 'uteis', 3),
    ('Certidão', 5, 'uteis', 3),
    ('Escritura Pública', 12, 'uteis', 3),
    ('Registro de Compra e Venda', 15, 'uteis', 3),
    ('Registro de Imóvel', 10, 'uteis', 3),
    ('Usucapião', 20, 'uteis', 3)
ON CONFLICT DO NOTHING;

-- Inserir status padrão
INSERT INTO public.status_protocolos (nome, cor, ordem) VALUES
    ('Aguardando Documentos', 'warning', 1),
    ('Em Análise', 'info', 2),
    ('Em Andamento', 'primary', 3),
    ('Aguardando Assinatura', 'warning', 4),
    ('Concluído', 'success', 5),
    ('Cancelado', 'danger', 6)
ON CONFLICT (nome) DO NOTHING;

-- Inserir feriados nacionais de 2024
INSERT INTO public.feriados (data, descricao) VALUES
    ('2024-01-01', 'Ano Novo'),
    ('2024-02-13', 'Carnaval'),
    ('2024-03-29', 'Sexta-feira Santa'),
    ('2024-04-21', 'Tiradentes'),
    ('2024-05-01', 'Dia do Trabalho'),
    ('2024-05-30', 'Corpus Christi'),
    ('2024-09-07', 'Independência do Brasil'),
    ('2024-10-12', 'Nossa Senhora Aparecida'),
    ('2024-11-02', 'Finados'),
    ('2024-11-15', 'Proclamação da República'),
    ('2024-11-20', 'Dia da Consciência Negra'),
    ('2024-12-25', 'Natal')
ON CONFLICT (data) DO NOTHING;

-- Inserir feriados de 2025
INSERT INTO public.feriados (data, descricao) VALUES
    ('2025-01-01', 'Ano Novo'),
    ('2025-03-04', 'Carnaval'),
    ('2025-04-18', 'Sexta-feira Santa'),
    ('2025-04-21', 'Tiradentes'),
    ('2025-05-01', 'Dia do Trabalho'),
    ('2025-06-19', 'Corpus Christi'),
    ('2025-09-07', 'Independência do Brasil'),
    ('2025-10-12', 'Nossa Senhora Aparecida'),
    ('2025-11-02', 'Finados'),
    ('2025-11-15', 'Proclamação da República'),
    ('2025-11-20', 'Dia da Consciência Negra'),
    ('2025-12-25', 'Natal')
ON CONFLICT (data) DO NOTHING;

-- Inserir feriados de 2026
INSERT INTO public.feriados (data, descricao) VALUES
    ('2026-01-01', 'Ano Novo'),
    ('2026-02-17', 'Carnaval'),
    ('2026-04-03', 'Sexta-feira Santa'),
    ('2026-04-21', 'Tiradentes'),
    ('2026-05-01', 'Dia do Trabalho'),
    ('2026-06-04', 'Corpus Christi'),
    ('2026-09-07', 'Independência do Brasil'),
    ('2026-10-12', 'Nossa Senhora Aparecida'),
    ('2026-11-02', 'Finados'),
    ('2026-11-15', 'Proclamação da República'),
    ('2026-11-20', 'Dia da Consciência Negra'),
    ('2026-12-25', 'Natal')
ON CONFLICT (data) DO NOTHING;

COMMIT;

-- ============================================================
-- MENSAGEM DE SUCESSO
-- ============================================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Banco de dados inicializado com sucesso!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Usuário padrão criado:';
    RAISE NOTICE '  Email: admin@cartorio.com';
    RAISE NOTICE '  Senha: admin123';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  IMPORTANTE: Altere a senha após o primeiro login!';
    RAISE NOTICE '';
    RAISE NOTICE 'Dados inseridos:';
    RAISE NOTICE '  ✓ 6 serviços padrão';
    RAISE NOTICE '  ✓ 6 status personalizáveis';
    RAISE NOTICE '  ✓ Feriados nacionais (2024-2026)';
    RAISE NOTICE '';
    RAISE NOTICE 'Sistema pronto para uso!';
    RAISE NOTICE '========================================';
END $$;
