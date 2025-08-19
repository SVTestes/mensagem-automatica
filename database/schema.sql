-- Schema para o sistema de mensagens automáticas
-- Banco de dados: mensagem_automatica

-- Tabela para armazenar pedidos já processados
CREATE TABLE IF NOT EXISTS pedidos_processados (
    id SERIAL PRIMARY KEY,
    numero_pedido INTEGER UNIQUE NOT NULL,
    data_processamento TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para melhorar performance nas consultas
CREATE INDEX IF NOT EXISTS idx_numero_pedido ON pedidos_processados(numero_pedido);

-- Tabela para armazenar pedidos pendentes de envio (quando WhatsApp falha)
CREATE TABLE IF NOT EXISTS pedidos_pendentes (
    id SERIAL PRIMARY KEY,
    numero_pedido INTEGER NOT NULL,
    dados_pedido JSONB NOT NULL,
    tentativas_envio INTEGER DEFAULT 0,
    data_criacao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ultima_tentativa TIMESTAMP
);

-- Índice para pedidos pendentes
CREATE INDEX IF NOT EXISTS idx_pedidos_pendentes ON pedidos_pendentes(numero_pedido);

-- Tabela para logs de erros e alertas
CREATE TABLE IF NOT EXISTS logs_sistema (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(50) NOT NULL,
    mensagem TEXT NOT NULL,
    data_hora TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índice para logs
CREATE INDEX IF NOT EXISTS idx_logs_tipo ON logs_sistema(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_data ON logs_sistema(data_hora);
