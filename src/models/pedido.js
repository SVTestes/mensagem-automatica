class Pedido {
    constructor(data) {
        this.id = data.id;
        this.numero = data.number || data.id;
        this.status = data.status;
        this.total = parseFloat(data.total) || 0;
        this.subtotal = parseFloat(data.subtotal) || 0;
        this.frete = parseFloat(data.shipping_total) || 0;
        this.metodoPagamento = data.payment_method_title || 'Não informado';
        this.metodoEnvio = data.shipping_lines?.[0]?.method_title || 'Não informado';
        this.cliente = this.extractClienteInfo(data);
        this.produtos = this.extractProdutosInfo(data);
        this.endereco = this.extractEnderecoInfo(data);
        this.dataCriacao = new Date(data.date_created);
    }

    extractClienteInfo(data) {
        if (data.billing) {
            return {
                nome: data.billing.first_name + ' ' + data.billing.last_name,
                email: data.billing.email,
                telefone: data.billing.phone
            };
        }
        return {
            nome: 'Cliente não informado',
            email: 'Email não informado',
            telefone: 'Telefone não informado'
        };
    }

    extractProdutosInfo(data) {
        if (!data.line_items || !Array.isArray(data.line_items)) {
            return [];
        }

        return data.line_items.map(item => ({
            nome: item.name,
            quantidade: item.quantity,
            preco: parseFloat(item.price) || 0,
            total: parseFloat(item.total) || 0
        }));
    }

    extractEnderecoInfo(data) {
        if (data.shipping) {
            const endereco = data.shipping;
            return {
                endereco1: endereco.address_1 || '',
                endereco2: endereco.address_2 || '',
                cidade: endereco.city || '',
                estado: endereco.state || '',
                cep: endereco.postcode || '',
                pais: endereco.country || ''
            };
        }
        return {
            endereco1: 'Endereço não informado',
            endereco2: '',
            cidade: 'Cidade não informada',
            estado: 'Estado não informado',
            cep: 'CEP não informado',
            pais: 'País não informado'
        };
    }

    isProcessando() {
        const statusProcessando = ['processing', 'processando'];
        return statusProcessando.includes(this.status.toLowerCase());
    }

    toJSON() {
        return {
            id: this.id,
            numero: this.numero,
            status: this.status,
            total: this.total,
            subtotal: this.subtotal,
            frete: this.frete,
            metodoPagamento: this.metodoPagamento,
            metodoEnvio: this.metodoEnvio,
            cliente: this.cliente,
            produtos: this.produtos,
            endereco: this.endereco,
            dataCriacao: this.dataCriacao
        };
    }

    // Método para formatar endereço para exibição
    getEnderecoFormatado() {
        const end = this.endereco;
        const partes = [
            end.endereco1,
            end.endereco2,
            end.cidade,
            end.estado,
            end.cep,
            end.pais
        ].filter(parte => parte && parte !== 'Endereço não informado' && parte !== 'Cidade não informada' && parte !== 'Estado não informado' && parte !== 'CEP não informado' && parte !== 'País não informado');

        return partes.join(', ');
    }

    // Método para formatar produtos para exibição
    getProdutosFormatados() {
        if (this.produtos.length === 0) {
            return 'Produtos não informados';
        }

        return this.produtos.map(produto => 
            `• ${produto.nome} - Qtd: ${produto.quantidade} - R$ ${produto.total.toFixed(2)}`
        ).join('\n');
    }
}

module.exports = Pedido;
