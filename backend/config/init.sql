-- Criação do banco de dados
-- Execute: psql -U postgres -f init.sql

CREATE DATABASE cartorio_db;

\c cartorio_db;

-- Tabela de usuários
CREATE TABLE usuarios (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    senha VARCHAR(255) NOT NULL,
    cargo VARCHAR(50) NOT NULL CHECK (cargo IN ('Supervisor', 'Escrevente', 'Auxiliar')),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de tipos de serviço
CREATE TABLE servicos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    prazo INTEGER,
    tipo_prazo VARCHAR(20) NOT NULL CHECK (tipo_prazo IN ('uteis', 'corridos', 'sem_prazo')),
    ativo BOOLEAN DEFAULT true,
    visivel_atendimento BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de protocolos
CREATE TABLE protocolos (
    id SERIAL PRIMARY KEY,
    numero VARCHAR(100) UNIQUE NOT NULL,
    servico_id INTEGER REFERENCES servicos(id) ON DELETE RESTRICT,
    responsavel_id INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
    data_entrada DATE NOT NULL,
    data_vencimento DATE,
    data_conclusao DATE,
    status VARCHAR(20) DEFAULT 'andamento' CHECK (status IN ('andamento', 'concluido', 'cancelado')),
    observacoes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de feriados
CREATE TABLE feriados (
    id SERIAL PRIMARY KEY,
    data DATE NOT NULL UNIQUE,
    descricao VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela de histórico/auditoria
CREATE TABLE historico (
    id SERIAL PRIMARY KEY,
    protocolo_id INTEGER REFERENCES protocolos(id) ON DELETE CASCADE,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    acao VARCHAR(100) NOT NULL,
    descricao TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para melhor performance
CREATE INDEX idx_protocolos_status ON protocolos(status);
CREATE INDEX idx_protocolos_responsavel ON protocolos(responsavel_id);
CREATE INDEX idx_protocolos_data_vencimento ON protocolos(data_vencimento);
CREATE INDEX idx_feriados_data ON feriados(data);

-- Inserir usuário supervisor padrão (senha: admin123)
INSERT INTO usuarios (nome, email, senha, cargo) 
-- bcrypt hash real de "admin123"
VALUES ('Administrador', 'admin@cartorio.com', '$2b$10$U12/wJRP2m7XXf.aDzingeLjY1DLMZ7xkLCUT42eCjmaFgi/nFVBW', 'Supervisor');

-- Inserir alguns serviços padrão
INSERT INTO servicos (nome, prazo, tipo_prazo) VALUES
('Usucapião', 20, 'uteis'),
('Registro de Compra e Venda', 15, 'uteis'),
('Averbação', 10, 'uteis'),
('Certidão', 5, 'uteis'),
('Escritura Pública', 12, 'uteis');

-- Inserir feriados nacionais de 2026
INSERT INTO feriados (data, descricao) VALUES
('2026-01-01', 'Ano Novo'),
('2026-02-16', 'Carnaval'),
('2026-02-17', 'Carnaval'),
('2026-04-03', 'Sexta-feira Santa'),
('2026-04-21', 'Tiradentes'),
('2026-05-01', 'Dia do Trabalho'),
('2026-06-04', 'Corpus Christi'),
('2026-09-07', 'Independência do Brasil'),
('2026-10-12', 'Nossa Senhora Aparecida'),
('2026-11-02', 'Finados'),
('2026-11-15', 'Proclamação da República'),
('2026-12-25', 'Natal');

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers para updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servicos_updated_at BEFORE UPDATE ON servicos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_protocolos_updated_at BEFORE UPDATE ON protocolos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
