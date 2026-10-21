from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Conferência JAS 2026 API")

# Configurar CORS para permitir a comunicação com o frontend na Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "online", "message": "Backend da Conferência JAS 2026 a funcionar com sucesso!"}
