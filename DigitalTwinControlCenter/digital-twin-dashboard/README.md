# Digital Twin Dashboard (Unified)

This repository now hosts both:

- **Runtime Dashboard** (Firebase direct, real/simulated monitoring) at `/`
- **Development Dashboard** (backend API + Prisma workflow) at `/dev`

## Stack

- Frontend: Next.js 15, React 19, TypeScript, Tailwind CSS 4
- Runtime data path: direct Firebase access from frontend
- Development data path: frontend calls local backend API (`backend/`)
- Development backend: Express + Prisma + PostgreSQL + Firebase Admin

## Repository Structure

- `src/app/*` – runtime dashboard routes
- `src/app/dev/*` – development dashboard routes
- `backend/*` – development backend API and Prisma schema/migrations
- `Assets/ArcMLToConfig.py` – Python config generation script used by backend

## Prerequisites

- Node.js 18+
- Python 3 (for config generation)
- PostgreSQL (for development dashboard backend)
- Firebase project/config (for runtime mode and knowledgebase access)

## Install

```bash
npm install
npm --prefix backend install
```

## Run

### Runtime dashboard only (Firebase direct)

```bash
npm run dev:runtime
```

Open `http://localhost:3000/`

### Development backend only

```bash
npm run dev:backend
```

Runs backend API at `http://localhost:4001`

### Unified local development (frontend + backend)

```bash
npm run dev:full
```

Then use:

- Runtime dashboard: `http://localhost:3000/`
- Development dashboard: `http://localhost:3000/dev`

## Environment

### Frontend

Use `.env` / `.env.local` for runtime Firebase config and optional API override:

- `NEXT_PUBLIC_DEV_API_URL` (optional, defaults to `http://localhost:4001`)

### Backend

Copy and configure:

```bash
cp backend/.env.example backend/.env
```

Also provide Firebase admin credentials expected by backend (`backend/firebase_creds.json`) and configure DB settings in `backend/.env`.

## Build

```bash
npm run build
npm run build:backend
```
