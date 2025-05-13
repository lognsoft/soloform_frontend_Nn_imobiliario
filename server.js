const express    = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const fs         = require('fs');
const path       = require('path');

const app = express();
const dataPath = path.join(__dirname, 'data', 'mercado.json');

// Servir arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json({ limit: '15mb' }));

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
    data.respostasMercado.push({ id: nextId, nome, email, telefone, respostas, createdAt: new Date().toISOString() });
    fs.writeFile(dataPath, JSON.stringify(data, null, 2), 'utf8', writeErr => {
      if (writeErr) return res.status(500).json({ error: 'Falha ao gravar.' });
      const link = `${req.protocol}://${req.get('host')}/result/${nextId}`;
      transporter.sendMail({
        from: 'brunobafilli@gmail.com',
        to: email,
        subject: 'Seu resultado do Quiz',
        html: `<h2>Olá ${nome},</h2><p>Seu quiz foi recebido!<br/><a href="${link}">Clique aqui para ver seu gráfico</a>.</p>`
      }, errMail => {
        if (errMail) return res.status(500).json({ error: 'Falha ao enviar e-mail.' });
        res.json({ success: true, link });
      });
    });
  });
});

// GET /result/:id (exibe gráfico, downloads e botão de resposta)
// GET /result/:id (exibe gráfico, downloads e botão de resposta com Quill)
app.get('/result/:id', (req, res) => {
  const id = Number(req.params.id);
  const content = fs.readFileSync(dataPath, 'utf8');
  const data    = JSON.parse(content);
  const item    = data.respostasMercado.find(u => u.id === id);
  if (!item) return res.status(404).send('Resultado não encontrado.');

  // calcula média de mercado
  const todas = data.respostasMercado.map(u => u.respostas);
  const count = todas.length;
  const media = count
    ? todas[0].map((_, i) => todas.reduce((s, a) => s + (a[i]||0), 0) / count)
    : Array(item.respostas.length).fill(0);

  // texto das respostas
  const respostasTexto = item.respostas.map((v, i) =>
    alternativasPorPergunta[i][v-1] || '—'
  );

  // renderiza HTML
  res.send(`
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Resultado do Quiz</title>

  <!-- Chart.js -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <!-- jsPDF -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
  <!-- Quill -->
  <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
  <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>

  <style>
    body, html { margin:0; height:100%; font-family:sans-serif; }
    .container { display:flex; height:100%; }
    .left {
      width:30%; min-width:280px;
      padding:1rem; overflow-y:auto;
      background:#f7f7f7; font-size:0.9rem;
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
      width:100%; height:100%;
      background:rgba(0,0,0,0.5);
      align-items:center; justify-content:center;
    }
    #replyModal .modal-content {
      background:#fff; padding:1rem;
      border-radius:4px; width:90%; max-width:500px;
    }
    #editor { height:200px; background:#fff; }
    .modal-content .actions {
      text-align:right; margin-top:1rem;
    }
    .modal-content .actions button {
      margin-left:.5rem;
    }
    /* Spinner */
    #replySpinner {
      display:none;
      text-align:center;
      margin-top:1rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="left">
      <h3>Seus Dados</h3>
      <p>
        <strong>Nome:</strong> ${item.nome}<br/>
        <strong>E-mail:</strong> ${item.email}<br/>
        <strong>Telefone:</strong> ${item.telefone}
      </p>
      <h3>Suas Respostas</h3>
      <ol style ="padding-left: 15px">
        ${perguntas.map((p,i)=>
          `<ol style="padding: 0px; margin-top:10px;"><strong>${p}</strong><br/>${respostasTexto[i]}</ol>`
        ).join('')}
      </ol>
    </div>
    <div class="right">
      <div id="chart-wrapper"><canvas id="myChart"></canvas></div>
      <div class="buttons">
        <button id="downloadJpg">Baixar JPG</button>
        <button id="downloadPdf">Baixar PDF</button>
        <button id="btnReply">Enviar Resposta</button>
      </div>
    </div>
  </div>

  <!-- Modal de resposta -->
  <div id="replyModal">
    <div class="modal-content">
      <p><strong>De:</strong> brunobafilli@gmail.com<br/><strong>Para:</strong> ${item.email}</p>
      <div id="editor"></div>
      <!-- Spinner -->
      <div id="replySpinner">
        <svg width="38" height="38" viewBox="0 0 38 38" stroke="#555">
          <g fill="none" fill-rule="evenodd">
            <g transform="translate(1 1)" stroke-width="2">
              <circle stroke-opacity=".3" cx="18" cy="18" r="18"/>
              <path d="M36 18c0-9.94-8.06-18-18-18">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 18 18"
                  to="360 18 18"
                  dur="1s"
                  repeatCount="indefinite"/>
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
    // Plugin fundo branco Chart.js
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

    // Wrap labels
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
    const mediaData  = ${JSON.stringify(media.map(v=>+v.toFixed(1)))};
    const labels = rawLabels.map(l=>wrapLabel(l,25)), ideal = Array(labels.length).fill(5);

    // Chart.js Radar
    const ctxChart = document.getElementById('myChart').getContext('2d');
    new Chart(ctxChart, {
      type:'radar',
      data:{ labels, datasets:[
        { label:'Média Mercado', data:mediaData, borderWidth:3, borderDash:[5,5] },
        { label:'Ideal (5)',     data:ideal,     borderWidth:2, borderDash:[7,3] },
        { label:'Meus Dados',    data:responses, borderWidth:3 }
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        scales:{ r:{
          min:1,max:5,
          ticks:{stepSize:1,font:{size:14}},
          pointLabels:{font:{size:12},padding:10}
        }},
        plugins:{ bg_white:{}, legend:{position:'top',labels:{font:{size:14}}}, title:{display:true,text:'Comparativo',font:{size:18}}}
      },
      plugins:[bgWhite]
    });

    const canvas = document.getElementById('myChart');

    // Downloads
    document.getElementById('downloadJpg').onclick = () => {
      const a = document.createElement('a');
      a.href     = canvas.toDataURL('image/jpeg',1.0);
      a.download = 'grafico.jpg';
      a.click();
    };
    document.getElementById('downloadPdf').onclick = () => {
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF({ orientation:'landscape', unit:'px', format:[canvas.width,canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);
      pdf.save('grafico.pdf');
    };

    // Quill
    const quill = new Quill('#editor',{ theme:'snow', modules:{ toolbar:[['bold','italic','underline'],[{list:'bullet'},{list:'ordered'}],['link']] } });

    // Modal controls
    document.getElementById('btnReply').onclick    = () => document.getElementById('replyModal').style.display = 'flex';
    document.getElementById('cancelReply').onclick = () => document.getElementById('replyModal').style.display = 'none';

    // Enviar com spinner e bloqueio do editor
    document.getElementById('sendReply').onclick = async () => {
      const btnSend   = document.getElementById('sendReply');
      const btnCancel = document.getElementById('cancelReply');
      const spinner   = document.getElementById('replySpinner');

      if (quill.getText().trim().length === 0) return alert('Digite uma mensagem.');

      // bloqueia editor e botões, mostra spinner
      quill.enable(false);
      btnSend.disabled   = true;
      btnCancel.disabled = true;
      spinner.style.display = 'block';

      const replyHtml = quill.root.innerHTML;
      const jpg       = canvas.toDataURL('image/jpeg',1.0);
      const { jsPDF } = window.jspdf;
      const pdfDoc    = new jsPDF({ orientation:'landscape', unit:'px', format:[canvas.width,canvas.height] });
      pdfDoc.addImage(canvas.toDataURL('image/png'),'PNG',0,0,canvas.width,canvas.height);
      const pdfData   = pdfDoc.output('datauristring');

      try {
        const res = await fetch('/reply/${item.id}', {
          method:'POST',
          headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ reply:replyHtml, jpg, pdf:pdfData })
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
  </script>
</body>
</html>
`);




});


// POST /reply/:id
app.post('/reply/:id', (req, res) => {
  const id = Number(req.params.id);
  const { reply, jpg, pdf } = req.body;
  const data = JSON.parse(fs.readFileSync(dataPath,'utf8'));
  const user = data.respostasMercado.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });
  let html = `<h2>Resposta ao seu Quiz</h2><p>${reply}</p><hr/><h3>Seus Dados</h3><p><strong>Nome:</strong> ${user.nome}<br/><strong>E-mail:</strong> ${user.email}<br/><strong>Telefone:</strong> ${user.telefone}</p><h3>Suas Respostas</h3><ol>`;
  user.respostas.forEach((v,i) => {
    const txt = alternativasPorPergunta[i][v-1] || '—';
    html += `<li><strong>${perguntas[i]}</strong><br/>${txt}</li>`;
  });
  html += '</ol>';
  const attachments = [
    { filename: 'grafico.jpg', content: Buffer.from(jpg.split('base64,')[1], 'base64') },
    { filename: 'grafico.pdf', content: Buffer.from(pdf.split('base64,')[1], 'base64') }
  ];
  transporter.sendMail({
    from: 'brunobafilli@gmail.com',
    to: user.email,
    subject: 'Resposta ao seu Quiz',
    html,
    attachments
  }, err => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Falha ao enviar e-mail.' });
    }
    res.json({ success: true });
  });
});

// Rotas search, users, admin, raiz invariadas...

// Rota de busca /api/search
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); } catch { return res.status(500).json({ error: 'JSON inválido.' }); }
    const results = data.respostasMercado.filter(u => {
      return (u.nome || '').toLowerCase().includes(q) ||
             (u.email || '').toLowerCase().includes(q) ||
             (u.telefone || '').includes(q);
    }).map(u => ({ id: u.id, nome: u.nome, email: u.email, telefone: u.telefone, createdAt: u.createdAt || '-' }));
    res.json(results);
  });
});

// Rota paginada /api/users
app.get('/api/users', (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const pageSize = Math.max(1, parseInt(req.query.pageSize) || 10);
  fs.readFile(dataPath, 'utf8', (err, content) => {
    if (err) return res.status(500).json({ error: 'Erro ao ler dados.' });
    let data;
    try { data = JSON.parse(content); } catch { return res.status(500).json({ error: 'JSON inválido.' }); }
    const all = (data.respostasMercado || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    const total = all.length;
    const totalPages = Math.ceil(total / pageSize);
    const start = (page - 1) * pageSize;
    const usersPage = all.slice(start, start + pageSize).map(u => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      telefone: u.telefone,
      createdAt: u.createdAt || '-'
    }));
    res.json({ page, pageSize, total, totalPages, users: usersPage });
  });
});

// Rota admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Raiz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando em http://localhost:${PORT}`));
