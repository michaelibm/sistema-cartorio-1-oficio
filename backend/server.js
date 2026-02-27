const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
const authRoutes = require('./routes/auth');
const protocoloRoutes = require('./routes/protocolos');
const servicoRoutes = require('./routes/servicos');
const funcionarioRoutes = require('./routes/funcionarios');
const relatorioRoutes = require('./routes/relatorios');
const feriadoRoutes = require('./routes/feriados');
const statusRoutes = require('./routes/status-routes');

// ✅ ADICIONAR ROTA DE ALERTAS
const alertasRoutes = require('./routes/alertas-routes');

// ✅ PAINEL PÚBLICO (sem autenticação)
const painelRoutes = require('./routes/painel');

app.use('/api/auth', authRoutes);
app.use('/api/protocolos', protocoloRoutes);
app.use('/api/servicos', servicoRoutes);
app.use('/api/funcionarios', funcionarioRoutes);
app.use('/api/relatorios', relatorioRoutes);
app.use('/api/feriados', feriadoRoutes);
app.use('/api/status', statusRoutes);

// ✅ REGISTRAR ROTA DE ALERTAS
app.use('/api/alertas', alertasRoutes);

// ✅ REGISTRAR PAINEL PÚBLICO
app.use('/api/painel', painelRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor rodando' });
});

const PORT = process.env.PORT || 5000;

// ✅ IMPORTAR E INICIAR SISTEMA DE ALERTAS
const { iniciarAlertasAutomaticos } = require('./services/alertas-cron');

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  
  // ✅ INICIAR CRON JOBS DE ALERTAS
  console.log('🔔 Iniciando sistema de alertas automáticos...');
  iniciarAlertasAutomaticos();
});

module.exports = app;
