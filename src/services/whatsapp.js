const axios = require('axios');
const logger = require('../utils/logger');
const MessageFormatter = require('../utils/messageFormatter');

class WhatsAppService {
    constructor() {
        this.apiUrl = process.env.WHATSAPP_API_URL;
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.targetPhone = process.env.WHATSAPP_TARGET_PHONE;
        this.isOnline = false;
        this.lastError = null;
        this.errorCount = 0;
        this.maxRetries = 3;
    }

    async checkConnection() {
        try {
            if (!this.apiUrl || !this.accessToken || !this.phoneNumberId) {
                this.isOnline = false;
                await logger.logWarning('Credenciais do WhatsApp não configuradas');
                return false;
            }

            // Testa a conexão fazendo uma requisição simples
            const response = await axios.get(`${this.apiUrl}/v17.0/${this.phoneNumberId}`, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            this.isOnline = response.status === 200;
            this.errorCount = 0;
            this.lastError = null;
            
            if (this.isOnline) {
                await logger.logSuccess('WhatsApp API está online');
            }
            
            return this.isOnline;
        } catch (error) {
            this.isOnline = false;
            this.lastError = error.message;
            this.errorCount++;
            
            await logger.logError('WhatsApp API está offline', error);
            return false;
        }
    }

    async sendMessage(message, isRetry = false) {
        try {
            if (!this.isOnline) {
                await this.checkConnection();
                if (!this.isOnline) {
                    throw new Error('WhatsApp API está offline');
                }
            }

            if (!this.targetPhone) {
                throw new Error('Número de telefone de destino não configurado');
            }

            const payload = {
                messaging_product: 'whatsapp',
                to: this.targetPhone,
                type: 'text',
                text: {
                    body: message
                }
            };

            const response = await axios.post(
                `${this.apiUrl}/v17.0/${this.phoneNumberId}/messages`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            if (response.status === 200 || response.status === 201) {
                this.errorCount = 0;
                this.lastError = null;
                
                const logMessage = isRetry ? 
                    'Mensagem de reenvio enviada com sucesso via WhatsApp' : 
                    'Mensagem enviada com sucesso via WhatsApp';
                
                await logger.logSuccess(logMessage);
                return true;
            } else {
                throw new Error(`Erro na API: ${response.status}`);
            }

        } catch (error) {
            this.isOnline = false;
            this.lastError = error.message;
            this.errorCount++;
            
            await logger.logError('Erro ao enviar mensagem via WhatsApp', error);
            throw error;
        }
    }

    async sendPedidoMessage(pedido) {
        try {
            const message = MessageFormatter.formatPedidoMessage(pedido);
            return await this.sendMessage(message);
        } catch (error) {
            await logger.logError(`Erro ao enviar mensagem do pedido ${pedido.numero}`, error);
            throw error;
        }
    }

    async sendErrorMessage(tipo, mensagem) {
        try {
            const message = MessageFormatter.formatErrorMessage(tipo, mensagem);
            return await this.sendMessage(message);
        } catch (error) {
            await logger.logError(`Erro ao enviar mensagem de erro ${tipo}`, error);
            throw error;
        }
    }

    async sendSystemStatus(status) {
        try {
            const message = MessageFormatter.formatSystemStatus(status);
            return await this.sendMessage(message);
        } catch (error) {
            await logger.logError('Erro ao enviar status do sistema', error);
            throw error;
        }
    }

    async sendRetryMessage(pedido, tentativa) {
        try {
            const message = MessageFormatter.formatRetryMessage(pedido, tentativa);
            return await this.sendMessage(message, true);
        } catch (error) {
            await logger.logError(`Erro ao enviar mensagem de reenvio do pedido ${pedido.numero}`, error);
            throw error;
        }
    }

    // Método para enviar mensagem de teste
    async sendTestMessage() {
        try {
            const testMessage = `🧪 TESTE DO SISTEMA

✅ WhatsApp API está funcionando!
📅 Data/Hora: ${new Date().toLocaleString('pt-BR')}
🚀 Sistema de mensagens automáticas ativo!`;

            return await this.sendMessage(testMessage);
        } catch (error) {
            await logger.logError('Erro ao enviar mensagem de teste', error);
            throw error;
        }
    }

    // Método para verificar se o serviço está funcionando
    isServiceOnline() {
        return this.isOnline;
    }

    // Método para obter informações de erro
    getErrorInfo() {
        return {
            isOnline: this.isOnline,
            lastError: this.lastError,
            errorCount: this.errorCount,
            maxRetries: this.maxRetries
        };
    }

    // Método para resetar contadores de erro
    resetErrorCounters() {
        this.errorCount = 0;
        this.lastError = null;
    }

    // Método para verificar se deve tentar reenviar
    shouldRetry() {
        return this.errorCount < this.maxRetries;
    }

    // Método para testar a conexão
    async testConnection() {
        try {
            const isConnected = await this.checkConnection();
            if (isConnected) {
                await logger.logSuccess('Teste de conexão WhatsApp: SUCESSO');
                return true;
            } else {
                await logger.logError('Teste de conexão WhatsApp: FALHOU');
                return false;
            }
        } catch (error) {
            await logger.logError('Teste de conexão WhatsApp: ERRO', error);
            return false;
        }
    }
}

module.exports = new WhatsAppService();
