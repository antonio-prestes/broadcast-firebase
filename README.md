# Broadcast Message

Sistema web multi-tenant para gerenciamento de conexões, contatos e envio de mensagens em lote (imediatas ou agendadas), construído com React, TypeScript e Firebase.

Link de acesso: https://broadcast-1f.web.app

## Estrutura

```text
├── web/                    # Frontend (React, TypeScript, Vite, Tailwind CSS, MUI)
│   └── src/
│       ├── components/     # Telas da aplicação (Auth, Conexões, Contatos, Envio, Histórico)
│       ├── services/       # Configuração Firebase e worker de agendamentos
│       ├── types/          # Tipagens
│       └── utils/          # Funções utilitárias
├── functions/              # Cloud Functions (processamento de mensagens agendadas)
├── firestore.rules         # Regras de segurança por tenantId
├── firestore.indexes.json  # Índices do Firestore
└── firebase.json           # Configuração de Hosting, Firestore e Functions
```

## Arquitetura e Dados

Os dados são armazenados em coleções raiz no Firestore (`connections`, `contacts` e `messages`), sem uso de subcoleções. O isolamento entre clientes é feito pelo campo `tenantId` (correspondente ao `uid` do usuário no Firebase Auth), validado nas consultas do cliente e nas regras de segurança (`firestore.rules`).

### Agendamento de Mensagens

O envio de mensagens agendadas (`status == "agendada"` e `scheduledFor <= agora`) conta com duas formas de execução:

1. **Cloud Functions (`functions/src/index.ts`)**: função agendada (`processScheduledBroadcasts`) configurada para rodar a cada minuto via Cloud Scheduler.
2. **Worker no cliente (`web/src/services/broadcastWorker.ts`)**: rotina em background que verifica e atualiza mensagens agendadas vencidas do usuário logado. Como o Cloud Functions exige o plano pago (Blaze) no Firebase, esse worker garante que o agendamento funcione integralmente mesmo no plano gratuito (Spark).

## Desenvolvimento e Deploy

### Frontend

```bash
cd web
npm install
npm run dev
npm run build
```

### Functions

```bash
cd functions
npm install
npm run build
```

### Deploy

```bash
# Hosting e regras do Firestore
npx firebase-tools deploy --only hosting,firestore

# Deploy completo (incluindo Cloud Functions)
npx firebase-tools deploy
```
