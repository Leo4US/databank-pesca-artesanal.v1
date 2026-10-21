
/*
 * ==========================================================
 * 26F.07B | LABORATORIO COM FILTROS CADASTRAIS
 * Research Studio | Pesca Artesanal
 *
 * Integra a interface existente com:
 * - Firebase Authentication;
 * - filtros cadastrais do CORE;
 * - frequencia e cruzamento integrados;
 * - resultados agregados e supressao;
 *
 * Preserva o funcionamento original de Explorar e Laboratorio.
 *
 * IMPORTANTE:
 * O token Firebase sera enviado ao servidor.
 * A API precisa verificar e autorizar esse token.
 * Este codigo nao substitui a autorizacao no backend.
 * ==========================================================
 */

import { initializeApp, getApps, getApp } from
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from
  "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

const CONFIG = {
  api: "https://pesca-analytics-api-v1-311761842391.southamerica-east1.run.app",

  firebase: {
    apiKey: "AIzaSyC77JxCZFJrrgA8twSNYke3VDXaqwiwrSE",
    authDomain: "databank-pesca-2026.firebaseapp.com",
    projectId: "databank-pesca-2026",
    appId: "1:311761842391:web:ae666a2a20f5a7cc04c092"
  },

  maxFiltros: 3
};

const CAMPOS = [
  { codigo: "uf", nome: "UF cadastral" },
  { codigo: "municipio_ibge", nome: "Município cadastral (IBGE)" },
  { codigo: "sexo", nome: "Sexo (código)" },
  { codigo: "estado_civil", nome: "Estado civil (código)" },
  { codigo: "nacionalidade", nome: "Nacionalidade (código)" },
  { codigo: "ocupacao_cbo", nome: "Ocupação (CBO)" }
];

const app = getApps().length
  ? getApp()
  : initializeApp(CONFIG.firebase);

const auth = getAuth(app);

const $ = id => document.getElementById(id);

let usuarioAtual = null;
let catalogoQuestoes = null;

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);
  if (texto) el.textContent = texto;
  if (classe) el.className = classe;
  return el;
}

function mensagem(texto) {
  const status = $("cadastro-status");
  if (status) status.textContent = texto;
}

function criarCampo() {
  const linha = elemento("div");
  linha.className = "funda-form-grid";
  linha.style.marginBottom = "0.75rem";
  linha.dataset.filtro = "true";

  const blocoCampo = elemento("div");
  const labelCampo = elemento("label", "Variável cadastral");
  const select = elemento("select");
  select.className = "cadastro-campo";

  for (const campo of CAMPOS) {
    const opcao = elemento("option", campo.nome);
    opcao.value = campo.codigo;
    select.appendChild(opcao);
  }

  blocoCampo.append(labelCampo, select);

  const blocoValor = elemento("div");
  const labelValor = elemento("label", "Código ou valor");
  const input = elemento("input");
  input.className = "cadastro-valor";
  input.type = "text";
  input.maxLength = 24;
  input.placeholder = "Ex.: BA, 2100907, F";
  input.autocomplete = "off";
  input.style.cssText = `
    width:100%;
    padding:.75rem;
    border:1px solid var(--border-accent);
    border-radius:7px;
    background:white;
  `;

  blocoValor.append(labelValor, input);

  const blocoAcao = elemento("div");
  blocoAcao.style.alignSelf = "end";

  const remover = elemento("button", "Remover");
  remover.type = "button";
  remover.className = "btn btn-secondary";
  remover.style.padding = ".75rem";

  remover.addEventListener("click", () => {
    linha.remove();
    atualizarLimite();
  });

  blocoAcao.appendChild(remover);

  linha.append(blocoCampo, blocoValor, blocoAcao);

  return linha;
}

function atualizarLimite() {
  const quantidade = document.querySelectorAll(
    "#cadastro-filtros [data-filtro]"
  ).length;

  $("cadastro-adicionar").disabled =
    quantidade >= CONFIG.maxFiltros;
}

function coletarFiltros() {
  const filtros = [];
  const nomes = new Set();

  for (const linha of document.querySelectorAll(
    "#cadastro-filtros [data-filtro]"
  )) {
    const campo = linha.querySelector(
      ".cadastro-campo"
    ).value;

    const valor = linha.querySelector(
      ".cadastro-valor"
    ).value.trim();

    if (!valor) {
      throw new Error(
        "Preencha o valor de cada filtro cadastral."
      );
    }

    if (nomes.has(campo)) {
      throw new Error(
        "Não repita a mesma variável cadastral."
      );
    }

    nomes.add(campo);
    filtros.push({ campo, valor });
  }

  return filtros;
}

function mostrarResultado(titulo, cabecalhos, linhas) {
  const destino = $("lab-resultado");
  destino.hidden = false;
  destino.replaceChildren();

  destino.appendChild(elemento("h3", titulo));

  const tabela = elemento("table");
  tabela.className = "funda-result-table";

  const thead = elemento("thead");
  const cabecalho = elemento("tr");

  for (const nome of cabecalhos) {
    cabecalho.appendChild(elemento("th", nome));
  }

  thead.appendChild(cabecalho);
  tabela.appendChild(thead);

  const tbody = elemento("tbody");

  for (const valores of linhas) {
    const tr = elemento("tr");

    for (const valor of valores) {
      tr.appendChild(elemento("td", String(valor)));
    }

    tbody.appendChild(tr);
  }

  tabela.appendChild(tbody);
  destino.appendChild(tabela);

  destino.appendChild(elemento(
    "p",
    "Fonte: PostgreSQL CORE. Respondentes distintos. " +
    "Resultados sujeitos à supressão de células pequenas. " +
    "Município e UF correspondem à localização cadastral, " +
    "não necessariamente ao local de pesca.",
    "funda-note"
  ));
}

function exibirErro(erro) {
  const destino = $("lab-resultado");

  destino.hidden = false;
  destino.replaceChildren();

  destino.appendChild(elemento(
    "p",
    erro.message,
    "funda-state"
  ));
}

function rotuloAlternativa(questao, codigo) {
  const item = catalogoQuestoes?.questoes?.find(
    q => q.codigo === questao
  );

  const alternativa = item?.alternativas?.find(
    a => a.codigo === codigo
  );

  return alternativa
    ? `${codigo} · ${alternativa.texto}`
    : codigo;
}

function formatarQuantidade(item) {
  if (item.suprimida || item.quantidade === null) {
    return "Suprimida";
  }

  return Number(item.quantidade).toLocaleString("pt-BR");
}

async function consultarIntegrado(filtros) {
  if (!usuarioAtual) {
    throw new Error(
      "Entre com sua conta para solicitar consultas cadastrais."
    );
  }

  const botao = $("lab-executar");
  const textoOriginal = botao.textContent;

  botao.disabled = true;
  botao.textContent = "Consultando o CORE...";

  try {
    const tipo = $("lab-tipo").value;
    const q1 = $("lab-q1").value;
    const q2 = $("lab-q2").value;

    const cruzamento = tipo === "cruzamento";

    const caminho = cruzamento
      ? "/consultas/integrada/cruzamento"
      : "/consultas/integrada/frequencia";

    const corpo = cruzamento
      ? { questao_1: q1, questao_2: q2, filtros }
      : { questao: q1, filtros };

    // Token da sessão Firebase.
    // Deve ser validado pelo backend antes da consulta.
    const token = await usuarioAtual.getIdToken();

    const resposta = await fetch(
      CONFIG.api + caminho,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(corpo)
      }
    );

    if (resposta.status === 401 ||
        resposta.status === 403) {
      throw new Error(
        "Consulta cadastral aguardando autorização " +
        "do servidor. O login não concede acesso " +
        "automaticamente."
      );
    }

    if (!resposta.ok) {
      throw new Error(
        `Consulta indisponível: HTTP ${resposta.status}`
      );
    }

    const dados = await resposta.json();

    if (!Array.isArray(dados.resultados)) {
      throw new Error(
        "A API retornou um formato inesperado."
      );
    }

    if (cruzamento) {
      mostrarResultado(
        `${q1} × ${q2} · Cruzamento cadastral`,
        [
          `${q1} · Alternativa`,
          `${q2} · Alternativa`,
          "Respondentes"
        ],
        dados.resultados.map(r => [
          rotuloAlternativa(q1, r.alternativa_1),
          rotuloAlternativa(q2, r.alternativa_2),
          formatarQuantidade(r)
        ])
      );
    } else {
      mostrarResultado(
        `${q1} · Frequência com filtros cadastrais`,
        ["Alternativa", "Respondentes"],
        dados.resultados.map(r => [
          rotuloAlternativa(q1, r.alternativa),
          formatarQuantidade(r)
        ])
      );
    }

  } finally {
    botao.disabled = false;
    botao.textContent = textoOriginal;
  }
}

function criarInterface() {
  const laboratorio = $("tab-laboratorio");
  const formulario = laboratorio?.querySelector(
    ".builder-container"
  );
  const grade = formulario?.querySelector(
    ".funda-form-grid"
  );

  if (!grade || $("cadastro-painel")) return;

  const painel = elemento("div");
  painel.id = "cadastro-painel";
  painel.style.cssText = `
    margin-top:1.5rem;
    padding:1.25rem;
    border:1px solid var(--border-subtle);
    border-radius:8px;
    background:var(--bg-subtle);
  `;

  painel.appendChild(elemento(
    "h3",
    "Filtros cadastrais",
  ));

  painel.appendChild(elemento(
    "p",
    "Combine até três características dos respondentes " +
    "com as questões selecionadas. Sem filtros, permanece " +
    "a consulta original do Laboratório.",
    "funda-note"
  ));

  const filtros = elemento("div");
  filtros.id = "cadastro-filtros";
  painel.appendChild(filtros);

  const adicionar = elemento(
    "button",
    "+ Adicionar filtro"
  );
  adicionar.id = "cadastro-adicionar";
  adicionar.type = "button";
  adicionar.className = "btn btn-secondary";

  adicionar.addEventListener("click", () => {
    filtros.appendChild(criarCampo());
    atualizarLimite();
  });

  painel.appendChild(adicionar);

  const acesso = elemento("div");
  acesso.style.marginTop = "1.5rem";

  acesso.appendChild(elemento(
    "h3",
    "Acesso do pesquisador"
  ));

  const botoes = elemento("div");
  botoes.style.cssText = `
    display:flex;
    flex-wrap:wrap;
    gap:.5rem;
    margin-top:.75rem;
  `;

  const entrarGoogle = elemento(
    "button",
    "Entrar com Google"
  );
  entrarGoogle.type = "button";
  entrarGoogle.className = "btn btn-primary";

  entrarGoogle.addEventListener("click", async () => {
    try {
      await signInWithPopup(
        auth, new GoogleAuthProvider()
      );
    } catch (erro) {
      mensagem("Falha na autenticação: " + erro.code);
    }
  });

  const sair = elemento("button", "Sair");
  sair.type = "button";
  sair.className = "btn btn-secondary";

  sair.addEventListener("click", async () => {
    await signOut(auth);
  });

  botoes.append(entrarGoogle, sair);
  acesso.appendChild(botoes);

  const email = elemento("input");
  email.id = "cadastro-email";
  email.type = "email";
  email.placeholder = "E-mail";
  email.autocomplete = "email";

  const senha = elemento("input");
  senha.id = "cadastro-senha";
  senha.type = "password";
  senha.placeholder = "Senha";
  senha.autocomplete = "current-password";

  for (const input of [email, senha]) {
    input.style.cssText = `
      width:100%;
      max-width:320px;
      padding:.65rem;
      margin:.5rem .5rem .5rem 0;
      border:1px solid var(--border-accent);
      border-radius:6px;
    `;
  }

  const entrarEmail = elemento(
    "button",
    "Entrar com e-mail"
  );
  entrarEmail.type = "button";
  entrarEmail.className = "btn btn-secondary";

  entrarEmail.addEventListener("click", async () => {
    try {
      await signInWithEmailAndPassword(
        auth, email.value.trim(), senha.value
      );
      senha.value = "";
    } catch (erro) {
      mensagem("Falha na autenticação: " + erro.code);
    }
  });

  acesso.append(email, senha, entrarEmail);

  const status = elemento(
    "p",
    "Verificando sessão...",
    "funda-note"
  );
  status.id = "cadastro-status";
  status.setAttribute("role", "status");

  acesso.appendChild(status);
  painel.appendChild(acesso);

  grade.insertAdjacentElement(
    "afterend", painel
  );

  onAuthStateChanged(auth, usuario => {
    usuarioAtual = usuario;

    mensagem(usuario
      ? `Autenticado: ${usuario.email || "Conta Google"}. ` +
        "Acesso aos dados sujeito à autorização do servidor."
      : "Não autenticado. Consultas sem filtros " +
        "continuam disponíveis."
    );
  });

  /*
   * O Laboratorio original ja possui um listener de clique.
   * Interceptamos somente consultas COM filtros, na fase
   * de captura. Consultas sem filtro seguem intactas.
   */
  $("lab-executar").addEventListener(
    "click",
    async evento => {
      const quantidade = document.querySelectorAll(
        "#cadastro-filtros [data-filtro]"
      ).length;

      if (quantidade === 0) return;

      evento.preventDefault();
      evento.stopImmediatePropagation();

      try {
        const selecionados = coletarFiltros();
        await consultarIntegrado(selecionados);
      } catch (erro) {
        exibirErro(erro);
      }
    },
    true
  );
}

async function iniciar() {
  try {
    const resposta = await fetch(
      "./data/questoes_alternativas.json",
      { cache: "no-store" }
    );

    if (resposta.ok) {
      catalogoQuestoes = await resposta.json();
    }
  } catch (_) {
    // Os codigos continuam disponiveis mesmo sem rotulos.
  }

  criarInterface();
}

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded", iniciar
  );
} else {
  iniciar();
}
