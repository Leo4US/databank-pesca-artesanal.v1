
/*
============================================================
26F.08A | LABORATORIO CADASTRAL + LOGIN GLOBAL
BANCO DE DADOS FUNDACENTRO E PRODUCOES
============================================================

OBJETIVOS

1. Preservar frequencias e cruzamentos do Laboratorio.
2. Manter filtros cadastrais integrados ao CORE.
3. Mover o login Firebase para o menu superior direito.
4. Exibir usuario autenticado e permitir encerrar sessao.
5. Evitar execucao duplicada das consultas.
6. Preservar o HTML original e as abas existentes.

ESTADO ATUAL

Esta versao conserva a entrada manual de valores cadastrais.
Os seletores dinamicos e o construtor multigrupo serao
implementados na proxima etapa, apos ampliar a API.

Nenhum identificador individual e exibido.
============================================================
*/

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";


/* ==========================================================
   01 | CONFIGURACOES EXISTENTES
   ========================================================== */

const CONFIG = {
  api: (
    "https://pesca-analytics-api-v1-" +
    "311761842391.southamerica-east1.run.app"
  ),

  firebase: {
    apiKey: "AIzaSyC77JxCZFJrrgA8twSNYke3VDXaqwiwrSE",
    authDomain: "databank-pesca-2026.firebaseapp.com",
    projectId: "databank-pesca-2026",
    appId: "1:311761842391:web:ae666a2a20f5a7cc04c092"
  },

  maxFiltros: 3
};

const CAMPOS = [
  {
    codigo: "uf",
    nome: "Estado cadastral (UF)"
  },
  {
    codigo: "municipio_ibge",
    nome: "Município cadastral (IBGE)"
  },
  {
    codigo: "sexo",
    nome: "Sexo"
  },
  {
    codigo: "estado_civil",
    nome: "Estado civil"
  },
  {
    codigo: "nacionalidade",
    nome: "Nacionalidade"
  },
  {
    codigo: "ocupacao_cbo",
    nome: "Ocupação CBO"
  }
];

const firebaseApp = getApps().length
  ? getApp()
  : initializeApp(CONFIG.firebase);

const auth = getAuth(firebaseApp);

const $ = id => document.getElementById(id);

let usuarioAtual = null;
let catalogoQuestoes = null;
let menuAberto = false;


/* ==========================================================
   02 | UTILITARIOS DE INTERFACE
   ========================================================== */

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);

  if (texto) {
    el.textContent = texto;
  }

  if (classe) {
    el.className = classe;
  }

  return el;
}

function emitirStatus(texto) {
  const status = $("conta-status");

  if (status) {
    status.textContent = texto;
  }
}

function criarBotao(texto, classe) {
  const botao = elemento("button", texto, classe);
  botao.type = "button";
  return botao;
}

function criarEntrada(tipo, placeholder, id) {
  const entrada = elemento("input");

  entrada.type = tipo;
  entrada.placeholder = placeholder;
  entrada.id = id;

  entrada.style.cssText = `
    width:100%;
    padding:.75rem;
    border:1px solid #CBD5E1;
    border-radius:7px;
    background:#FFFFFF;
    color:#0F172A;
    font-size:.88rem;
  `;

  return entrada;
}


/* ==========================================================
   03 | MENU GLOBAL DE AUTENTICACAO
   ========================================================== */

function posicionarMenu() {
  const menu = $("conta-menu");
  const ancora = $("nav-login");

  if (!menu || !ancora) return;

  const posicao = ancora.getBoundingClientRect();

  const largura = Math.min(
    360,
    window.innerWidth - 24
  );

  const esquerda = Math.max(
    12,
    Math.min(
      window.innerWidth - largura - 12,
      posicao.right - largura
    )
  );

  menu.style.width = `${largura}px`;
  menu.style.left = `${esquerda}px`;
  menu.style.top = `${posicao.bottom + 12}px`;
}

function abrirMenu() {
  const menu = $("conta-menu");

  if (!menu) return;

  menu.hidden = false;
  menuAberto = true;

  posicionarMenu();

  $("nav-login")?.setAttribute(
    "aria-expanded",
    "true"
  );
}

function fecharMenu() {
  const menu = $("conta-menu");

  if (!menu) return;

  menu.hidden = true;
  menuAberto = false;

  $("nav-login")?.setAttribute(
    "aria-expanded",
    "false"
  );
}

function alternarMenu() {
  if (menuAberto) {
    fecharMenu();
  } else {
    abrirMenu();
  }
}

function atualizarEstadoConta() {
  const link = $("nav-login");
  const identidade = $("conta-identidade");
  const blocoLogin = $("conta-formulario");
  const blocoSair = $("conta-sair-container");

  if (usuarioAtual) {
    if (link) {
      link.textContent = "Minha conta";
      link.title = usuarioAtual.email || "Conta conectada";
    }

    if (identidade) {
      identidade.textContent = (
        "Conectado: " +
        (usuarioAtual.email || "Conta Firebase")
      );
    }

    if (blocoLogin) {
      blocoLogin.hidden = true;
    }

    if (blocoSair) {
      blocoSair.hidden = false;
    }

    emitirStatus(
      "Sessão Firebase ativa. As consultas cadastrais " +
      "dependem também da autorização do servidor."
    );

  } else {
    if (link) {
      link.textContent = "Entrar";
      link.title = "Entrar no Research Studio";
    }

    if (identidade) {
      identidade.textContent = "Visitante";
    }

    if (blocoLogin) {
      blocoLogin.hidden = false;
    }

    if (blocoSair) {
      blocoSair.hidden = true;
    }

    emitirStatus(
      "Entre com uma conta autorizada para " +
      "executar consultas cadastrais."
    );
  }
}

function criarMenuConta() {
  const ancora = $("nav-login");

  if (!ancora || $("conta-menu")) {
    return;
  }

  /*
   * O link Entrar ja existe no cabecalho do index.html.
   * Reutilizamos esse link, sem criar outro menu.
   *
   * A captura impede a navegacao para o antigo
   * formulario simulado de login.
   */

  ancora.removeAttribute("onclick");
  ancora.setAttribute("aria-haspopup", "dialog");
  ancora.setAttribute("aria-expanded", "false");

  ancora.addEventListener(
    "click",
    evento => {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      alternarMenu();
    },
    true
  );

  const menu = elemento("div");
  menu.id = "conta-menu";
  menu.hidden = true;

  menu.setAttribute("role", "dialog");
  menu.setAttribute(
    "aria-label",
    "Acesso do pesquisador"
  );

  menu.style.cssText = `
    position:fixed;
    z-index:10000;
    width:360px;
    max-width:calc(100vw - 24px);
    padding:1.3rem;
    border:1px solid #E2E0D2;
    border-radius:12px;
    background:#FFFFFF;
    color:#0F172A;
    box-shadow:0 14px 42px rgba(15,23,42,.18);
    max-height:calc(100vh - 100px);
    overflow-y:auto;
  `;

  const titulo = elemento(
    "h3",
    "Acesso do pesquisador"
  );

  titulo.style.cssText = `
    font-size:1.05rem;
    margin-bottom:.5rem;
  `;

  const identidade = elemento(
    "p",
    "Verificando sessão..."
  );

  identidade.id = "conta-identidade";
  identidade.style.cssText = `
    font-size:.83rem;
    color:#475569;
    margin-bottom:1rem;
    overflow-wrap:anywhere;
  `;

  menu.append(titulo, identidade);

  /*
   * Formulario exibido somente para visitantes.
   */
  const formulario = elemento("div");
  formulario.id = "conta-formulario";

  const entrarGoogle = criarBotao(
    "Entrar com Google",
    "btn btn-primary"
  );

  entrarGoogle.style.cssText = `
    width:100%;
    justify-content:center;
    margin-bottom:1rem;
  `;

  entrarGoogle.addEventListener(
    "click",
    async () => {
      entrarGoogle.disabled = true;

      try {
        await signInWithPopup(
          auth,
          new GoogleAuthProvider()
        );

        fecharMenu();

      } catch (erro) {
        emitirStatus(
          "Falha no login Google: " +
          (erro.code || "erro desconhecido")
        );

      } finally {
        entrarGoogle.disabled = false;
      }
    }
  );

  const email = criarEntrada(
    "email",
    "E-mail",
    "conta-email"
  );

  email.autocomplete = "email";

  const senha = criarEntrada(
    "password",
    "Senha",
    "conta-senha"
  );

  senha.autocomplete = "current-password";

  const entrarEmail = criarBotao(
    "Entrar com e-mail",
    "btn btn-secondary"
  );

  entrarEmail.style.cssText = `
    width:100%;
    justify-content:center;
  `;

  entrarEmail.addEventListener(
    "click",
    async () => {
      entrarEmail.disabled = true;

      try {
        await signInWithEmailAndPassword(
          auth,
          email.value.trim(),
          senha.value
        );

        senha.value = "";
        fecharMenu();

      } catch (erro) {
        emitirStatus(
          "Falha no login por e-mail: " +
          (erro.code || "erro desconhecido")
        );

      } finally {
        entrarEmail.disabled = false;
      }
    }
  );

  const campos = elemento("div");

  campos.style.cssText = `
    display:grid;
    gap:.7rem;
    margin-bottom:.8rem;
  `;

  campos.append(email, senha);

  formulario.append(
    entrarGoogle,
    campos,
    entrarEmail
  );

  menu.appendChild(formulario);

  /*
   * Opcao de saida para usuarios autenticados.
   */
  const sairContainer = elemento("div");
  sairContainer.id = "conta-sair-container";
  sairContainer.hidden = true;

  const sair = criarBotao(
    "Sair da conta",
    "btn btn-secondary"
  );

  sair.style.cssText = `
    width:100%;
    justify-content:center;
  `;

  sair.addEventListener(
    "click",
    async () => {
      try {
        await signOut(auth);
        fecharMenu();

      } catch (erro) {
        emitirStatus(
          "Não foi possível encerrar a sessão."
        );
      }
    }
  );

  sairContainer.appendChild(sair);
  menu.appendChild(sairContainer);

  const status = elemento(
    "p",
    "Verificando autenticação..."
  );

  status.id = "conta-status";
  status.setAttribute("role", "status");

  status.style.cssText = `
    margin-top:1rem;
    font-size:.77rem;
    color:#64748B;
    line-height:1.5;
  `;

  menu.appendChild(status);

  document.body.appendChild(menu);

  /*
   * Fecha o menu ao clicar fora ou pressionar Escape.
   */
  document.addEventListener(
    "click",
    evento => {
      if (!menuAberto) return;

      if (
        menu.contains(evento.target) ||
        ancora.contains(evento.target)
      ) {
        return;
      }

      fecharMenu();
    }
  );

  document.addEventListener(
    "keydown",
    evento => {
      if (evento.key === "Escape") {
        fecharMenu();
      }
    }
  );

  window.addEventListener(
    "resize",
    () => {
      if (menuAberto) {
        posicionarMenu();
      }
    }
  );

  window.addEventListener(
    "scroll",
    () => {
      if (menuAberto) {
        posicionarMenu();
      }
    },
    { passive: true }
  );

  onAuthStateChanged(
    auth,
    usuario => {
      usuarioAtual = usuario;
      atualizarEstadoConta();
    }
  );
}


/* ==========================================================
   04 | FILTROS CADASTRAIS NO LABORATORIO
   ========================================================== */

function criarCampo() {
  const linha = elemento("div");

  linha.className = "funda-form-grid";
  linha.dataset.filtro = "true";

  linha.style.cssText = `
    margin-bottom:.75rem;
    align-items:end;
  `;

  const blocoCampo = elemento("div");

  const labelCampo = elemento(
    "label",
    "Variável cadastral"
  );

  const select = elemento("select");
  select.className = "cadastro-campo";

  for (const campo of CAMPOS) {
    const opcao = elemento(
      "option",
      campo.nome
    );

    opcao.value = campo.codigo;
    select.appendChild(opcao);
  }

  blocoCampo.append(
    labelCampo,
    select
  );

  const blocoValor = elemento("div");

  const labelValor = elemento(
    "label",
    "Valor"
  );

  const valor = criarEntrada(
    "text",
    "Ex.: F, MA ou código IBGE",
    ""
  );

  valor.className = "cadastro-valor";
  valor.maxLength = 24;
  valor.autocomplete = "off";

  blocoValor.append(
    labelValor,
    valor
  );

  const blocoAcao = elemento("div");

  const remover = criarBotao(
    "Remover",
    "btn btn-secondary"
  );

  remover.style.cssText = `
    padding:.75rem;
  `;

  remover.addEventListener(
    "click",
    () => {
      linha.remove();
      atualizarLimite();
    }
  );

  blocoAcao.appendChild(remover);

  linha.append(
    blocoCampo,
    blocoValor,
    blocoAcao
  );

  return linha;
}

function atualizarLimite() {
  const adicionar = $("cadastro-adicionar");

  if (!adicionar) return;

  const quantidade = document.querySelectorAll(
    "#cadastro-filtros [data-filtro]"
  ).length;

  adicionar.disabled = (
    quantidade >= CONFIG.maxFiltros
  );
}

function coletarFiltros() {
  const filtros = [];
  const nomes = new Set();

  const linhas = document.querySelectorAll(
    "#cadastro-filtros [data-filtro]"
  );

  for (const linha of linhas) {
    const campo = linha.querySelector(
      ".cadastro-campo"
    ).value;

    const valor = linha.querySelector(
      ".cadastro-valor"
    ).value.trim();

    if (!valor) {
      throw new Error(
        "Selecione ou preencha o valor do filtro."
      );
    }

    /*
     * Na versao atual, filtros diferentes
     * sao combinados por E.
     *
     * A comparacao da mesma variavel entre grupos
     * sera implementada no construtor 26F.08B.
     */
    if (nomes.has(campo)) {
      throw new Error(
        "Para comparar categorias da mesma variável, " +
        "utilizaremos os grupos comparativos da " +
        "próxima versão do Laboratório."
      );
    }

    nomes.add(campo);
    filtros.push({
      campo,
      valor
    });
  }

  return filtros;
}


/* ==========================================================
   05 | CATALOGO DAS QUESTOES
   ========================================================== */

function obterQuestao(codigo) {
  return catalogoQuestoes?.questoes?.find(
    questao => questao.codigo === codigo
  );
}

function rotuloAlternativa(
  codigoQuestao,
  codigoAlternativa
) {
  const questao = obterQuestao(
    codigoQuestao
  );

  const alternativa = questao?.alternativas?.find(
    item => item.codigo === codigoAlternativa
  );

  if (!alternativa) {
    return codigoAlternativa;
  }

  return (
    codigoAlternativa +
    " · " +
    alternativa.texto
  );
}


/* ==========================================================
   06 | RESULTADOS ANALITICOS
   ========================================================== */

function formatarQuantidade(item) {
  if (
    item.suprimida ||
    item.quantidade === null ||
    item.quantidade === undefined
  ) {
    return "Suprimida";
  }

  return Number(
    item.quantidade
  ).toLocaleString("pt-BR");
}

function mostrarResultado(
  titulo,
  cabecalhos,
  linhas,
  filtros
) {
  const destino = $("lab-resultado");

  if (!destino) return;

  destino.hidden = false;
  destino.replaceChildren();

  destino.appendChild(
    elemento("h3", titulo)
  );

  /*
   * Exibe o recorte cadastral utilizado.
   * Nao apresenta o resultado como se representasse
   * automaticamente o universo total da pesquisa.
   */
  const resumo = elemento(
    "p",
    filtros.length
      ? (
          "Filtros aplicados: " +
          filtros.map(
            item => `${item.campo} = ${item.valor}`
          ).join(" E ")
        )
      : "Sem filtros cadastrais",
    "funda-note"
  );

  destino.appendChild(resumo);

  const tabela = elemento("table");
  tabela.className = "funda-result-table";

  const thead = elemento("thead");
  const cabecalho = elemento("tr");

  for (const nome of cabecalhos) {
    cabecalho.appendChild(
      elemento("th", nome)
    );
  }

  thead.appendChild(cabecalho);
  tabela.appendChild(thead);

  const tbody = elemento("tbody");

  for (const valores of linhas) {
    const tr = elemento("tr");

    for (const valor of valores) {
      tr.appendChild(
        elemento(
          "td",
          String(valor)
        )
      );
    }

    tbody.appendChild(tr);
  }

  tabela.appendChild(tbody);
  destino.appendChild(tabela);

  destino.appendChild(
    elemento(
      "p",
      (
        "Fonte: PostgreSQL CORE via API Cloud Run. " +
        "Contagens por respondentes distintos. " +
        "Células pequenas podem ser suprimidas. " +
        "Município e UF referem-se ao cadastro, " +
        "não necessariamente ao local da pesca. " +
        "A referência geral e os denominadores " +
        "comparáveis serão incorporados ao " +
        "construtor multigrupo."
      ),
      "funda-note"
    )
  );
}

function exibirErro(erro) {
  const destino = $("lab-resultado");

  if (!destino) return;

  destino.hidden = false;
  destino.replaceChildren();

  destino.appendChild(
    elemento(
      "p",
      erro.message,
      "funda-state"
    )
  );
}


/* ==========================================================
   07 | CONSULTAS AUTENTICADAS AO CORE
   ========================================================== */

async function consultarIntegrado(filtros) {
  if (!usuarioAtual) {
    throw new Error(
      "Entre pela opção Minha conta, no canto " +
      "superior direito, para consultar dados cadastrais."
    );
  }

  const botao = $("lab-executar");
  const textoAnterior = botao.textContent;

  botao.disabled = true;
  botao.textContent = "Consultando o CORE...";

  try {
    const cruzamento = (
      $("lab-tipo").value === "cruzamento"
    );

    const q1 = $("lab-q1").value;
    const q2 = $("lab-q2").value;

    const caminho = cruzamento
      ? "/consultas/integrada/cruzamento"
      : "/consultas/integrada/frequencia";

    const corpo = cruzamento
      ? {
          questao_1: q1,
          questao_2: q2,
          filtros
        }
      : {
          questao: q1,
          filtros
        };

    /*
     * O Firebase ID Token e obtido da sessao ativa.
     * O servidor valida assinatura, identidade e
     * autorizacao do pesquisador.
     */
    const token = await usuarioAtual.getIdToken();

    const resposta = await fetch(
      CONFIG.api + caminho,
      {
        method: "POST",
        cache: "no-store",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(corpo)
      }
    );

    if (
      resposta.status === 401 ||
      resposta.status === 403
    ) {
      throw new Error(
        "Consulta não autorizada. Verifique sua " +
        "sessão em Minha conta ou a lista de " +
        "pesquisadores autorizados."
      );
    }

    if (!resposta.ok) {
      throw new Error(
        "Consulta indisponível: HTTP " +
        resposta.status
      );
    }

    const dados = await resposta.json();

    if (!Array.isArray(dados.resultados)) {
      throw new Error(
        "A API retornou um formato inesperado."
      );
    }

    if (cruzamento) {
      const linhas = dados.resultados.map(
        item => [
          rotuloAlternativa(
            q1,
            item.alternativa_1
          ),
          rotuloAlternativa(
            q2,
            item.alternativa_2
          ),
          formatarQuantidade(item)
        ]
      );

      mostrarResultado(
        `${q1} × ${q2} · Cruzamento cadastral`,
        [
          `${q1} · Alternativa`,
          `${q2} · Alternativa`,
          "Respondentes"
        ],
        linhas,
        filtros
      );

    } else {
      const linhas = dados.resultados.map(
        item => [
          rotuloAlternativa(
            q1,
            item.alternativa
          ),
          formatarQuantidade(item)
        ]
      );

      mostrarResultado(
        `${q1} · Frequência cadastral`,
        [
          "Alternativa",
          "Respondentes"
        ],
        linhas,
        filtros
      );
    }

  } finally {
    botao.disabled = false;
    botao.textContent = textoAnterior;
  }
}


/* ==========================================================
   08 | MONTAGEM DO PAINEL CADASTRAL
   ========================================================== */

function criarPainelCadastral() {
  const laboratorio = $("tab-laboratorio");

  const formulario = laboratorio?.querySelector(
    ".builder-container"
  );

  const grade = formulario?.querySelector(
    ".funda-form-grid"
  );

  if (
    !grade ||
    $("cadastro-painel")
  ) {
    return;
  }

  const painel = elemento("div");
  painel.id = "cadastro-painel";

  painel.style.cssText = `
    margin-top:1.5rem;
    padding:1.25rem;
    border:1px solid var(--border-subtle);
    border-radius:8px;
    background:var(--bg-subtle);
  `;

  painel.appendChild(
    elemento(
      "h3",
      "Filtros cadastrais"
    )
  );

  painel.appendChild(
    elemento(
      "p",
      (
        "Combine características dos respondentes " +
        "com as questões selecionadas. " +
        "Sem filtros, permanece disponível a " +
        "consulta original do Laboratório."
      ),
      "funda-note"
    )
  );

  const filtros = elemento("div");
  filtros.id = "cadastro-filtros";

  painel.appendChild(filtros);

  const adicionar = criarBotao(
    "+ Adicionar filtro",
    "btn btn-secondary"
  );

  adicionar.id = "cadastro-adicionar";

  adicionar.addEventListener(
    "click",
    () => {
      filtros.appendChild(
        criarCampo()
      );

      atualizarLimite();
    }
  );

  painel.appendChild(adicionar);

  /*
   * Nao ha login dentro deste painel.
   * Toda autenticacao fica no menu superior.
   */
  grade.insertAdjacentElement(
    "afterend",
    painel
  );

  /*
   * Consulta sem filtros:
   * continua no codigo original do index.html.
   *
   * Consulta com filtros:
   * usa Firebase e a API integrada.
   *
   * A fase de captura impede que o listener antigo
   * execute uma segunda consulta.
   */
  const executar = $("lab-executar");

  if (executar) {
    executar.addEventListener(
      "click",
      async evento => {
        const quantidade = (
          document.querySelectorAll(
            "#cadastro-filtros [data-filtro]"
          ).length
        );

        if (quantidade === 0) {
          return;
        }

        evento.preventDefault();
        evento.stopImmediatePropagation();

        try {
          const selecionados = coletarFiltros();

          await consultarIntegrado(
            selecionados
          );

        } catch (erro) {
          console.error(
            "Consulta cadastral:",
            erro
          );

          exibirErro(erro);
        }
      },
      true
    );
  }
}


/* ==========================================================
   09 | INICIALIZACAO
   ========================================================== */

async function iniciar() {
  /*
   * Primeiro configuramos o login global.
   * Isso nao depende do catalogo de questoes.
   */
  criarMenuConta();

  /*
   * Depois carregamos os rotulos das questoes.
   * As consultas continuam executaveis mesmo
   * se esse catalogo local estiver indisponivel.
   */
  try {
    const resposta = await fetch(
      "./data/questoes_alternativas.json",
      {
        cache: "no-store"
      }
    );

    if (resposta.ok) {
      catalogoQuestoes = await resposta.json();
    }

  } catch (erro) {
    console.warn(
      "Catálogo local indisponível.",
      erro
    );
  }

  criarPainelCadastral();
}


/* ==========================================================
   10 | EXECUTAR APOS CARREGAMENTO DA PAGINA
   ========================================================== */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    iniciar
  );

} else {
  iniciar();
}

/* FIM | 26F.08A */
