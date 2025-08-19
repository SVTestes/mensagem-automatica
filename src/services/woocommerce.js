const axios = require('axios');
const Pedido = require('../models/pedido');
const logger = require('../utils/logger');

class WooCommerceService {
    constructor() {
        this.baseURL = process.env.WOOCOMMERCE_URL;
        this.consumerKey = process.env.WOOCOMMERCE_CONSUMER_KEY;
        this.consumerSecret = process.env.WOOCOMMERCE_CONSUMER_SECRET;
        this.isOnline = false;
        this.lastCheck = null;
    }

    async checkConnection() {
        try {
            const response = await axios.get(`${this.baseURL}/wp-json/wc/v3/products`, {
                params: {
                    consumer_key: this.consumerKey,
                    consumer_secret: this.consumerSecret,
                    per_page: 1
                },
                timeout: 30000
            });

            this.isOnline = response.status === 200;
            if (this.isOnline) {
                await logger.logSuccess('WooCommerce API está online');
            }
            return this.isOnline;
        } catch (error) {
            this.isOnline = false;
            await logger.logError('WooCommerce API está offline', error);
            return false;
        }
    }

    async getRecentOrders(limit = 10) {
        try {
            if (!this.isOnline) {
                await this.checkConnection();
                if (!this.isOnline) {
                    throw new Error('WooCommerce API está offline');
                }
            }

            const response = await axios.get(`${this.baseURL}/wp-json/wc/v3/orders`, {
                params: {
                    consumer_key: this.consumerKey,
                    consumer_secret: this.consumerSecret,
                    per_page: limit,
                    orderby: 'date',
                    order: 'desc',
                    status: 'processing' // Filtra apenas pedidos processando
                },
                timeout: 30000
            });

            if (response.status !== 200) {
                throw new Error(`Erro na API: ${response.status}`);
            }

            const orders = response.data;
            this.lastCheck = new Date();
            
            await logger.logInfo(`Buscados ${orders.length} pedidos da API WooCommerce`);
            
            // Filtra pedidos com status "processando" ou "processing"
            const pedidosProcessando = orders.filter(order => {
                const status = order.status.toLowerCase();
                return status === 'processing' || status === 'processando';
            });

            // Converte para objetos Pedido
            const pedidos = pedidosProcessando.map(orderData => new Pedido(orderData));
            
            await logger.logSuccess(`Filtrados ${pedidos.length} pedidos com status processando`);
            
            return pedidos;

        } catch (error) {
            this.isOnline = false;
            await logger.logError('Erro ao buscar pedidos do WooCommerce', error);
            throw error;
        }
    }

    async getOrderById(orderId) {
        try {
            const response = await axios.get(`${this.baseURL}/wp-json/wc/v3/orders/${orderId}`, {
                params: {
                    consumer_key: this.consumerKey,
                    consumer_secret: this.consumerSecret
                },
                timeout: 30000
            });

            if (response.status !== 200) {
                throw new Error(`Erro ao buscar pedido ${orderId}: ${response.status}`);
            }

            return new Pedido(response.data);
        } catch (error) {
            await logger.logError(`Erro ao buscar pedido ${orderId}`, error);
            throw error;
        }
    }

    async getOrderStatus(orderId) {
        try {
            const order = await this.getOrderById(orderId);
            return order.status;
        } catch (error) {
            await logger.logError(`Erro ao verificar status do pedido ${orderId}`, error);
            return null;
        }
    }

    // Método para verificar se um pedido específico está processando
    async isOrderProcessing(orderId) {
        try {
            const status = await this.getOrderStatus(orderId);
            if (!status) return false;
            
            const statusLower = status.toLowerCase();
            return statusLower === 'processing' || statusLower === 'processando';
        } catch (error) {
            return false;
        }
    }

    // Método para obter estatísticas básicas
    async getStats() {
        try {
            const response = await axios.get(`${this.baseURL}/wp-json/wc/v3/orders`, {
                params: {
                    consumer_key: this.consumerKey,
                    consumer_secret: this.consumerSecret,
                    per_page: 1,
                    status: 'processing'
                },
                timeout: 30000
            });

            const totalProcessing = parseInt(response.headers['x-wp-total'] || '0');
            
            return {
                totalProcessing,
                lastCheck: this.lastCheck,
                isOnline: this.isOnline
            };
        } catch (error) {
            await logger.logError('Erro ao obter estatísticas do WooCommerce', error);
            return {
                totalProcessing: 0,
                lastCheck: this.lastCheck,
                isOnline: false
            };
        }
    }

    // Método para testar a conexão
    async testConnection() {
        try {
            const isConnected = await this.checkConnection();
            if (isConnected) {
                await logger.logSuccess('Teste de conexão WooCommerce: SUCESSO');
                return true;
            } else {
                await logger.logError('Teste de conexão WooCommerce: FALHOU');
                return false;
            }
        } catch (error) {
            await logger.logError('Teste de conexão WooCommerce: ERRO', error);
            return false;
        }
    }

    isServiceOnline() {
        return this.isOnline;
    }

    getLastCheck() {
        return this.lastCheck;
    }
}

module.exports = new WooCommerceService();
