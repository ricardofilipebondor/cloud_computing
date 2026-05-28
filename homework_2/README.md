# CorpSync - CRM Dashboard

## 1) Initialization Commands

Run these commands from `D:/Code/facultate/cloud_computing`:

```bash
# Backend (NestJS)
npx @nestjs/cli new corp_sync/backend

# Frontend (Next.js + Tailwind + TypeScript)
npx create-next-app@latest corp_sync/frontend --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*"
```

If you already have the folders created (as in this implementation), install dependencies:

```bash
cd corp_sync/backend && npm install
cd ../frontend && npm install
```

## 2) Run (Local)

Start Homework 1 API first (port `3000` by default), then:

```bash
cd corp_sync/backend && npm run start:dev
cd corp_sync/frontend && npm run dev
```

Backend runs on `http://localhost:4000`, frontend on `http://localhost:3001`.

## 3) Run with Docker Compose

From `D:/Code/facultate/cloud_computing/corp_sync`:

```bash
docker compose up --build -d
```

Stop everything:

```bash
docker compose down
```

The stack exposes:
- Homework 1 API: `http://localhost:3000`
- NestJS backend: `http://localhost:4000`
- Next.js frontend: `http://localhost:3001`

## 4) Architecture Rules

- Frontend only calls NestJS backend (`/clients` and `/invoices` endpoints).
- NestJS backend orchestrates 3 APIs:
  - Homework 1 custom DB API (persistent storage)
  - Email validation API
  - Exchange rate API
- On startup, NestJS checks/creates/syncs `clients` and `invoices` tables in Homework 1 API.
- API keys and URLs are loaded from `.env` via `@nestjs/config`.
