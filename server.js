// server.js
const express    = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');

const app = express();
const dataPath = path.join(__dirname, 'data', 'mercado.json');

app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '15mb' }));  
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'brunobafilli@gmail.com',
    pass: 'vhjjqhowmmqsanly'
  }
});
transporter.verify(err => {
  if (err) console.error('✖ SMTP auth failed:', err);
  else      console.log('✔ SMTP autenticado com sucesso!');
});

app.get('/api/mercado', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Não foi possível ler dados de mercado.' });
    try {
      res.json(JSON.parse(content));
    } catch {
      res.status(500).json({ error: 'JSON inválido em mercado.json.' });
    }
  });
});

app.post('/api/mercado', (req, res) => {
  const { nome, email, respostas } = req.body;
  if (typeof nome !== 'string' || !nome.trim()) {
    return res.status(400).json({ success: false, error: 'Nome inválido.' });
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'E-mail inválido.' });
  }
  if (!Array.isArray(respostas)) {
    return res.status(400).json({ success: false, error: 'Formato de respostas inválido.' });
  }

  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ success: false, error: 'Erro ao ler mercado.json.' });
    let data;
    try { data = JSON.parse(content); }
    catch {
      return res.status(500).json({ success: false, error: 'JSON corrompido em mercado.json.' });
    }
    const nextId = data.respostasMercado.reduce((max, item) => Math.max(max, item.id), 0) + 1;
    data.respostasMercado.push({ id: nextId, nome, email, respostas });
    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) {
        return res.status(500).json({ success: false, error: 'Falha ao gravar mercado.json.' });
      }
      res.json({ success: true, id: nextId });
    });
  });
});

app.post('/enviar-grafico', async (req, res) => {
  const {
    imagem,
    emails,
    nome,
    emailEnvio,
    perguntas,
    alternativasPorPergunta,
    respostas
  } = req.body;

  if (typeof imagem !== 'string' || !imagem.includes('base64,')) {
    console.error('❌ payload.imagem inválido:', imagem);
    return res.status(400).json({ success: false, error: 'Imagem em base64 não fornecida ou inválida.' });
  }

  const parts = imagem.split('base64,');
  const base64Data = parts[1];
  let imgBuffer;
  try {
    imgBuffer = Buffer.from(base64Data, 'base64');
  } catch (e) {
    console.error('❌ erro ao converter base64 em Buffer:', e);
    return res.status(500).json({ success: false, error: 'Falha interna ao processar imagem.' });
  }

  let html = `
    <h2>Resultado do Quiz</h2>
    <p><strong>Nome:</strong> ${nome}<br/>
       <strong>E-mail:</strong> ${emailEnvio}</p>
    <hr/>
    <h3>Respostas:</h3>
    <ol>
  `;
  perguntas.forEach((pergunta, i) => {
    const idx = respostas[i] - 1;
    const texto = alternativasPorPergunta[i][idx] || '—';
    html += `
      <li>
        <p><strong>${pergunta}</strong><br/>
          ${texto}
        </p>
      </li>
    `;
  });
  html += `</ol>`;

  const mailOptions = {
    from:    'brunobafilli@gmail.com',
    to:      emails[0],
    bcc:     emails.slice(1).join(','),
    subject: 'Seu Radar Chart + Respostas do Quiz',
    html,
    attachments: [{
      filename:    'grafico.png',
      content:     imgBuffer,
      contentType: 'image/png'
    }]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error('✖ erro ao enviar e-mail:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
});
