const express = require('express');
const cron = require('node-cron');
require('dotenv').config();

// Importa serviços
const databaseService = require('./services/database');
const woocommerceService = require('./services/woocommerce');
const whatsappService = require('./services/whatsapp');
const logger = require('./utils/logger');

// Configurações
const PORT = process.env.PORT || 3000;
const CHECK_INTERVAL_MINUTES = parseInt(process.env.CHECK_INTERVAL_MINUTES) || 15;
const MAX_ORDERS_TO_CHECK = parseInt(process.env.MAX_ORDERS_TO_CHECK) || 10;

class MensagemAutomaticaSystem {
    constructor() {
        this.app = express();
        this.isRunning = false;
        this.lastCheck = null;
        this.errorAlertsSent = {
            woocommerce: false,
            database: false,
            whatsapp: false
        };
        this.pendingOrdersQueue = [];
        this.isProcessingQueue = false;
    }

    async initialize() {
        try {
            console.log('🚀 Iniciando Sistema de Mensagens Automáticas...');
            
            // Configura Express PRIMEIRO para responder rapidamente
            this.setupExpress();
            
            // Inicializa serviços em background
            this.initializeServices().catch(error => {
                console.error('❌ Erro ao inicializar serviços:', error);
                // Não mata o processo
            });
            
            // Inicia o sistema em background
            setTimeout(async () => {
                try {
                    await this.startSystem();
                    console.log('✅ Sistema iniciado com sucesso!');
                } catch (error) {
                    console.error('❌ Erro ao iniciar sistema:', error);
                    // Não mata o processo
                }
            }, 2000); // 2 segundos de delay
            
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema:', error);
            // NÃO mata o processo mais
            console.log('🔄 Tentando continuar execução...');
        }
    }

    async initializeServices() {
        console.log('🔧 Inicializando serviços...');
        
        // Inicializa banco de dados
        await databaseService.initialize();
        await logger.initialize();
        
        // Testa conexões
        await this.testConnections();
        
        console.log('✅ Serviços inicializados!');
    }

    async testConnections() {
        console.log('🧪 Testando conexões...');
        
        // Testa WooCommerce
        const wooTest = await woocommerceService.testConnection();
        console.log(`WooCommerce: ${wooTest ? '✅' : '❌'}`);
        
        // Testa WhatsApp (se credenciais estiverem configuradas)
        if (process.env.WHATSAPP_API_URL && process.env.WHATSAPP_ACCESS_TOKEN) {
            const whatsappTest = await whatsappService.testConnection();
            console.log(`WhatsApp: ${whatsappTest ? '✅' : '❌'}`);
        } else {
            console.log('WhatsApp: ⚠️ Credenciais não configuradas');
        }
        
        // Testa banco de dados
        const dbHealth = await databaseService.healthCheck();
        console.log(`Banco de Dados: ${dbHealth.status === 'online' ? '✅' : '❌'}`);
    }

    setupExpress() {
        this.app.use(express.json());
        
        // Middleware de logging
        this.app.use((req, res, next) => {
            logger.logInfo(`${req.method} ${req.path}`);
            next();
        });

            // Rota de health check
    this.app.get('/health', async (req, res) => {
        try {
            const status = {
                system: 'online',
                database: await databaseService.healthCheck(),
                woocommerce: { status: woocommerceService.isServiceOnline() ? 'online' : 'offline' },
                whatsapp: { status: whatsappService.isServiceOnline() ? 'online' : 'offline' },
                lastCheck: this.lastCheck,
                pendingOrders: this.pendingOrdersQueue.length,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            };
            
            res.status(200).json(status);
        } catch (error) {
            res.status(500).json({ 
                error: error.message,
                system: 'error',
                timestamp: new Date().toISOString()
            });
        }
    });

    // Rota de health check simples para Railway
    this.app.get('/', (req, res) => {
        res.status(200).json({ 
            status: 'online',
            service: 'mensagem-automatica',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            pid: process.pid
        });
    });

    // Health check ultra-rápido para Railway
    this.app.get('/ping', (req, res) => {
        res.status(200).send('pong');
    });

        // Rota de status do sistema
        this.app.get('/status', async (req, res) => {
            try {
                const [dbStats, wooStats] = await Promise.all([
                    databaseService.getStats(),
                    woocommerceService.getStats()
                ]);
                
                const status = {
                    system: {
                        isRunning: this.isRunning,
                        lastCheck: this.lastCheck,
                        pendingOrders: this.pendingOrdersQueue.length
                    },
                    database: dbStats,
                    woocommerce: wooStats,
                    whatsapp: whatsappService.getErrorInfo()
                };
                
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Rota para forçar verificação manual
        this.app.post('/check-now', async (req, res) => {
            try {
                await this.checkNewOrders();
                res.json({ message: 'Verificação manual executada com sucesso' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Rota para enviar mensagem de teste
        this.app.post('/test-whatsapp', async (req, res) => {
            try {
                await whatsappService.sendTestMessage();
                res.json({ message: 'Mensagem de teste enviada com sucesso' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Rota para processar fila de pendentes
        this.app.post('/process-queue', async (req, res) => {
            try {
                await this.processPendingOrdersQueue();
                res.json({ message: 'Fila de pendentes processada com sucesso' });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
    }

    async startSystem() {
        console.log('🔄 Iniciando sistema de verificação automática...');
        
        this.isRunning = true;
        
        // Primeira verificação imediata
        await this.checkNewOrders();
        
        // Agenda verificação a cada X minutos
        cron.schedule(`*/${CHECK_INTERVAL_MINUTES} * * * *`, async () => {
            if (this.isRunning) {
                await this.checkNewOrders();
            }
        });
        
        // Agenda limpeza diária às 2h da manhã
        cron.schedule('0 2 * * *', async () => {
            if (this.isRunning) {
                await this.cleanupOldData();
            }
        });
        
        // Processa fila de pendentes a cada 5 minutos
        cron.schedule('*/5 * * * *', async () => {
            if (this.isRunning && !this.isProcessingQueue) {
                await this.processPendingOrdersQueue();
            }
        });
        
        console.log(`✅ Sistema agendado para verificar a cada ${CHECK_INTERVAL_MINUTES} minutos`);
    }

    async checkNewOrders() {
        try {
            console.log('🔍 Verificando novos pedidos...');
            this.lastCheck = new Date();
            
            // Verifica se os serviços estão online
            if (!await this.checkServicesHealth()) {
                return;
            }
            
            // Busca pedidos recentes
            const pedidos = await woocommerceService.getRecentOrders(MAX_ORDERS_TO_CHECK);
            
            if (pedidos.length === 0) {
                console.log('📭 Nenhum pedido novo encontrado');
                return;
            }
            
            console.log(`📦 Encontrados ${pedidos.length} pedidos para processar`);
            
            // Processa cada pedido
            for (const pedido of pedidos) {
                await this.processOrder(pedido);
            }
            
            // Processa fila de pendentes se WhatsApp estiver funcionando
            if (whatsappService.isServiceOnline()) {
                await this.processPendingOrdersQueue();
            }
            
            console.log('✅ Verificação de pedidos concluída');
            
        } catch (error) {
            await logger.logError('Erro durante verificação de pedidos', error);
            console.error('❌ Erro na verificação:', error.message);
        }
    }

    async checkServicesHealth() {
        let allServicesOnline = true;
        
        // Verifica WooCommerce
        if (!woocommerceService.isServiceOnline()) {
            if (!this.errorAlertsSent.woocommerce) {
                await this.sendWooCommerceErrorAlert();
                this.errorAlertsSent.woocommerce = true;
            }
            allServicesOnline = false;
        } else {
            this.errorAlertsSent.woocommerce = false;
        }
        
        // Verifica banco de dados
        if (!databaseService.isServiceOnline()) {
            if (!this.errorAlertsSent.database) {
                await this.sendDatabaseErrorAlert();
                this.errorAlertsSent.database = true;
            }
            allServicesOnline = false;
        } else {
            this.errorAlertsSent.database = false;
        }
        
        // Verifica WhatsApp
        if (!whatsappService.isServiceOnline()) {
            if (!this.errorAlertsSent.whatsapp) {
                this.errorAlertsSent.whatsapp = true;
            }
            allServicesOnline = false;
        } else {
            this.errorAlertsSent.whatsapp = false;
        }
        
        return allServicesOnline;
    }

    async processOrder(pedido) {
        try {
            console.log(`📋 Processando pedido #${pedido.numero}...`);
            
            // Verifica se já foi processado
            const jaProcessado = await databaseService.isPedidoProcessado(pedido.numero);
            if (jaProcessado) {
                console.log(`⏭️ Pedido #${pedido.numero} já foi processado anteriormente`);
                return;
            }
            
            // Verifica se está no status correto
            if (!pedido.isProcessando()) {
                console.log(`⏭️ Pedido #${pedido.numero} não está no status processando`);
                return;
            }
            
            // Tenta enviar mensagem via WhatsApp
            try {
                await whatsappService.sendPedidoMessage(pedido);
                
                // Marca como processado no banco
                await databaseService.marcarPedidoProcessado(pedido.numero);
                
                console.log(`✅ Pedido #${pedido.numero} processado e mensagem enviada com sucesso`);
                
            } catch (whatsappError) {
                console.log(`⚠️ Erro ao enviar mensagem do pedido #${pedido.numero}, adicionando à fila de pendentes`);
                
                // Adiciona à fila de pendentes
                await databaseService.adicionarPedidoPendente(pedido.numero, pedido.toJSON());
                this.pendingOrdersQueue.push(pedido);
                
                // Marca como processado para não processar novamente
                await databaseService.marcarPedidoProcessado(pedido.numero);
            }
            
        } catch (error) {
            await logger.logError(`Erro ao processar pedido #${pedido.numero}`, error);
            console.error(`❌ Erro no pedido #${pedido.numero}:`, error.message);
        }
    }

    async processPendingOrdersQueue() {
        if (this.isProcessingQueue || !whatsappService.isServiceOnline()) {
            return;
        }
        
        this.isProcessingQueue = true;
        
        try {
            console.log('📬 Processando fila de pedidos pendentes...');
            
            const pedidosPendentes = await databaseService.getPedidosPendentes();
            
            if (pedidosPendentes.length === 0) {
                console.log('📭 Nenhum pedido pendente para processar');
                return;
            }
            
            console.log(`📦 Processando ${pedidosPendentes.length} pedidos pendentes...`);
            
            for (const pedidoPendente of pedidosPendentes) {
                try {
                    const pedido = JSON.parse(pedidoPendente.dados_pedido);
                    
                    // Tenta enviar mensagem
                    await whatsappService.sendRetryMessage(pedido, pedidoPendente.tentativas_envio + 1);
                    
                    // Remove da fila de pendentes
                    await databaseService.removerPedidoPendente(pedidoPendente.numero_pedido);
                    
                    // Remove da fila local
                    this.pendingOrdersQueue = this.pendingOrdersQueue.filter(p => p.numero !== pedidoPendente.numero_pedido);
                    
                    console.log(`✅ Pedido pendente #${pedidoPendente.numero_pedido} processado com sucesso`);
                    
                } catch (error) {
                    console.log(`⚠️ Erro ao processar pedido pendente #${pedidoPendente.numero_pedido}:`, error.message);
                    
                    // Atualiza contador de tentativas
                    const novasTentativas = pedidoPendente.tentativas_envio + 1;
                    await databaseService.atualizarTentativasPedido(pedidoPendente.numero_pedido, novasTentativas);
                    
                    // Se excedeu tentativas máximas, remove da fila
                    if (novasTentativas >= 5) {
                        await databaseService.removerPedidoPendente(pedidoPendente.numero_pedido);
                        console.log(`❌ Pedido #${pedidoPendente.numero_pedido} removido da fila após 5 tentativas`);
                    }
                }
            }
            
            console.log('✅ Fila de pendentes processada');
            
        } catch (error) {
            await logger.logError('Erro ao processar fila de pendentes', error);
            console.error('❌ Erro na fila de pendentes:', error.message);
        } finally {
            this.isProcessingQueue = false;
        }
    }

    async sendWooCommerceErrorAlert() {
        try {
            if (whatsappService.isServiceOnline()) {
                await whatsappService.sendErrorMessage('woocommerce', 'API do WooCommerce está indisponível');
                console.log('⚠️ Alerta de erro WooCommerce enviado via WhatsApp');
            }
        } catch (error) {
            console.error('❌ Erro ao enviar alerta WooCommerce:', error.message);
        }
    }

    async sendDatabaseErrorAlert() {
        try {
            if (whatsappService.isServiceOnline()) {
                await whatsappService.sendErrorMessage('database', 'Banco de dados está offline');
                console.log('⚠️ Alerta de erro do banco enviado via WhatsApp');
            }
        } catch (error) {
            console.error('❌ Erro ao enviar alerta do banco:', error.message);
        }
    }

    async cleanupOldData() {
        try {
            console.log('🧹 Limpando dados antigos...');
            
            const pedidosRemovidos = await databaseService.limparPedidosAntigos();
            await logger.cleanupOldLogs();
            
            console.log(`✅ Limpeza concluída: ${pedidosRemovidos} pedidos antigos removidos`);
            
        } catch (error) {
            await logger.logError('Erro durante limpeza de dados antigos', error);
            console.error('❌ Erro na limpeza:', error.message);
        }
    }

    async shutdown() {
        console.log('🔄 Encerrando sistema...');
        
        this.isRunning = false;
        
        try {
            await databaseService.close();
            await logger.logSystem('Sistema encerrado pelo usuário');
            console.log('✅ Sistema encerrado com sucesso');
        } catch (error) {
            console.error('❌ Erro ao encerrar sistema:', error);
        }
        
        process.exit(0);
    }
}

// Cria e inicializa o sistema
const system = new MensagemAutomaticaSystem();

    // Inicia o servidor Express
    system.app.listen(PORT, () => {
        console.log(`🌐 Servidor rodando na porta ${PORT}`);
        console.log(`📊 Health check: http://localhost:${PORT}/health`);
        console.log(`📈 Status: http://localhost:${PORT}/status`);
        
        // Inicializa o sistema EM BACKGROUND para não bloquear o servidor
        setTimeout(() => {
            system.initialize().catch(error => {
                console.error('❌ Erro na inicialização do sistema:', error);
                // Não mata o processo, apenas loga o erro
            });
        }, 1000); // 1 segundo de delay
    });

// Tratamento de sinais para encerramento graceful
process.on('SIGINT', () => system.shutdown());
process.on('SIGTERM', () => system.shutdown());

// Tratamento de erros não capturados
process.on('uncaughtException', async (error) => {
    console.error('❌ Erro não capturado:', error);
    try {
        await logger.logError('Erro não capturado do sistema', error);
    } catch (logError) {
        console.error('❌ Erro ao logar erro:', logError);
    }
    
    // Não mata o processo imediatamente
    console.log('🔄 Tentando continuar execução...');
});

process.on('unhandledRejection', async (reason, promise) => {
    console.error('❌ Promise rejeitada não tratada:', reason);
    try {
        await logger.logError('Promise rejeitada não tratada', reason);
    } catch (logError) {
        console.error('❌ Erro ao logar erro:', logError);
    }
    
    // Não mata o processo imediatamente
    console.log('🔄 Tentando continuar execução...');
});

// Keep-alive para Railway
setInterval(() => {
    console.log('💓 Keep-alive: Sistema funcionando...');
}, 30000); // A cada 30 segundos
