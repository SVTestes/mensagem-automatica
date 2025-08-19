const { Pool } = require('pg');
require('dotenv').config();

class Database {
    constructor() {
        this.pool = null;
        this.isConnected = false;
    }

    async connect() {
        try {
            // Prioriza DATABASE_URL se disponível (para Railway)
            if (process.env.DATABASE_URL) {
                this.pool = new Pool({
                    connectionString: process.env.DATABASE_URL,
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
                });
            } else {
                // Fallback para configurações individuais
                this.pool = new Pool({
                    host: process.env.DB_HOST || 'localhost',
                    port: process.env.DB_PORT || 5432,
                    database: process.env.DB_NAME || 'mensagem_automatica',
                    user: process.env.DB_USER || 'postgres',
                    password: process.env.DB_PASSWORD || 'password',
                    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
                });
            }

            // Testa a conexão
            const client = await this.pool.connect();
            await client.query('SELECT NOW()');
            client.release();
            
            this.isConnected = true;
            console.log('✅ Banco de dados PostgreSQL conectado com sucesso!');
            
            // Inicializa as tabelas
            await this.initializeTables();
            
        } catch (error) {
            console.error('❌ Erro ao conectar com banco de dados:', error.message);
            this.isConnected = false;
            throw error;
        }
    }

    async initializeTables() {
        try {
            // Cria as tabelas diretamente no código para evitar problemas de require
            const createTablesSQL = `
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
            `;
            
            await this.pool.query(createTablesSQL);
            console.log('✅ Tabelas do banco inicializadas com sucesso!');
        } catch (error) {
            console.error('❌ Erro ao inicializar tabelas:', error.message);
        }
    }

    async query(text, params) {
        if (!this.isConnected) {
            throw new Error('Banco de dados não está conectado');
        }
        
        try {
            const result = await this.pool.query(text, params);
            return result;
        } catch (error) {
            console.error('❌ Erro na query:', error.message);
            throw error;
        }
    }

    async close() {
        if (this.pool) {
            await this.pool.end();
            this.isConnected = false;
            console.log('🔌 Conexão com banco de dados fechada');
        }
    }

    isDatabaseOnline() {
        return this.isConnected;
    }
}

module.exports = new Database();
