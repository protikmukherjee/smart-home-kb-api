# 1) Clone
git clone https://github.com/protikmukherjee/smart-home-kb-api.git
cd smart-home-kb-api

# 2) Python env (3.10+ recommended)
python3 -m venv .venv
source .venv/bin/activate    # Windows: .venv\Scripts\activate

# 3) Install
pip install -U pip
pip install -r requirements.txt

# 4) Configure (create .env in project root)
# --- .env example ---
APP_HOST=0.0.0.0
APP_PORT=8000
CORS_ORIGINS=*
KB_DATA_PATH=./data/kb.csv   # path to the CSV you want the API to load
# ----------------------

# 5) Run
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 6) Quick tests (from another terminal)
curl http://127.0.0.1:8000/health
curl -X POST http://127.0.0.1:8000/recommend \
  -H "Content-Type: application/json" \
  -d '{"cls":"SensorPart","properties":["distance"],"interfaces":["GPIO_TRIGGER_ECHO"],"v":5.0,"budget":30,"currency":"CAD"}'
