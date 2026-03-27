# Backend API

Express + Prisma + Firebase backend for the Digital Twin dashboard.

## Prerequisites

- Node.js 20+
- npm 9+
- PostgreSQL running locally or remotely
- Firebase service account JSON with Realtime Database access

## 1) Install dependencies

From this folder:

```bash
npm install
```

## 2) Configure environment variables

Create a `.env` file in this folder.

Required:

- `DATABASE_URL`: PostgreSQL connection string used by Prisma

Optional (with defaults):

- `PORT`: API port (default: `4001`)
- `CORS_ORIGIN`: Allowed origin(s). Use `*` or comma-separated list.
- `PYTHON_BIN`: Python binary path for codegen helpers (default: `python3`)
- `FIREBASE_DATABASE_URL`: Firebase RTDB URL (default already points to iot-archm-kb)
- `FIREBASE_CREDS_PATH`: Path to service account JSON (default: `./firebase_creds.json`)

Example `.env`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/digital_twin
PORT=4001
CORS_ORIGIN=http://localhost:3000
PYTHON_BIN=python3
FIREBASE_DATABASE_URL=https://iot-archm-kb-default-rtdb.firebaseio.com
FIREBASE_CREDS_PATH=./firebase_creds.json
```

## 3) Setup Prisma database

Generate Prisma client:

```bash
npx prisma generate
```

Create/apply migrations for local development:

```bash
npx prisma migrate dev --name init
```

If you already have migrations and just want to apply them:

```bash
npx prisma migrate deploy
```

Optional: open Prisma Studio:

```bash
npx prisma studio
```

Optional seed:

```bash
npm run seed:postgres
```

## 4) Add Firebase credentials

Place your Firebase service account file at:

- `./firebase_creds.json`

Or set a custom path via `FIREBASE_CREDS_PATH`.

## 5) Run backend

Development:

```bash
npm run dev
```

Production build:

```bash
npm run build
npm start
```

Health check:

```bash
curl http://localhost:4001/api/health
```

## Main API endpoints

- `GET /api/health`
- `GET /api/systems`
- `GET /api/systems/:id`
- `POST /api/systems` body: `{ systemJson }`
- `PATCH /api/systems/:id/components`
- `DELETE /api/systems/:id`
- `GET /api/knowledgebase/variants?deviceType=sensor&componentType=ultrasonic_sensor`
- `POST /api/knowledgebase/variants`
- `GET /api/systems/:id/budget-suggestions?budget=250&limit=5&offset=0`
- `POST /api/systems/:id/selections`
- `POST /api/systems/:id/config`
- `GET /api/systems/:id/config`
- `POST /api/systems/:id/deploy`
- `GET /api/runtime/setup`
- `PUT /api/runtime/setup`
- `GET /api/runtime/systems`

## Troubleshooting

- `DATABASE_URL is required.`
	- Ensure `.env` exists and `DATABASE_URL` is set.

- Prisma connection errors
	- Confirm PostgreSQL is running and database/user/password are correct.
	- Re-run `npx prisma migrate dev`.

- Firebase credential errors
	- Verify `firebase_creds.json` exists and is valid JSON.
	- Confirm service account has RTDB read/write permissions.

- CORS errors from frontend
	- Set `CORS_ORIGIN` to your frontend origin (for example `http://localhost:3000`).
