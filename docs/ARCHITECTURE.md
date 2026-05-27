# Arquitetura

## Visão geral

```txt
Aluno na CEFIS
  ↓
Widget JS
  ↓
Webhook n8n
  ↓
API CEFIS + Groq
  ↓
Resposta personalizada
```

## Frontend

O frontend é um widget JavaScript injetável.

Responsabilidades:

- criar botão flutuante;
- criar painel de chat;
- coletar onboarding;
- permitir reset de foco;
- identificar aluno logado;
- capturar contexto da tela;
- enviar payload para o webhook.

## Backend

O backend MVP é um workflow n8n com Code Node.

Responsabilidades:

- normalizar entrada;
- identificar intenção;
- consultar cursos reais;
- montar prompt seguro;
- chamar modelo de IA;
- retornar JSON.

## Por que n8n

n8n foi escolhido para acelerar a entrega no hackathon.

A lógica central é JavaScript puro, portanto pode ser migrada para:

- Express;
- Fastify;
- NestJS;
- Next.js;
- Cloudflare Workers;
- AWS Lambda.

## Memória

Nesta versão:

- Local Storage no navegador;
- sem banco persistente;
- sem autenticação própria;
- usa sessão CEFIS quando disponível.

## Evolução

Substituir Local Storage por:

- Postgres;
- Supabase;
- Redis;
- banco interno CEFIS.
