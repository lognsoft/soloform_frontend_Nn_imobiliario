const express    = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');
const session    = require('express-session');

const app = express();
const dataPath = path.join(__dirname, 'data', 'mercado.json');

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '15mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

// 1) Habilita CORS
app.use(cors());

// configuração de sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'troqueEstaChave',
  resave: false,
  saveUninitialized: false
}));

// middleware que exige login
function checkAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/admin/login');
}

// Configuração SMTP
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

// Perguntas e alternativas (globais)
const perguntas = [
  '1. Seu lançamento já tem um posicionamento estratégico bem definido?',
  '2. Você já tem um conceito criativo ou campanha pensada para o produto?',
  '3. Seu plano de mídia já está estruturado?',
  '4. Você já sabe como vai gerar demanda qualificada para seu produto?',
  '5. Sua campanha está estruturada para trabalhar as etapas do funil de vendas?',
  '6. Sua equipe comercial está preparada com os materiais certos?',
  '7. Já pensaram em como engajar corretores e imobiliárias desde o início?',
  '8. Vocês possuem uma estratégia para gerar percepção de valor (não só preço)?',
  '9. Como está a sua preparação para criar desejo e visibilidade antes de abrir vendas?',
  '10. Qual a sua maior preocupação para o lançamento?'
];
const alternativasPorPergunta = [
  ['Sim, com diferenciais claros e um território de marca sólido','Não sei o que seria um posicionamento estratégico','Ainda não pensamos nisso','Estamos em processo de construção do posicionamento','Temos uma ideia, mas não formalizamos ainda'],
  ['Sim, com identidade visual e narrativa de marca alinhadas','Temos uma proposta visual, mas sem estratégia por trás','Estamos iniciando o desenvolvimento','Ainda não tratamos disso','Outra opção'],
  ['Sim, com canais e cronograma definidos para todas as fases','Temos uma ideia dos canais que usaremos','Estamos em fase de orçamentos e cotações','Ainda não começamos a planejar a mídia','Pretendemos resolver isso “mais perto” do lançamento'],
  ['Sim, temos uma estratégia clara de captação de leads','Pensamos em fazer campanhas digitais','Vamos depender dos corretores ou imobiliárias','Ainda estamos avaliando possibilidades','Não sabemos exatamente como funciona isso'],
  ['Sim, com ações pensadas para cada momento da jornada','Ainda estamos construindo essa régua de comunicação','Pretendemos focar mais no impacto inicial','Não estamos pensando no funil, mas apenas em “vender”','Não sabemos como estruturar isso'],
  ['Sim, com book, apresentações, roteiros e apoio digital','Temos apenas tabela e planta','Estamos desenvolvendo o kit comercial ainda','Vamos deixar com as imobiliárias','Ainda não pensamos nessa etapa'],
  ['Sim, com campanhas de incentivo, eventos e comissões agressivas','Vamos fazer um meeting ou evento de lançamento','Vamos contar com o relacionamento de praxe','Ainda não pensamos em ações específicas','Não sei se isso é relevante nessa fase'],
  ['Sim, vamos destacar atributos como localização, conceito, diferenciais construtivos','Pretendemos trabalhar os benefícios, mas o preço será o foco','Ainda estamos formatando essa proposta de valor','Não pensamos nisso como prioridade','Acreditamos que o preço por si só venderá'],
  ['Já estruturamos a campanha de pré-marketing e teasers','Vamos trabalhar redes sociais e lista de espera','Estamos pensando em mídia só para o lançamento','Ainda não definimos essa etapa','Não achamos necessário divulgar antes de lançar'],
  ['Gerar leads qualificados e com potencial real de compra','Comunicar valor e se destacar da concorrência','Ter uma régua de vendas com constância','Engajar os corretores de forma eficiente','Não saber por onde começar com a comunicação']
];

// POST /submit-quiz
app.post('/submit-quiz', (req, res) => {
  const { nome, email, telefone, respostas } = req.body;
  if (!nome || !email || !telefone || !Array.isArray(respostas)) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); }
    catch { return res.status(500).json({ error: 'JSON corrompido.' }); }

    const nextId = data.respostasMercado.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    data.respostasMercado.push({
      id: nextId,
      nome,
      email,
      telefone,
      respostas,
      createdAt: new Date().toISOString(),
      checked: false
    });

    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) return res.status(500).json({ error: 'Falha ao gravar.' });

      const link = `${req.protocol}://${req.get('host')}/result/${nextId}`;

      // 1) E-mail para o Bruno (com perguntas e respostas completas como texto)
      transporter.sendMail({
        from: 'brunobafilli@gmail.com',
        to: 'brunobafilli@gmail.com',
        subject: `Novo envio de questionário (#${nextId})`,
        html: `
          <h2>Novo envio de questionário imobiliário (#${nextId})</h2>
          <p><strong>Nome:</strong> ${nome}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Telefone:</strong> ${telefone}</p>
          <p>
            <strong>Link para visualizar gráfico e detalhes:</strong><br/>
            <a href="${link}">${link}</a>
          </p>
        `
      }, errBruno => {
        if (errBruno) {
          console.error('Erro enviando e-mail para Bruno:', errBruno);
          return res.status(500).json({ error: 'Falha ao enviar e-mail interno.' });
        }

        // 2) E-mail de agradecimento ao cliente (sem alterações aqui)
        transporter.sendMail({
          from: 'brunobafilli@gmail.com',
          to: email,
          subject: 'Obrigado pelo seu envio!',
          html: `...`
        }, errCliente => {
          if (errCliente) {
            console.error('Erro enviando e-mail ao cliente:', errCliente);
            return res.status(500).json({ error: 'Falha ao enviar confirmação ao cliente.' });
          }
          res.json({ success: true, link });
        });
      });
    });
  });
});


// GET /result/:id
app.get('/result/:id', checkAuth, (req, res) => {
  const id = Number(req.params.id);
  const content = fs.readFileSync(dataPath, 'utf8');
  const data    = JSON.parse(content);
  const item    = data.respostasMercado.find(u => u.id === id);
  if (!item) return res.status(404).send('Resultado não encontrado.');


  console.log(item);

  // calcula média de mercado
const todas = data.respostasMercado.map(u => u.respostas);
const count = todas.length;
const media = count
  ? todas[0].map((_, i) =>
      todas.reduce((s, a) =>
        s + (typeof a[i] === 'number' ? a[i] : 0)
      , 0) / count
    )
  : Array(item.respostas.length).fill(0);

const respostasTexto = item.respostas.map((v, i) => {
  if (typeof v === 'number') {
    return alternativasPorPergunta[i][v - 1] || '—';
  } else if (typeof v === 'string') {
    return v;
  } else {
    // qualquer outro caso
    return '—';
  }
});

  

  const isChecked = item.checked === true;

  
res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Resultado do gráfico</title>

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- jsPDF -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <!-- Quill -->
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

  <style>
    body, html { margin:0; height:100%; font-family:sans-serif; position:relative; }
    .back-btn {
      top:1rem;
      left:1rem;
      background:#6c757d;
      color:#fff;
      border:none;
      padding:.5rem 1rem;
      border-radius:4px;
      cursor:pointer;
      font-size:1rem;
    }
    .attended {
      position:absolute; top:1rem; right:1rem;
      font-size:1rem;
    }
    .container { display:flex; height:100%; }
    .left {
      width:30%; min-width:280px; padding:1rem;
      overflow-y:auto; background:#f7f7f7;
      font-size:0.9rem; position:relative;
    }
    .right {
      flex:1; display:flex; flex-direction:column;
      align-items:center; justify-content:center;
      padding:1rem; background:#fff;
    }
    #chart-wrapper { width:600px; height:600px; }
    #myChart { width:100%; height:100%; }
    .buttons { margin-top:1rem; }
    .buttons button {
      margin-right:.5rem; padding:.5rem 1rem;
      font-size:1rem; cursor:pointer;
    }
    /* Modal */
    #replyModal {
      display:none; position:fixed; top:0; left:0;
      width:100%; height:100%; background:rgba(0,0,0,0.5);
      align-items:center; justify-content:center;
    }
    #replyModal .modal-content {
      background:#fff; padding:1rem; border-radius:4px;
      width:90%; max-width:500px;
    }
    #editor { height:200px; background:#fff; }
    .modal-content .actions {
      text-align:right; margin-top:1rem;
    }
    .modal-content .actions button {
      margin-left:.5rem;
    }
    #replySpinner { display:none; text-align:center; margin-top:1rem; }
  </style>
</head>
<body>

  <div class="attended">
    <label>
      <input type="checkbox" id="attendedCheckbox" ${isChecked ? 'checked' : ''}>
      Cliente atendido
    </label>
  </div>

  <div class="container">
    <div class="left">
      <!-- Atualizado: navega para /admin em vez de history.back() -->
      <button class="back-btn" onclick="window.location.href = window.location.origin + '/admin'">← Voltar</button>
      <h3>Seus Dados</h3>
      <p>
        <strong>Nome:</strong> ${item.nome}<br/>
        <strong>E-mail:</strong> ${item.email}<br/>
        <strong>Telefone:</strong> ${item.telefone}
      </p>

      <h3>Suas Respostas</h3>
      <ol style="padding-left:15px">
        ${
          perguntas.map((p, i) => `
            <li style="padding-bottom: 10px; list-style: none;">
              <strong>${p.replace(/^\d+\.\\s*/, '')}</strong><br/>
              ${respostasTexto[i]}
              <hr>
            </li>
          `).join('')
        }
      </ol>
    </div>

    <div class="right">
      <div id="chart-wrapper">
        <canvas id="myChart"></canvas>
      </div>
      <div class="buttons">
        <button id="downloadJpg">Baixar JPG</button>
        <button id="downloadPdf">Baixar PDF</button>
        <button id="btnReply">Enviar Resposta</button>
      </div>
    </div>
  </div>

  <div id="replyModal">
    <div class="modal-content">
      <p>
        <strong>De:</strong> brunobafilli@gmail.com<br/>
        <strong>Para:</strong> ${item.email}
      </p>
      <div id="editor"></div>
      <div id="replySpinner">
        <svg width="38" height="38" viewBox="0 0 38 38" stroke="#555">
          <g fill="none" fill-rule="evenodd">
            <g transform="translate(1 1)" stroke-width="2">
              <circle stroke-opacity=".3" cx="18" cy="18" r="18"/>
              <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform attributeName="transform" type="rotate"
                  from="0 18 18" to="360 18 18" dur="1s" repeatCount="indefinite"/>
              </path>
            </g>
          </g>
        </svg>
        <div>Enviando…</div>
      </div>
      <div class="actions">
        <button id="cancelReply">Cancelar</button>
        <button id="sendReply">Enviar</button>
      </div>
    </div>
  </div>

  <script>
    // plugin para fundo branco no Chart.js
    const bgWhite = {
      id: 'bg_white',
      beforeDraw(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    };

    // quebra de linha em labels longas
    function wrapLabel(text, maxLen) {
      const words = text.split(' '), lines = [''];
      words.forEach(w => {
        const last = lines[lines.length-1];
        if ((last + ' ' + w).trim().length > maxLen) lines.push(w);
        else lines[lines.length-1] = last ? last + ' ' + w : w;
      });
      return lines;
    }

    const rawLabels = ${JSON.stringify(perguntas)};
    const responses = ${JSON.stringify(item.respostas)};
    const mediaData  = ${JSON.stringify(media.map(v => +v.toFixed(1)))};
    const labels     = rawLabels.map(l => wrapLabel(l, 25));
    const ideal      = Array(labels.length).fill(5);

    // configura o radar chart
    const ctxChart = document.getElementById('myChart').getContext('2d');
    new Chart(ctxChart, {
      type: 'radar',
      data: {
        labels,
        datasets: [
          { label: 'Média Mercado', data: mediaData, borderWidth: 3, borderDash: [5,5] },
          { label: 'Ideal (5)', data: ideal, borderWidth: 2, borderDash: [7,3] },
          { label: 'Meus Dados', data: responses, borderWidth: 3 }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            min: 1,
            max: 5,
            ticks: { stepSize: 1, font: { size: 14 } },
            pointLabels: { font: { size: 12 }, padding: 10 }
          }
        },
        plugins: {
          bg_white: {},
          legend: { position: 'top', labels: { font: { size: 14 } } },
          title: { display: true, text: 'Comparativo', font: { size: 18 } }
        }
      },
      plugins: [ bgWhite ]
    });

    const canvas = document.getElementById('myChart');

    // download JPG
    document.getElementById('downloadJpg').onclick = () => {
      const a = document.createElement('a');
      a.href     = canvas.toDataURL('image/jpeg', 1.0);
      a.download = 'grafico.jpg';
      a.click();
    };

    // download PDF
    document.getElementById('downloadPdf').onclick = () => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({
        orientation:'landscape',
        unit:'px',
        format:[canvas.width, canvas.height]
      });
      pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);
      pdf.save('grafico.pdf');
    };

    // inicializa o Quill
    const quill = new Quill('#editor', {
      theme:'snow',
      modules:{ toolbar:[['bold','italic','underline'], [{ list:'bullet' },{ list:'ordered' }], ['link']] }
    });

    // abre/fecha modal
    document.getElementById('btnReply').onclick    = () => document.getElementById('replyModal').style.display = 'flex';
    document.getElementById('cancelReply').onclick = () => document.getElementById('replyModal').style.display = 'none';

    // envia a resposta
    document.getElementById('sendReply').onclick = async () => {
      const btnSend   = document.getElementById('sendReply');
      const btnCancel = document.getElementById('cancelReply');
      const spinner   = document.getElementById('replySpinner');

      if (!quill.getText().trim()) {
        return alert('Digite uma mensagem.');
      }

      quill.enable(false);
      btnSend.disabled   = true;
      btnCancel.disabled = true;
      spinner.style.display = 'block';

      const replyHtml = quill.root.innerHTML;
      const jpg       = canvas.toDataURL('image/jpeg', 1.0);
      const { jsPDF } = window.jspdf;
      const pdfDoc    = new jsPDF({
        orientation:'landscape',
        unit:'px',
        format:[canvas.width, canvas.height]
      });
      pdfDoc.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);
      const pdfData   = pdfDoc.output('datauristring');

      try {
        const res = await fetch(\`/reply/${item.id}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reply: replyHtml, jpg, pdf: pdfData }),
          credentials: 'include'
        });
        if (!res.ok) throw new Error('Envio falhou');
        alert('Resposta enviada com sucesso!');
        document.getElementById('replyModal').style.display = 'none';
      } catch (err) {
        alert('Erro ao enviar resposta.');
        console.error(err);
      } finally {
        spinner.style.display   = 'none';
        btnSend.disabled       = false;
        btnCancel.disabled     = false;
        quill.enable(true);
      }
    };

    // handler do checkbox de atendimento
    document.getElementById('attendedCheckbox').addEventListener('change', async (e) => {
      try {
        const res = await fetch(\`/result/${item.id}/check\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ checked: e.target.checked }),
          credentials: 'include'
        });
        if (!res.ok) throw new Error();
      } catch {
        alert('Erro ao atualizar status.');
        e.target.checked = !e.target.checked;
      }
    });
  </script>
</body>
</html>
`);
});

// POST /result/:id/check
app.post('/result/:id/check', checkAuth, (req, res) => {
  const id = Number(req.params.id);
  const { checked } = req.body;
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); }
    catch { return res.status(500).json({ error: 'JSON inválido.' }); }
    const record = data.respostasMercado.find(u => u.id === id);
    if (!record) return res.status(404).json({ error: 'Registro não encontrado.' });
    record.checked = !!checked;
    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) return res.status(500).json({ error: 'Falha ao gravar.' });
      res.json({ success: true });
    });
  });
});

// POST /reply/:id
app.post('/submit-quiz', (req, res) => {
  const { nome, email, telefone, respostas } = req.body;
  if (!nome || !email || !telefone || !Array.isArray(respostas)) {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }

  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); }
    catch { return res.status(500).json({ error: 'JSON corrompido.' }); }

    const nextId = data.respostasMercado.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    data.respostasMercado.push({
      id: nextId,
      nome,
      email,
      telefone,
      respostas,
      createdAt: new Date().toISOString(),
      checked: false
    });

    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) return res.status(500).json({ error: 'Falha ao gravar.' });

      const link = `${req.protocol}://${req.get('host')}/result/${nextId}`;

      // Converte respostas (índice ou texto) em texto legível
      const respostasTexto = respostas.map((v, i) => {
        if (typeof v === 'number')       return alternativasPorPergunta[i][v - 1] || '—';
        else if (typeof v === 'string')  return v;
        else                              return '—';
      });

      // 1) Envia o questionário completo para o e-mail preenchido pelo usuário
      transporter.sendMail({
        from:    'brunobafilli@gmail.com',
        to:      email,    // usa o e-mail que o usuário preencheu
        subject: `Novo envio de questionário imobiliário (#${nextId})`,
        html: `
          <h2>Novo envio de questionário imobiliário (#${nextId})</h2>
          <p><strong>Nome:</strong> ${nome}</p>
          <p><strong>E-mail:</strong> ${email}</p>
          <p><strong>Telefone:</strong> ${telefone}</p>
          <h3>Perguntas e Respostas:</h3>
          <ul>
            ${
              perguntas.map((p, i) => `
                <li style="list-style:none">
                  <strong>${p.replace(/^\d+\.\s*/, '')}</strong><br/>
                  Resposta: ${respostasTexto[i]}
                </li>
                <hr>
              `).join('')
            }
          </ul>
          <p>
            <strong>Link para visualizar gráfico e detalhes:</strong><br/>
            <a href="${link}">${link}</a>
          </p>
        `
      }, errEnvio => {
        if (errEnvio) {
          console.error('Erro enviando e-mail para o usuário:', errEnvio);
          return res.status(500).json({ error: 'Falha ao enviar e-mail.' });
        }

        // 2) Mensagem de agradecimento (opcional)
        transporter.sendMail({
          from:    'brunobafilli@gmail.com',
          to:      email,
          subject: 'Obrigado pelo seu envio!',
          html: `
            <h2>Olá ${nome},</h2>
            <p>Obrigado pelo seu envio! Em breve entraremos em contato.</p>
          `
        }, errAck => {
          if (errAck) {
            console.error('Erro enviando confirmação ao cliente:', errAck);
            return res.status(500).json({ error: 'Falha ao enviar confirmação.' });
          }
          res.json({ success: true, link });
        });
      });
    });
  });
});


// Rota de busca /api/search
app.get('/api/search', checkAuth, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); }
    catch { return res.status(500).json({ error: 'JSON inválido.' }); }

    const results = data.respostasMercado
      .filter(u =>
        (u.nome     || '').toLowerCase().includes(q) ||
        (u.email    || '').toLowerCase().includes(q) ||
        (u.telefone || '').includes(q)
      )
      .map(u => ({
        id:        u.id,
        nome:      u.nome,
        email:     u.email,
        telefone:  u.telefone,
        createdAt: u.createdAt || '-',
        checked:   !!u.checked   // ← e aqui também
      }))
    ;

    res.json(results);
  });
});
// Rota paginada /api/users
app.get('/api/users', checkAuth, (req, res) => {
  const page     = Math.max(1, parseInt(req.query.page)    || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize)|| 10);

  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); }
    catch { return res.status(500).json({ error: 'JSON inválido.' }); }

    const all = (data.respostasMercado || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const total      = all.length;
    const totalPages = Math.ceil(total / pageSize);
    const start      = (page - 1) * pageSize;

    const usersPage = all.slice(start, start + pageSize).map(u => ({
      id:        u.id,
      nome:      u.nome,
      email:     u.email,
      telefone:  u.telefone,
      createdAt: u.createdAt || '-',
      checked:   !!u.checked       // ← aqui incluímos o campo checked
    }));

    res.json({ page, pageSize, total, totalPages, users: usersPage });
  });
});

// formulário de login
app.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1"/>
      <title>Login Admin</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          font-family: sans-serif;
          background-color: #f0f2f5;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .login-container {
          background: #fff;
          padding: 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 360px;
        }
        .login-container h1 {
          font-size: 1.5rem;
          color: #333;
          margin-bottom: 1.5rem;
          text-align: center;
        }
        .login-container form {
          display: flex;
          flex-direction: column;
        }
        .login-container label {
          font-size: 1rem;
          color: #555;
          margin-bottom: 1rem;
        }
        .login-container input {
          margin-top: 0.5rem;
          padding: 0.5rem;
          font-size: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          width: 100%;
        }
        .login-container button {
          margin-top: 1.5rem;
          padding: 0.75rem;
          font-size: 1rem;
          background-color: #007bff;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .login-container button:hover {
          background-color: #0056b3;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h1>Área Administrativa</h1>
        <form action="/admin/login" method="POST">
          <label>
            Usuário
            <input type="text" name="username" required />
          </label>
          <label>
            Senha
            <input type="password" name="password" required />
          </label>
          <button type="submit">Entrar</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// validação de credenciais
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const ADMIN_USER = process.env.ADMIN_USER || 'admin';
  const ADMIN_PASS = process.env.ADMIN_PASS || 'admin@123';

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = username;
    return res.redirect('/admin');
  }

  res.send('Usuário ou senha inválidos. <a href="/admin/login">Tentar novamente</a>');
});

// logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login');
  });
});

// Rota admin
app.get('/admin', checkAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
