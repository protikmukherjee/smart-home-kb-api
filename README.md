Smart Home KB API

A minimal FastAPI service that loads Smart Home ontology data (Turtle .ttl files) into an in-memory triplestore (RDFLib) and exposes HTTP endpoints for health checks and SPARQL queries. Includes an optional CSV→TTL helper to generate TTL from tabular sources.


Highlights
	•	Loads one or more .ttl files from ontology/ (already included).
	•	Health endpoint for quick checks.
	•	SPARQL query endpoint (POST JSON; curl-friendly).
	•	Optional tools/csv2ttl.py to regenerate TTL from CSV.



Repository Layout

.
├─ api/
│  └─ main.py            # FastAPI app (expects `app = FastAPI(...)`)
├─ ontology/             # Your .ttl files (pre-populated)
├─ tools/
│  └─ csv2ttl.py         # CSV → TTL helper (optional)
├─ requirements.txt      # Dependency pinning (recommended)
└─ README.md




Prerequisites
	•	Python 3.10+
	•	pip (or uv)
	•	(Optional) virtualenv / venv
	•	(Optional) Firewall permission if exposing to LAN



Quick Start

1) Clone

git clone https://github.com/protikmukherjee/smart-home-kb-api.git
cd smart-home-kb-api

2) Create a virtual environment (recommended)

python -m venv .venv
# macOS / Linux
source .venv/bin/activate
# Windows
# .venv\Scripts\activate

3) Install dependencies

If requirements.txt exists:

pip install -r requirements.txt

Otherwise:

pip install fastapi "uvicorn[standard]" rdflib python-dotenv

4) Configure environment (optional; sensible defaults included)

Create a .env in the repo root (or export in your shell):

# Directory containing TTL files (relative or absolute)
KB_TTL_DIR=ontology

# Optional: Base IRI your ontology uses (only if the code expects it)
KB_BASE_IRI=https://example.org/smart-home#

# Server binding (use 0.0.0.0 to accept LAN connections)
KB_HOST=127.0.0.1
KB_PORT=8000

# CORS (comma-separated origins or *). Enable if a browser client will call the API.
CORS_ORIGINS=*

5) Run the API

uvicorn api.main:app --reload --host ${KB_HOST:-127.0.0.1} --port ${KB_PORT:-8000}

You should see something like:

Uvicorn running on http://127.0.0.1:8000


⸻

Endpoints

Health (GET /health)

curl -s http://127.0.0.1:8000/health

Expected JSON:

{"status":"ok"}

SPARQL Query (POST /query, JSON body)

curl -s -X POST http://127.0.0.1:8000/query \
  -H "Content-Type: application/json" \
  -d '{"sparql":"SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 10"}'

Sample query you can try:

SELECT ?s ?p ?o
WHERE { ?s ?p ?o }
LIMIT 10

Notes
• The API loads all .ttl files found under KB_TTL_DIR at startup.
• If your app uses a different route (e.g., /sparql) or a GET endpoint, adjust the curl command accordingly.

⸻

Using the Existing TTLs
	•	The repository already includes .ttl files under ontology/.
	•	With KB_TTL_DIR=ontology, the API will automatically load them when it starts—no extra steps required.

⸻

(Optional) CSV → TTL Workflow

If you maintain parts of your KB in CSV, convert them to TTL and place the outputs into ontology/generated/ (recommended) or directly into ontology/.

Examples:

# If the script supports explicit flags
python tools/csv2ttl.py --input data/devices.csv --output ontology/generated/devices.ttl

# Or write to stdout and redirect to a file
python tools/csv2ttl.py data/rooms.csv > ontology/generated/rooms.ttl

# Discover options
python tools/csv2ttl.py -h

Recommended flow:
	1.	Keep raw tables in data/
	2.	Generate TTL to ontology/generated/
	3.	Start the API and run a quick SPARQL sanity check
	4.	Commit updated TTLs

