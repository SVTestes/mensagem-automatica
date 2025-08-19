# 🚀 Sistema de Mensagens Automáticas

Sistema automatizado para verificação de pedidos WooCommerce e envio de mensagens via WhatsApp Business API.

## ✨ Funcionalidades

- 🔍 **Verificação automática** a cada 15 minutos da API WooCommerce
- 📦 **Filtro inteligente** por pedidos com status "Processando"
- 🗄️ **Banco PostgreSQL** para controle de pedidos já processados
- 📱 **Integração WhatsApp** com fila de pedidos pendentes
- 🚨 **Alertas automáticos** para problemas críticos
- 📊 **Monitoramento em tempo real** via endpoints HTTP
- 🔄 **Sistema de retry** para mensagens falhadas
- 🧹 **Limpeza automática** de dados antigos

## 🏗️ Arquitetura

```
mensagem-automatica/
├── src/
│   ├── index.js              # Sistema principal
│   ├── config/
│   │   └── database.js       # Configuração do banco
│   ├── services/
│   │   ├── woocommerce.js    # Integração WooCommerce
│   │   ├── whatsapp.js       # API WhatsApp Business
│   │   └── database.js       # Operações do banco
│   ├── models/
│   │   └── pedido.js         # Modelo de pedido
│   └── utils/
│       ├── messageFormatter.js # Formatação de mensagens
│       └── logger.js         # Sistema de logs
├── database/
│   └── schema.sql            # Schema do banco
└── package.json
```

## 🚀 Instalação

### 1. Clone o repositório
```bash
git clone <url-do-repositorio>
cd mensagem-automatica
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure as variáveis de ambiente
Copie o arquivo `env.example` para `.env` e configure:

```bash
cp env.example .env
```

## ⚙️ Configuração

### Variáveis de Ambiente

#### WooCommerce (Já configurado)
```env
WOOCOMMERCE_URL=https://pharmaceuticasl.com.br
WOOCOMMERCE_CONSUMER_KEY=ck_a2b768b5214250da85f33688b0b85065572ef992
WOOCOMMERCE_CONSUMER_SECRET=cs_b9e93719d0ad3db080a1c65ef811c3f92e9bf3b9
```

#### WhatsApp Business API (Configurar quando tiver as credenciais)
```env
WHATSAPP_API_URL=https://graph.facebook.com
WHATSAPP_ACCESS_TOKEN=seu_token_aqui
WHATSAPP_PHONE_NUMBER_ID=seu_phone_number_id
WHATSAPP_TARGET_PHONE=numero_destino_com_codigo_pais
```

#### Banco de Dados PostgreSQL
```env
# Para Railway (recomendado)
DATABASE_URL=postgresql://username:password@host:port/database

# Ou configurações individuais
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mensagem_automatica
DB_USER=postgres
DB_PASSWORD=password
```

#### Sistema
```env
CHECK_INTERVAL_MINUTES=15
MAX_ORDERS_TO_CHECK=10
PORT=3000
```

## 🗄️ Banco de Dados

### 1. Crie o banco PostgreSQL
```sql
CREATE DATABASE mensagem_automatica;
```

### 2. Execute o schema
```bash
psql -d mensagem_automatica -f database/schema.sql
```

### Tabelas criadas:
- `pedidos_processados` - Pedidos já enviados
- `pedidos_pendentes` - Fila de pedidos aguardando envio
- `logs_sistema` - Logs de operações e erros

## 🚀 Execução

### Desenvolvimento
```bash
npm run dev
```

### Produção
```bash
npm start
```

## 📱 Endpoints da API

### Health Check
```http
GET /health
```
Status geral do sistema e serviços.

### Status do Sistema
```http
GET /status
```
Estatísticas detalhadas e status dos serviços.

### Verificação Manual
```http
POST /check-now
```
Força verificação imediata de novos pedidos.

### Teste WhatsApp
```http
POST /test-whatsapp
```
Envia mensagem de teste via WhatsApp.

### Processar Fila
```http
POST /process-queue
```
Processa manualmente a fila de pedidos pendentes.

## 🔄 Funcionamento

### 1. **Verificação Automática**
- Sistema verifica WooCommerce a cada 15 minutos
- Busca últimos 10 pedidos com status "Processando"
- Filtra duplicatas no banco de dados

### 2. **Processamento de Pedidos**
- Cria mensagem formatada para cada pedido
- Envia via WhatsApp Business API
- Marca como processado no banco

### 3. **Sistema de Fila**
- Se WhatsApp falhar, pedido vai para fila de pendentes
- Sistema tenta reenviar a cada 5 minutos
- Máximo de 5 tentativas por pedido

### 4. **Tratamento de Erros**
- **WooCommerce offline**: Alerta via WhatsApp
- **Banco offline**: Alerta via WhatsApp
- **WhatsApp offline**: Para busca de novos pedidos, mantém fila

## 📋 Formato da Mensagem

```
🆕 NOVO PEDIDO PAGO! | 👤 Cliente: [Nome] | 🧾 Subtotal: R$ [Valor] | 🚚 Frete: R$ [Valor] | 💰 Total: R$ [Valor] | 🚚 Entrega: [Método] | 💳 Pagamento: [Método] | ✅ Pedido confirmado e pronto para processamento

📦 Produtos:
• [Produto] - Qtd: [Quantidade] - R$ [Total]

📍 Endereço de Entrega:
[Endereço completo]
```

## 🚀 Deploy no Railway

### 1. **Conecte seu repositório**
- Faça push para GitHub/GitLab
- Conecte no Railway

### 2. **Configure variáveis de ambiente**
- `DATABASE_URL` - URL do PostgreSQL do Railway
- `WOOCOMMERCE_*` - Credenciais WooCommerce
- `WHATSAPP_*` - Credenciais WhatsApp (quando tiver)

### 3. **Deploy automático**
- Railway detecta `package.json` e `src/index.js`
- Instala dependências automaticamente
- Executa `npm start`

## 📊 Monitoramento

### Logs em Tempo Real
```bash
# Railway
railway logs

# Local
npm run dev
```

### Métricas via API
```bash
# Status geral
curl http://localhost:3000/health

# Estatísticas detalhadas
curl http://localhost:3000/status
```

## 🛠️ Manutenção

### Limpeza Automática
- **Logs**: Mantém últimos 1000 registros
- **Pedidos**: Remove pedidos com mais de 30 dias
- **Execução**: Diariamente às 2h da manhã

### Backup do Banco
```bash
# Backup completo
pg_dump mensagem_automatica > backup.sql

# Restore
psql mensagem_automatica < backup.sql
```

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. **WooCommerce offline**
- Verifique credenciais da API
- Confirme se o site está funcionando
- Teste endpoint: `/wp-json/wc/v3/products`

#### 2. **Banco de dados offline**
- Verifique `DATABASE_URL` no Railway
- Confirme se o PostgreSQL está rodando
- Teste conexão manual

#### 3. **WhatsApp não envia**
- Aguarde credenciais da API
- Verifique formato do número de telefone
- Confirme permissões da API

#### 4. **Pedidos não aparecem**
- Verifique status dos pedidos no WooCommerce
- Confirme se estão como "Processing"
- Teste endpoint: `/wp-json/wc/v3/orders`

## 📞 Suporte

Para problemas técnicos, entre em contato com o **Samuel** via WhatsApp! 😎

## 📄 Licença

MIT License - Use livremente para fins comerciais e pessoais.

---

**🚀 Sistema pronto para produção! Só aguardando as credenciais da API do WhatsApp Business para funcionar 100%!**
