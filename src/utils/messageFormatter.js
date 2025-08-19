class MessageFormatter {
    static formatPedidoMessage(pedido) {
        try {
            const mensagem = `🆕 NOVO PEDIDO PAGO! | 👤 Cliente: ${pedido.cliente.nome} | 🧾 Subtotal: R$ ${pedido.subtotal.toFixed(2)} | 🚚 Frete: R$ ${pedido.frete.toFixed(2)} | 💰 Total: R$ ${pedido.total.toFixed(2)} | 🚚 Entrega: ${pedido.metodoEnvio} | 💳 Pagamento: ${pedido.metodoPagamento} | ✅ Pedido confirmado e pronto para processamento

📦 Produtos:
${pedido.getProdutosFormatados()}

📍 Endereço de Entrega:
${pedido.getEnderecoFormatado()}`;

            return mensagem;
        } catch (error) {
            console.error('❌ Erro ao formatar mensagem do pedido:', error);
            return '❌ Erro ao formatar mensagem do pedido';
        }
    }

    static formatErrorMessage(tipo, mensagem) {
        const timestamp = new Date().toLocaleString('pt-BR');
        
        switch (tipo) {
            case 'woocommerce':
                return `⚠️ ALERTA DO SISTEMA ⚠️

A API do WooCommerce está indisponível, mande uma mensagem para o Samuel que ele resolve já! 😎

📅 Data/Hora: ${timestamp}
🔍 Detalhes: ${mensagem}`;

            case 'database':
                return `⚠️ ALERTA DO SISTEMA ⚠️

O banco de dados está offline, mande uma mensagem para o Samuel que ele resolve já! 😎

📅 Data/Hora: ${timestamp}
🔍 Detalhes: ${mensagem}`;

            case 'whatsapp':
                return `⚠️ ALERTA DO SISTEMA ⚠️

A API do WhatsApp está com problemas, mande uma mensagem para o Samuel que ele resolve já! 😎

📅 Data/Hora: ${timestamp}
🔍 Detalhes: ${mensagem}`;

            default:
                return `⚠️ ALERTA DO SISTEMA ⚠️

${mensagem}

📅 Data/Hora: ${timestamp}`;
        }
    }

    static formatSystemStatus(status) {
        const timestamp = new Date().toLocaleString('pt-BR');
        
        return `📊 STATUS DO SISTEMA

✅ WooCommerce: ${status.woocommerce ? 'Online' : 'Offline'}
✅ Banco de Dados: ${status.database ? 'Online' : 'Offline'}
✅ WhatsApp: ${status.whatsapp ? 'Online' : 'Offline'}
📦 Pedidos Pendentes: ${status.pedidosPendentes}
🔄 Última Verificação: ${status.ultimaVerificacao}

📅 Data/Hora: ${timestamp}`;
    }

    static formatRetryMessage(pedido, tentativa) {
        return `🔄 TENTATIVA DE REENVIO

📦 Pedido: #${pedido.numero}
👤 Cliente: ${pedido.cliente.nome}
🔄 Tentativa: ${tentativa}
⏰ Horário: ${new Date().toLocaleString('pt-BR')}

${this.formatPedidoMessage(pedido)}`;
    }
}

module.exports = MessageFormatter;
