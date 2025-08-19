const database = require('../config/database');

class Logger {
    constructor() {
        this.isDatabaseAvailable = false;
    }

    async initialize() {
        try {
            this.isDatabaseAvailable = database.isDatabaseOnline();
        } catch (error) {
            this.isDatabaseAvailable = false;
        }
    }

    async log(tipo, mensagem) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${tipo.toUpperCase()}] ${mensagem}`;
        
        // Log no console
        console.log(logEntry);
        
        // Log no banco de dados se disponível
        if (this.isDatabaseAvailable) {
            try {
                await database.query(
                    'INSERT INTO logs_sistema (tipo, mensagem) VALUES ($1, $2)',
                    [tipo, mensagem]
                );
            } catch (error) {
                console.error('❌ Erro ao salvar log no banco:', error.message);
                this.isDatabaseAvailable = false;
            }
        }
    }

    async logError(tipo, mensagem, error = null) {
        let fullMessage = mensagem;
        if (error) {
            fullMessage += ` | Erro: ${error.message}`;
            if (error.stack) {
                fullMessage += ` | Stack: ${error.stack.split('\n')[0]}`;
            }
        }
        
        await this.log(tipo, fullMessage);
    }

    async logInfo(mensagem) {
        await this.log('info', mensagem);
    }

    async logWarning(mensagem) {
        await this.log('warning', mensagem);
    }

    async logError(mensagem, error = null) {
        await this.log('error', mensagem, error);
    }

    async logSuccess(mensagem) {
        await this.log('success', mensagem);
    }

    async logSystem(mensagem) {
        await this.log('system', mensagem);
    }

    async logWooCommerce(mensagem) {
        await this.log('woocommerce', mensagem);
    }

    async logWhatsApp(mensagem) {
        await this.log('whatsapp', mensagem);
    }

    async logDatabase(mensagem) {
        await this.log('database', mensagem);
    }

    // Método para obter logs recentes
    async getRecentLogs(limit = 50) {
        if (!this.isDatabaseAvailable) {
            return [];
        }

        try {
            const result = await database.query(
                'SELECT * FROM logs_sistema ORDER BY data_hora DESC LIMIT $1',
                [limit]
            );
            return result.rows;
        } catch (error) {
            console.error('❌ Erro ao buscar logs:', error.message);
            return [];
        }
    }

    // Método para limpar logs antigos (manter apenas últimos 1000)
    async cleanupOldLogs() {
        if (!this.isDatabaseAvailable) {
            return;
        }

        try {
            await database.query(
                'DELETE FROM logs_sistema WHERE id NOT IN (SELECT id FROM logs_sistema ORDER BY data_hora DESC LIMIT 1000)'
            );
        } catch (error) {
            console.error('❌ Erro ao limpar logs antigos:', error.message);
        }
    }

    // Método para verificar se o logger está funcionando
    isWorking() {
        return this.isDatabaseAvailable;
    }
}

module.exports = new Logger();
