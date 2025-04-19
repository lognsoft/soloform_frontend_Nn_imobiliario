// server.js
const express    = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const cors       = require('cors');

const app = express();

// Permite requisições do front‑end
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));

// Configure aqui com seu e‑mail e a senha de app gerada no Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'brunobafilli@gmail.com',
    pass: 'vhjjqhowmmqsanly'     // <-- os 16 caracteres EXATOS, sem espaços
  }
});

// Verifica credenciais ao iniciar
transporter.verify(err => {
  if (err) {
    console.error('Falha na autenticação SMTP:', err);
  } else {
    console.log('SMTP autenticado com sucesso! 🚀');
  }
});

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
    console.log('E‑mail enviado para:', emails);
    res.json({ success: true });
  } catch (err) {
    console.error('Erro ao enviar e‑mail:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
