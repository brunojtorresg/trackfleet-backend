const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const SECRET_KEY = 'trackfleet-secret-2025'; // Em produção, use variável de ambiente

/// ... (parte superior do arquivo)

// 🚨 CORREÇÃO FINAL DO CORS: 
// Aceita qualquer subdomínio do Vercel (*.vercel.app) e a URL do Render.
const whitelist = [
    'https://trackfleet-backend.onrender.com', // Opcional, para testes diretos
    /.*\.vercel\.app$/ // Expressão regular para aceitar qualquer subdomínio.vercel.app
];

const corsOptions = {
    origin: (origin, callback) => {
        // Permite requisições sem 'origin' (ex: ferramentas como Postman ou requisições de servidor para servidor)
        if (!origin || whitelist.some(pattern => {
            if (typeof pattern === 'string') {
                return pattern === origin;
            }
            return pattern.test(origin);
        })) {
            callback(null, true);
        } else {
            callback(new Error('Não permitido por CORS'));
        }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
};


// ...

// Middleware
app.use(cors(corsOptions)); // Aplica a nova configuração de CORS flexível
app.use(express.json());

// ... (resto do arquivo)
app.use(express.json());

// --- Funções de Manipulação de Dados ---

// Garantir arquivos
const garantirArquivo = (filePath) => {
    if (!fs.existsSync(filePath)) {
        fs.mkdirSync(path.dirname(filePath), { recursive: true });
        // Adicionando um usuário inicial se o arquivo for criado do zero
        if (filePath === USERS_FILE) {
             const usuariosIniciais = [{ 
                email: "testador@trackfleet.com", 
                senha: "senhaforte" 
             }];
             fs.writeFileSync(filePath, JSON.stringify(usuariosIniciais, null, 2));
        } else {
             fs.writeFileSync(filePath, JSON.stringify([], null, 2));
        }
    }
};
garantirArquivo(DATA_FILE);
garantirArquivo(USERS_FILE); // Garante que o users.json existe com um usuário de teste

// Leitura/Escrita de Frota
const lerFrota = () => {
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};
const salvarFrota = (dados) => {
    fs.writeFileSync(DATA_FILE, JSON.stringify(dados, null, 2));
};

// Leitura/Escrita de Usuários
const lerUsuarios = () => {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        return [];
    }
};
const salvarUsuarios = (dados) => {
    fs.writeFileSync(USERS_FILE, JSON.stringify(dados, null, 2));
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

// --- ROTAS PÚBLICAS (NÃO PRECISAM DE TOKEN) ---

// Rota de cadastro (NOVA ROTA)
app.post('/register', (req, res) => {
    const { email, senha } = req.body;
    if (!email || !senha) {
        return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
    }

    const usuarios = lerUsuarios();
    if (usuarios.find(u => u.email === email)) {
        return res.status(409).json({ erro: 'Usuário já cadastrado' });
    }

    // Nota: Em um ambiente real, a senha deve ser hasheada (ex: bcrypt)
    const novoUsuario = { email, senha }; 
    usuarios.push(novoUsuario);
    salvarUsuarios(usuarios);

    res.status(201).json({ mensagem: 'Cadastro bem-sucedido. Faça login.' });
});

// Rota de login (AGORA LÊ DO users.json)
app.post('/login', (req, res) => {
    const { email, senha } = req.body;
    const usuarios = lerUsuarios();
    const usuarioEncontrado = usuarios.find(u => u.email === email && u.senha === senha);

    if (usuarioEncontrado) {
        const token = jwt.sign({ email }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, mensagem: 'Login bem-sucedido' });
    } else {
        res.status(401).json({ erro: 'Credenciais inválidas' });
    }
});

// --- ROTAS PROTEGIDAS (PRECISAM DE TOKEN) ---

app.get('/frota', autenticar, (req, res) => {
    res.json(lerFrota());
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

    const frota = lerFrota();
    frota.push(novo);
    salvarFrota(frota);
    res.status(201).json(novo);
});

app.put('/frota/:id', autenticar, (req, res) => {
    const { status, localizacao } = req.body;
    const frota = lerFrota();
    const index = frota.findIndex(v => v.id === req.params.id);

    if (index === -1) return res.status(404).json({ erro: 'Não encontrado' });

    if (status && ['parado', 'em rota', 'entregue'].includes(status)) {
        frota[index].status = status;
    }
    if (localizacao) frota[index].localizacao = localizacao;

    salvarFrota(frota);
    res.json(frota[index]);
});

app.listen(PORT, () => {
    console.log(`Backend rodando em http://localhost:${PORT}`);
});