const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'trackfleet-secret-2025'; // Em produção, use variável de ambiente
const DATA_FILE = path.join(__dirname, 'data', 'frota.json');

// Middleware
app.use(cors());
app.use(express.json());

// Garantir arquivo
if (!fs.existsSync(DATA_FILE)) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Funções de dados
const lerDados = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    return [];
  }
};

const salvarDados = (dados) => {
  fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
};

// Usuário fixo (em produção: use banco de dados)
const USUARIO_VALIDO = {
  email: 'admin@trackfleet.com',
  senha: 'admin123'
};

// Middleware de autenticação
const autenticar = (req, res, next) => {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ erro: 'Token inválido' });
    req.user = decoded;
    next();
  });
};

// Rota de login
app.post('/login', (req, res) => {
  const { email, senha } = req.body;
  if (email === USUARIO_VALIDO.email && senha === USUARIO_VALIDO.senha) {
    const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '24h' });
    res.json({ token, mensagem: 'Login bem-sucedido' });
  } else {
    res.status(401).json({ erro: 'Credenciais inválidas' });
  }
});

// Rotas protegidas
app.get('/frota', autenticar, (req, res) => {
  res.json(lerDados());
});

app.post('/frota', autenticar, (req, res) => {
  const { placa, motorista, destino, localizacao } = req.body;
  if (!placa || !motorista || !destino) {
    return res.status(400).json({ erro: 'Campos obrigatórios' });
  }

  const novo = {
    id: Date.now().toString(),
    placa: placa.toUpperCase(),
    motorista,
    destino,
    localizacao: localizacao || 'Não informada',
    status: 'parado'
  };

  const frota = lerDados();
  frota.push(novo);
  salvarDados(frota);
  res.status(201).json(novo);
});

app.put('/frota/:id', autenticar, (req, res) => {
  const { status, localizacao } = req.body;
  const frota = lerDados();
  const index = frota.findIndex(v => v.id === req.params.id);

  if (index === -1) return res.status(404).json({ erro: 'Não encontrado' });

  if (status && ['parado', 'em rota', 'entregue'].includes(status)) {
    frota[index].status = status;
  }
  if (localizacao) frota[index].localizacao = localizacao;

  salvarDados(frota);
  res.json(frota[index]);
});

app.listen(PORT, () => {
  console.log(`Backend rodando em http://localhost:${PORT}`);
});