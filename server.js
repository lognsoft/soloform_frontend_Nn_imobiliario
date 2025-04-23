// server.js
const express    = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');

const app = express();

// caminho para o JSON de mercado
const dataPath = path.join(__dirname, 'data', 'mercado.json');

// middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '10mb' }));

// configura Nodemailer (Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'brunobafilli@gmail.com',
    pass: 'vhjjqhowmmqsanly'
  }
});
transporter.verify(err => {
  if (err) console.error('❌ SMTP auth failed:', err);
  else      console.log('✅ SMTP autenticado com sucesso! 🚀');
});

// rota GET para ler o JSON
app.get('/api/mercado', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Não foi possível ler dados de mercado.' });
    try {
      const data = JSON.parse(content);
      res.json(data);
    } catch {
      res.status(500).json({ error: 'JSON inválido.' });
    }
  });
});

// rota POST para gravar nova resposta
// 6) Rota POST /api/mercado para registrar respostas + e-mail
app.post('/api/mercado', (req, res) => {
  const { respostas, email } = req.body;

  // validações básicas
  if (!Array.isArray(respostas)) {
    return res.status(400).json({ success: false, error: 'Formato de respostas inválido.' });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'E-mail inválido.' });
  }

  // lê o JSON atual
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ success: false, error: 'Erro ao ler mercado.json.' });

    let data;
    try {
      data = JSON.parse(content);
    } catch {
      return res.status(500).json({ success: false, error: 'mercado.json com JSON inválido.' });
    }

    // calcula novo ID e empurra novo objeto
    const nextId = data.respostasMercado.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    data.respostasMercado.push({
      id: nextId,
      email,           // <— aqui!
      respostas
    });

    // regrava o arquivo com identação de 2 espaços
    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) {
        return res.status(500).json({ success: false, error: 'Falha ao gravar mercado.json.' });
      }
      res.json({ success: true, id: nextId });
    });
  });
});

// endpoint de envio de gráfico
app.post('/enviar-grafico', async (req, res) => {
  const { imagem, emails } = req.body;
  const base64Data = imagem.split('base64,')[1];
  const mailOptions = {
    from: 'brunobafilli@gmail.com',
    to:   emails.join(','),
    subject: 'Resultado do Radar Chart',
    html:    '<p>Olá! Segue em anexo o gráfico de comparativo.</p>',
    attachments: [{
      filename: 'grafico.png',
      content:  base64Data,
      encoding: 'base64'
    }]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// rota raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
});
