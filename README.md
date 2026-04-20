# AnimePahe Web

A modern web interface for streaming anime using the animepahe-dl library. Features a React frontend with FastAPI backend, HLS video streaming, and a sleek dark UI.

![AnimePahe Web Screenshot](docs/screenshot.png)

## Features

- **Modern Web Interface** - Clean, responsive React frontend with dark theme
- **Fast Search** - Search through thousands of anime titles instantly
- **HLS Streaming** - Direct browser playback with quality selection (360p to 1080p)
- **Episode Navigation** - Easy browsing between episodes with next/previous buttons
- **Audio Selection** - Choose between Japanese and English audio
- **No Downloads Required** - Stream directly in your browser

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  React Frontend │──────▶  FastAPI Backend  │──────▶  AnimePahe API  │
│   (Port 3000)   │      │    (Port 8000)   │      │   (External)    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
         │                           │
         │                    ┌──────┴──────┐
         │                    │ animepahe- │
         └───────────────────▶│  dl library │
                              └─────────────┘
```

## Prerequisites

- **Node.js** 18+ (for frontend development)
- **Python** 3.11+ (for backend)
- **animepahe-dl** library (sibling directory)
- **Docker & Docker Compose** (optional, for containerized deployment)

## Project Structure

```
animepahe-web/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/
│   │   │   └── routes.py    # API endpoints
│   │   ├── services/
│   │   │   └── anime_service.py  # anime_downloader wrapper
│   │   └── main.py          # FastAPI application
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route pages
│   │   └── services/        # API client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml       # Docker orchestration
└── README.md
```

## Quick Start

### Option 1: Development Mode (Recommended)

1. **Install backend dependencies:**
   ```bash
   cd backend
   pip install -r requirements.txt
   ```

2. **Install frontend dependencies:**
   ```bash
   cd frontend
   npm install
   ```

3. **Start the backend (Terminal 1):**
   ```bash
   cd backend
   uvicorn app.main:app --reload --port 8000
   ```

4. **Start the frontend (Terminal 2):**
   ```bash
   cd frontend
   npm run dev
   ```

5. **Open your browser:**
   - Frontend: http://localhost:3000
   - API Docs: http://localhost:8000/docs

### Option 2: Docker Deployment

1. **Build and start containers:**
   ```bash
   docker-compose up --build
   ```

2. **Access the application:**
   - Web UI: http://localhost
   - API: http://localhost:8000

3. **Stop containers:**
   ```bash
   docker-compose down
   ```

## Usage

1. **Update the Anime Cache** (recommended first step)
   - Click "Update Anime Cache" button on the homepage
   - This downloads the full anime list for faster searches

2. **Search for Anime**
   - Enter anime name in the search bar
   - Press Enter or click Search

3. **Select an Anime**
   - Click on any anime card from search results
   - View all available episodes

4. **Watch Episodes**
   - Click on any episode to start streaming
   - Use quality selector (best, 1080p, 720p, 480p, 360p)
   - Use audio selector (Japanese/English)
   - Navigate with previous/next buttons

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/search?q={query}` | GET | Search anime by title |
| `/api/v1/anime/{slug}/episodes` | GET | Get episodes for anime |
| `/api/v1/anime/{slug}/episode/{session}/stream` | GET | Get streaming URL |
| `/api/v1/cache/update` | POST | Update anime cache |
| `/api/v1/airing` | GET | Get currently airing anime |

## Configuration

### Environment Variables

Create `.env` file in project root:

```env
# Backend settings
BACKEND_PORT=8000

# Frontend settings
FRONTEND_PORT=3000

# API URL (for production builds)
VITE_API_URL=http://localhost:8000/api/v1
```

### Quality Settings

Available quality options:
- `best` - Highest available quality
- `1080` - 1080p
- `720` - 720p  
- `480` - 480p
- `360` - 360p

### Audio Settings

- `jpn` - Japanese audio (default)
- `eng` - English audio

## Troubleshooting

### "No video stream available" error
- Try changing the quality setting
- Switch between Japanese and English audio
- The episode may not be available on AnimePahe

### Search returns no results
- Update the anime cache using the button on homepage
- Try a different search term
- Some anime may not be available

### CORS errors in development
- Make sure the backend is running on port 8000
- Frontend dev server proxies API requests automatically

### Docker build fails
- Ensure animepahe-dl is in the parent directory (`../animepahe-dl`)
- Check that Docker and Docker Compose are installed correctly

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

Requires HLS support (provided by hls.js library).

## Development

### Adding New Features

1. **Backend:** Add new endpoints in `backend/app/api/routes.py`
2. **Frontend:** Create new components in `frontend/src/components/`
3. **Pages:** Add routes in `frontend/src/App.jsx` and create page components

### Tech Stack

**Backend:**
- FastAPI
- Python 3.11
- animepahe-dl library
- Uvicorn

**Frontend:**
- React 18
- Vite
- Tailwind CSS
- React Router
- HLS.js
- Lucide Icons
- Axios

## License

This project is for personal use only. Please respect copyright laws and support official anime releases.

## Acknowledgments

- Built using the [animepahe-dl](https://github.com/ayushjaipuriyar/animepahe-dl) library
- Anime data provided by AnimePahe
# animepahe
