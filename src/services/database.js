const database = require('../config/database');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.isInitialized = false;
    }

    async initialize() {
        try {
            await database.connect();
            this.isInitialized = true;
            await logger.logSuccess('Serviço de banco de dados inicializado');
        } catch (error) {
            this.isInitialized = false;
            await logger.logError('Erro ao inicializar serviço de banco de dados', error);
            throw error;
        }
    }

    // Verifica se um pedido já foi processado
    async isPedidoProcessado(numeroPedido) {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            const result = await database.query(
                'SELECT id FROM pedidos_processados WHERE numero_pedido = $1',
                [numeroPedido]
            );

            return result.rows.length > 0;
        } catch (error) {
            await logger.logError(`Erro ao verificar pedido ${numeroPedido}`, error);
            throw error;
        }
    }

    // Marca um pedido como processado
    async marcarPedidoProcessado(numeroPedido) {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            await database.query(
                'INSERT INTO pedidos_processados (numero_pedido) VALUES ($1) ON CONFLICT (numero_pedido) DO NOTHING',
                [numeroPedido]
            );

            await logger.logSuccess(`Pedido ${numeroPedido} marcado como processado`);
            return true;
        } catch (error) {
            await logger.logError(`Erro ao marcar pedido ${numeroPedido} como processado`, error);
            throw error;
        }
    }

    // Adiciona um pedido à fila de pendentes
    async adicionarPedidoPendente(numeroPedido, dadosPedido) {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            await database.query(
                'INSERT INTO pedidos_pendentes (numero_pedido, dados_pedido) VALUES ($1, $2) ON CONFLICT (numero_pedido) DO NOTHING',
                [numeroPedido, JSON.stringify(dadosPedido)]
            );

            await logger.logInfo(`Pedido ${numeroPedido} adicionado à fila de pendentes`);
            return true;
        } catch (error) {
            await logger.logError(`Erro ao adicionar pedido ${numeroPedido} à fila de pendentes`, error);
            throw error;
        }
    }

    // Remove um pedido da fila de pendentes
    async removerPedidoPendente(numeroPedido) {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            await database.query(
                'DELETE FROM pedidos_pendentes WHERE numero_pedido = $1',
                [numeroPedido]
            );

            await logger.logSuccess(`Pedido ${numeroPedido} removido da fila de pendentes`);
            return true;
        } catch (error) {
            await logger.logError(`Erro ao remover pedido ${numeroPedido} da fila de pendentes`, error);
            throw error;
        }
    }

    // Obtém todos os pedidos pendentes
    async getPedidosPendentes() {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            const result = await database.query(
                'SELECT * FROM pedidos_pendentes ORDER BY data_criacao ASC'
            );

            return result.rows;
        } catch (error) {
            await logger.logError('Erro ao buscar pedidos pendentes', error);
            throw error;
        }
    }

    // Atualiza contador de tentativas de um pedido pendente
    async atualizarTentativasPedido(numeroPedido, tentativas) {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            await database.query(
                'UPDATE pedidos_pendentes SET tentativas_envio = $1, ultima_tentativa = NOW() WHERE numero_pedido = $2',
                [tentativas, numeroPedido]
            );

            await logger.logInfo(`Tentativas do pedido ${numeroPedido} atualizadas para ${tentativas}`);
            return true;
        } catch (error) {
            await logger.logError(`Erro ao atualizar tentativas do pedido ${numeroPedido}`, error);
            throw error;
        }
    }

    // Obtém estatísticas do banco
    async getStats() {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            const [processados, pendentes] = await Promise.all([
                database.query('SELECT COUNT(*) as total FROM pedidos_processados'),
                database.query('SELECT COUNT(*) as total FROM pedidos_pendentes')
            ]);

            return {
                pedidosProcessados: parseInt(processados.rows[0].total),
                pedidosPendentes: parseInt(pendentes.rows[0].total),
                isOnline: database.isDatabaseOnline()
            };
        } catch (error) {
            await logger.logError('Erro ao obter estatísticas do banco', error);
            return {
                pedidosProcessados: 0,
                pedidosPendentes: 0,
                isOnline: false
            };
        }
    }

    // Limpa pedidos antigos (mais de 30 dias)
    async limparPedidosAntigos() {
        try {
            if (!this.isInitialized) {
                throw new Error('Serviço de banco não inicializado');
            }

            const result = await database.query(
                'DELETE FROM pedidos_processados WHERE data_processamento < NOW() - INTERVAL \'30 days\''
            );

            if (result.rowCount > 0) {
                await logger.logInfo(`${result.rowCount} pedidos antigos removidos do banco`);
            }

            return result.rowCount;
        } catch (error) {
            await logger.logError('Erro ao limpar pedidos antigos', error);
            return 0;
        }
    }

    // Verifica a saúde do banco
    async healthCheck() {
        try {
            if (!this.isInitialized) {
                return { status: 'offline', message: 'Serviço não inicializado' };
            }

            await database.query('SELECT 1');
            return { status: 'online', message: 'Banco de dados funcionando normalmente' };
        } catch (error) {
            return { status: 'offline', message: `Erro: ${error.message}` };
        }
    }

    // Método para fechar conexões
    async close() {
        try {
            await database.close();
            this.isInitialized = false;
            await logger.logInfo('Serviço de banco de dados fechado');
        } catch (error) {
            await logger.logError('Erro ao fechar serviço de banco de dados', error);
        }
    }

    isServiceOnline() {
        return this.isInitialized && database.isDatabaseOnline();
    }
}

module.exports = new DatabaseService();
