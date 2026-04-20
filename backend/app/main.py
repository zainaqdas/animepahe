"""
FastAPI main application for AnimePahe Web.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .api.routes import router

app = FastAPI(
    title="AnimePahe Web API",
    description="API for streaming anime from AnimePahe",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api/v1")

# Serve static files (frontend build)
static_dir = os.path.join(os.path.dirname(__file__), "../static")
if os.path.exists(static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(static_dir, "assets")), name="assets")

@app.get("/")
async def root():
    """Serve the frontend index.html."""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AnimePahe Web API is running. Frontend not built yet."}

# SPA fallback - serve index.html for all non-API routes
@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """Serve index.html for SPA routing."""
    index_path = os.path.join(static_dir, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "AnimePahe Web API is running. Frontend not built yet."}

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
