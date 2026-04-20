# Railway Deployment Guide

This guide explains how to deploy the animepahe-web application to Railway.com.

## Prerequisites

- A Railway account (sign up at railway.app)
- Your code pushed to a GitHub, GitLab, or Bitbucket repository
- The animepahe-dl library copied into the backend directory (already done)

## Deployment Architecture

This application is configured as a **single service** where:
- FastAPI serves both the API and the React frontend as static files
- The frontend is built and copied to `backend/static/`
- One Docker container handles everything
- One URL for the entire application

## Step-by-Step Deployment

### 1. Push Code to Git Repository

Make sure your code is committed and pushed to your Git repository:

```bash
git add .
git commit -m "Ready for Railway deployment"
git push origin main
```

### 2. Create Railway Project

1. Go to [railway.app](https://railway.app) and log in
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your `animepahe-web` repository
4. Railway will analyze your repository structure

### 3. Configure the Service

Railway will automatically detect your `railway.json` configuration file and use the Dockerfile in the `backend/` directory.

**No additional configuration is needed** - the following is already set up:
- Dockerfile includes animepahe-dl library
- Health check endpoint at `/health`
- Port configuration using `$PORT` environment variable
- Static files served from `backend/static/`

### 4. Deploy

1. Click **"Deploy"** in Railway
2. Railway will build the Docker image and deploy your application
3. Monitor the deployment logs in the Railway dashboard
4. Once deployed, you'll get a URL like: `https://animepahe-web-production.up.railway.app`

### 5. Access Your Application

Visit the provided Railway URL to access your anime streaming application. The app will work exactly as it does locally, with:
- API endpoints at `/api/v1/...`
- Frontend routes at `/anime/...`, `/watch/...`, etc.

## Configuration Details

### railway.json

The `railway.json` file at the root of the project configures Railway to:
- Use the Dockerfile in `backend/`
- Run health checks at `/health`
- Restart on failure with up to 10 retries

### Backend Dockerfile

The Dockerfile:
- Clones the animepahe-dl library from GitHub during build
- Installs Python dependencies
- Builds the React frontend from source and copies to `backend/static/`
- Serves the app on the port specified by Railway's `$PORT` variable
- Includes a health check using curl

### Frontend API Configuration

The frontend is configured to use relative paths (`/api/v1`) instead of hardcoded localhost URLs. This means:
- In production: API calls go to the same domain as the frontend
- In development: Set `VITE_API_URL=http://localhost:8000/api/v1` in `.env` file

## Environment Variables

You can set these optional environment variables in Railway's dashboard:

- `PYTHONUNBUFFERED=1` - Ensures Python logs are immediately visible
- `PORT` - Automatically set by Railway (don't override)

## Updating the Deployment

To update your deployed application:

1. Make changes locally
2. Commit and push to Git
3. Railway will automatically detect changes and redeploy

Note: The Dockerfile automatically builds the frontend during deployment, so you don't need to build it manually.

## Troubleshooting

### Build Fails

- Check the Railway deployment logs for errors
- Ensure the animepahe-dl GitHub repository is accessible
- Verify all dependencies are in `backend/requirements.txt`
- Check that frontend can be built (no syntax errors in React code)

### Health Check Fails

- The `/health` endpoint must return `{"status": "healthy"}`
- Check that the app is running on the correct port
- Verify curl is installed in the Docker image

### Frontend Not Loading

- Ensure `backend/static/index.html` exists
- Check that the build was copied to `backend/static/`
- Verify the static file mounting in `main.py`

### API Not Working

- Check that API routes are prefixed with `/api/v1`
- Verify CORS middleware is configured correctly
- Check Railway logs for any API errors

## Resource Limits

Railway's free tier includes:
- 512MB RAM
- 0.5 vCPU
- $5 free credit per month

For production use, consider upgrading to a paid tier for better performance, especially for video streaming.

## Custom Domain (Optional)

To use a custom domain:

1. Go to your project settings in Railway
2. Click **"Domains"** → **"Add Domain"**
3. Enter your domain name
4. Update your DNS records as instructed by Railway
5. Railway will automatically provision SSL certificates

## Support

For Railway-specific issues:
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)

For application issues:
- Check the logs in Railway dashboard
- Review this repository's README.md
