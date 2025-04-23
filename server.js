const express    = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');

const app = express();
const dataPath = path.join(__dirname, 'data', 'mercado.json');

// servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '15mb' }));

// configurar SMTP
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'brunobafilli@gmail.com',
    pass: 'vhjjqhowmmqsanly'
  }
});
transporter.verify(err => {
  if (err) console.error('✖ SMTP falhou:', err);
  else     console.log('✔ SMTP autenticado com sucesso!');
});

// GET dados de mercado
app.get('/api/mercado', (req, res) => {
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Não foi possível ler dados de mercado.' });
    try {
      return res.json(JSON.parse(content));
    } catch {
      return res.status(500).json({ error: 'JSON inválido em mercado.json.' });
    }
  });
});

// POST grava respostas + telefone
app.post('/api/mercado', (req, res) => {
  const { nome, email, telefone, respostas } = req.body;
  if (!nome || !email || !telefone || !Array.isArray(respostas)) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler mercado.json.' });
    let data;
    try { data = JSON.parse(content); }
    catch { return res.status(500).json({ error: 'JSON corrompido em mercado.json.' }); }

    const nextId = data.respostasMercado.reduce((max, itm) => Math.max(max, itm.id), 0) + 1;
    data.respostasMercado.push({ id: nextId, nome, email, telefone, respostas });

    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) return res.status(500).json({ error: 'Falha ao gravar mercado.json.' });
      res.json({ success: true, id: nextId });
    });
  });
});

// POST enviar e-mail com gráfico e telefone
app.post('/enviar-grafico', async (req, res) => {
  const {
    imagem, emails,
    nome, emailEnvio, telefone,
    perguntas, alternativasPorPergunta, respostas
  } = req.body;

  if (!imagem || !imagem.includes('base64,')) {
    return res.status(400).json({ error: 'Imagem em base64 inválida.' });
  }

  // converter base64
  const base64Data = imagem.split('base64,')[1];
  let imgBuffer;
  try {
    imgBuffer = Buffer.from(base64Data, 'base64');
  } catch {
    return res.status(500).json({ error: 'Falha ao processar imagem.' });
  }

  // montar HTML do e-mail
  let html = `
    <h2>Resultado do Quiz</h2>
    <p><strong>Nome:</strong> ${nome}<br/>
       <strong>E-mail:</strong> ${emailEnvio}<br/>
       <strong>Telefone:</strong> ${telefone}</p>
    <hr/>
    <h3>Respostas:</h3>
    <ol>`;
  perguntas.forEach((p, i) => {
    const idx = respostas[i] - 1;
    const txt = alternativasPorPergunta[i][idx] || '—';
    html += `<li><p><strong>${p}</strong><br/>${txt}</p></li>`;
  });
  html += '</ol>';

  
  const mailOptions = {
    from: 'brunobafilli@gmail.com',
    to: 'brunobafilli@gmail.com',
    bcc: [
      'rogerio@solopropaganda.com.br',
      'mario@solopropaganda.com.br',
      'vinicius.vicente@solopropaganda.com.br'
    ],
    subject: 'Respostas do Quiz',
    html,
    attachments: [{
      filename: 'grafico.png',
      content: imgBuffer,
      contentType: 'image/png'
    }]
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error('✖ erro ao enviar e-mail:', err);
    res.status(500).json({ error: err.message });
  }
});

// rota principal
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
});
