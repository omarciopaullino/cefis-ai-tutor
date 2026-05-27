# 🎓 CEFIS AI Tutor
## Tutor Contextual de Aprendizado com IA para a Plataforma CEFIS

> Um tutor inteligente que entende quem é o aluno, o que ele quer aprender, quanto tempo tem disponível e qual conteúdo está visualizando naquele momento.

---

# 🚀 Visão Geral

O **CEFIS AI Tutor** foi desenvolvido para o Hackathon CEFIS com o objetivo de transformar a experiência de aprendizagem dentro da plataforma.

Em vez de funcionar como um chatbot genérico, o tutor atua como um **mentor contextual**, capaz de:

- identificar o aluno logado;
- entender seu objetivo de aprendizagem;
- conhecer seu perfil de estudo;
- detectar o curso ou aula atualmente aberta;
- recomendar conteúdos reais da CEFIS;
- adaptar respostas ao tempo disponível do aluno;
- construir uma memória básica de aprendizagem;
- acompanhar mudanças de interesse ao longo do tempo.

O resultado é uma experiência muito mais próxima de um tutor humano do que de um simples assistente conversacional.

---

# 🎯 O Problema

Hoje, mesmo em plataformas modernas de educação, o aluno normalmente precisa explicar repetidamente:

- quem ele é;
- o que deseja aprender;
- qual seu nível de conhecimento;
- quanto tempo possui disponível;
- qual conteúdo está estudando naquele momento.

Isso gera atrito, reduz engajamento e impede uma personalização real da experiência.

---

# 💡 A Solução

O CEFIS AI Tutor resolve esse problema criando uma camada de inteligência sobre a plataforma.

O tutor:

1. identifica automaticamente o aluno;
2. realiza onboarding personalizado;
3. entende o contexto da tela atual;
4. consulta conteúdos reais da CEFIS;
5. responde utilizando contexto e histórico;
6. adapta recomendações ao perfil do aluno.

Exemplos:

### Pergunta

```txt
Quem sou eu?
```

### Resposta

```txt
Você está logado como Marcio.

Objetivo atual:
Comércio Internacional

Tempo disponível:
15 minutos por dia

Estilo de aprendizagem:
Leitura e exemplos práticos.
```

---

### Pergunta

```txt
O que estou vendo?
```

### Resposta

```txt
Pelo contexto da página, você está visualizando o curso Auditoria Aduaneira.

Posso resumir a aula, explicar os conceitos principais ou sugerir um plano rápido de estudo.
```

---

### Pergunta

```txt
Tenho 15 minutos. O que devo estudar?
```

### Resposta

```txt
Considerando seu objetivo e o curso atual, recomendo assistir ao próximo módulo sobre fiscalização aduaneira e registrar três pontos-chave.
```

---

# 🏗 Arquitetura

```txt
Aluno na Plataforma CEFIS
            │
            ▼
    Widget JavaScript
            │
            ▼
       Webhook n8n
            │
            ▼
      Code Node JS
            │
      ┌─────┴─────┐
      ▼           ▼
 API CEFIS      Groq
      │           │
      └─────┬─────┘
            ▼
 Resposta Personalizada
```

---

# 🧠 Como Funciona

## 1. Identificação do aluno

O widget tenta identificar automaticamente o aluno logado através da sessão da plataforma.

Informações utilizadas:

- id do usuário;
- nome;
- e-mail;
- plano premium;
- dados de onboarding.

---

## 2. Onboarding

Na primeira utilização, o tutor coleta:

- objetivo principal;
- nível de conhecimento;
- tempo disponível por dia;
- estilo de aprendizagem.

Exemplo:

```txt
Objetivo:
Comércio Internacional

Nível:
Intermediário

Tempo:
15 minutos por dia

Estilo:
Aprendo melhor lendo exemplos
```

---

## 3. Contexto da Tela

O widget captura informações da página atual:

- URL;
- título da página;
- possível curso aberto;
- possível aula aberta;
- texto visível da tela.

Isso permite perguntas como:

```txt
Explique esta aula
```

sem que o aluno precise informar manualmente qual aula está assistindo.

---

## 4. Busca de Cursos

As recomendações utilizam cursos reais retornados pela API da CEFIS.

O tutor foi instruído a:

✅ utilizar apenas cursos existentes

✅ utilizar apenas IDs reais

✅ utilizar apenas links válidos

❌ nunca inventar cursos

❌ nunca inventar URLs

❌ nunca inventar conteúdos

---

# 📦 Estrutura do Projeto

```txt
cefis-ai-tutor/
│
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
│
├── docs/
│   ├── PITCH.md
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── DEMO_SCRIPT.md
│
├── widget/
│   └── cefis-tutor-widget.v1.0.0.js
│
├── n8n/
│   ├── code.js
│   └── workflow-export.json
│
├── public/
│   └── index.html
│
└── assets/
    └── screenshots/
```

---

# ⚡ Por que utilizamos um Widget via Inject?

Durante o hackathon o objetivo principal era validar rapidamente a experiência dentro da plataforma real.

Por isso optamos por um widget JavaScript injetável.

Essa abordagem permitiu:

- validar o conceito rapidamente;
- testar dentro da experiência real da CEFIS;
- reduzir dependências de deploy;
- demonstrar integração sem alterar código oficial.

Exemplo de carregamento:

```html
<script src="https://cdn.cefis.com.br/tutor/cefis-tutor-widget.v1.0.0.js"></script>
```

Ou diretamente:

```html
<head>
  <script src="/assets/tutor/cefis-tutor-widget.v1.0.0.js" defer></script>
</head>
```

Portanto o inject não é uma limitação técnica.

Foi uma escolha estratégica para acelerar a validação durante o hackathon.

---

# ⚙ Por que utilizamos n8n?

A escolha do n8n também foi estratégica.

Objetivo:

- acelerar desenvolvimento;
- permitir iteração rápida;
- reduzir tempo de infraestrutura;
- validar o produto no prazo do hackathon.

Entretanto, a lógica central do sistema está escrita em:

```txt
JavaScript puro
```

Portanto pode ser migrada facilmente para:

- Express.js
- Fastify
- NestJS
- Next.js
- AWS Lambda
- Cloudflare Workers
- Google Cloud Functions
- qualquer backend Node.js

Ou seja:

**o n8n é apenas o orquestrador do MVP.**

Não representa dependência arquitetural permanente.

---

# 💾 Memória

Nesta versão MVP a memória utiliza:

```txt
Local Storage
```

Informações armazenadas:

- objetivo do aluno;
- nível;
- tempo disponível;
- estilo de aprendizagem;
- histórico recente;
- lacunas identificadas;
- pontos fortes identificados.

### Motivo da escolha

Durante o hackathon priorizamos:

- simplicidade;
- velocidade;
- funcionalidade demonstrável.

---

# 🔄 Redefinição de Objetivo

O tutor permite redefinir completamente o onboarding.

Exemplo:

```txt
Redefinir foco
```

ou

```txt
Trocar objetivo
```

O sistema reinicia o perfil pedagógico e cria uma nova jornada personalizada.

---

# 🛡 Segurança

A arquitetura foi desenhada para evitar exposição de credenciais.

### O widget NÃO possui:

- API Keys
- Tokens de IA
- Segredos

### As credenciais ficam apenas no backend

Exemplo:

```env
GROQ_API_KEY=*****
```

---

# 🚨 Tratamento de Falhas

Nenhum sistema de IA é perfeito.

Por isso existe um plano de contingência.

Em caso de falha:

- não exibir stack trace;
- não exibir erro técnico;
- responder de forma amigável;
- permitir continuação da conversa.

Exemplo:

```txt
Tive uma instabilidade agora, mas consigo continuar.

Me diga o tema em uma frase curta e seguimos daqui.
```

---

# 🔮 Evoluções Futuras

## v1.1

- memória de cursos recomendados;
- logs estruturados;
- tratamento avançado de erros;
- melhor UX de carregamento.

---

## v1.2

- memória persistente por aluno;
- banco de dados dedicado;
- histórico completo de aprendizagem;
- acompanhamento longitudinal.

---

## v2.0

- RAG com transcrições das aulas;
- quizzes automáticos;
- geração de resumos;
- apostilas personalizadas;
- plano semanal automático;
- podcasts e conteúdos em áudio;
- acompanhamento contínuo por IA.

---

# ▶ Como Executar

## 1. Clonar o repositório

```bash
git clone https://github.com/SEU_USUARIO/cefis-ai-tutor.git
cd cefis-ai-tutor
```

---

## 2. Configurar variáveis

```bash
cp .env.example .env
```

Preencher:

```env
GROQ_API_KEY=sua_chave
GROQ_MODEL=openai/gpt-oss-120b
```

---

## 3. Importar Workflow

Abrir n8n:

```txt
Workflows
→ Import from File
→ workflow-export.json
```

Ativar workflow.

---

## 4. Servir Widget

```bash
python3 -m http.server 3000
```

---

## 5. Injetar Widget

Abrir o console:

```js
(function () {
  document.getElementById("cefisTutorRoot")?.remove();
  document.getElementById("cefisTutorScript")?.remove();

  const script = document.createElement("script");
  script.id = "cefisTutorScript";
  script.src =
    "http://localhost:3000/widget/cefis-tutor-widget.v1.0.0.js";

  document.body.appendChild(script);
})();
```

---

# 🎬 Demonstração

## 🎬 Demonstração

[![Assista à demonstração do CEFIS AI Tutor](https://img.youtube.com/vi/IoGnne8a7TM/maxresdefault.jpg)](https://youtu.be/IoGnne8a7TM)

---

# 🏆 Diferencial Competitivo

O CEFIS AI Tutor não é apenas um chatbot.

Ele combina:

- contexto da plataforma;
- contexto do aluno;
- contexto da tela atual;
- perfil pedagógico;
- recomendações reais da CEFIS;
- personalização contínua.

Transformando uma plataforma de cursos em uma experiência de aprendizagem verdadeiramente personalizada.

---

# 📄 Licença

Projeto desenvolvido para fins de demonstração e avaliação no Hackathon CEFIS.
