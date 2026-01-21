# YouTube Downloader - Frontend

React-based web interface for downloading YouTube videos.

## Features

- Modern, responsive UI built with React and Tailwind CSS
- Video preview with thumbnail and duration
- Format selection (MP4, MP3, WEBM)
- Quality options
- Download progress tracking
- Clean, intuitive interface

## Setup

1. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm start
```

The app will open at `http://localhost:3000`

## Build

Create a production build:
```bash
npm run build
```

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm run build` - Builds the app for production
- `npm test` - Runs the test suite
- `npm run eject` - Ejects from Create React App (one-way operation)

## Configuration

- Default API: If no env var is set, the app uses `http://localhost:5000`.
- Recommended: Set `REACT_APP_API_BASE_URL` to your backend URL.

Local development:
```bash
echo REACT_APP_API_BASE_URL=https://ytsuite-702749419835.asia-south1.run.app > .env.local
npm start
```

Netlify: Add an environment variable `REACT_APP_API_BASE_URL` with your backend URL, or keep it in `netlify.toml`.

## Technologies

- React 19
- Tailwind CSS
- Lucide React (icons)
- Create React App
