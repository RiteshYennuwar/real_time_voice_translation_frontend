# FOR NOW PLEASE ACCESS THE HOSTED VERSION FROM HERE https://real-time-voice-translation-frontend.onrender.com AND MAKE SURE THE BACKEND IS RUNNING ON http://localhost:5000
# OR PLEASE FOLLOW THE INSTRUCTIONS TO INSTALL THE FRONTEND LOCALLY

# Real-Time Voice Translation Frontend

Frontend web application for the real-time voice translation system built with Next.js 16, React, and TypeScript. Provides an intuitive interface for recording audio, viewing translations, and monitoring evaluation metrics.

## Features

- **Real-time Audio Recording**: Browser-based microphone access with WebRTC
- **Live Translation Display**: View original and translated text in real-time
- **Audio Playback**: Play synthesized translated speech
- **Evaluation Metrics Dashboard**: Monitor WER, BLEU, and MOS scores
- **Multi-language Support**: Switch between English, Spanish, and Hindi
- **WebSocket Integration**: Real-time communication with backend server
- **Responsive Design**: Modern UI with Tailwind CSS

## Prerequisites

- **Node.js 18.x or higher** (Node.js 20+ recommended)
- **npm** or **yarn** package manager
- **Backend server** running on `http://localhost:5000`

### Check Node.js Version

```bash
node --version
npm --version
```

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/RiteshYennuwar/real_time_voice_translation_frontend.git
cd real_time_voice_translation_frontend
```

### 2. Install Dependencies

```bash
npm install
```

**Note**: This will install all required packages including Next.js, React, Socket.IO client, and Tailwind CSS.

### 3. Configure Backend URL

If your backend is running on a different URL, update the API endpoint in `components/VoiceRecorder.tsx`:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
```

Or create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

## Running the Application

### Development Mode

```bash
npm run dev
```

The application will start on `http://localhost:3000`

### IMPORTANT: Make sure the backend is running!

Before using the frontend, ensure the backend server is running:

```bash
# In the backend directory
cd ../real_time_voice_translation_backend/api
python main.py
```

Backend should be accessible at `http://localhost:5000`

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
real_time_voice_translation_frontend/
├── app/
│   ├── page.tsx              # Main application page
│   ├── layout.tsx            # Root layout component
│   └── globals.css           # Global styles
├── components/
│   ├── VoiceRecorder.tsx     # Audio recording & WebSocket
│   ├── TranslationDisplay.tsx # Translation results display
│   └── EvaluationMetrics.tsx # Metrics dashboard
├── types/
│   └── translation.ts        # TypeScript type definitions
├── public/                   # Static assets
├── next.config.ts            # Next.js configuration
├── tailwind.config.ts        # Tailwind CSS configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies and scripts
```

## Features Overview

### 1. Voice Recording
- Click the microphone button to start/stop recording
- Real-time audio streaming to backend via WebSocket
- Visual feedback with animated recording indicator

### 2. Translation Display
- View original transcribed text
- See translated text in target language
- Confidence scores and latency metrics
- Play translated audio

### 3. Evaluation Metrics
- Toggle metrics dashboard with eye icon
- Auto-refresh every 5 seconds
- View WER, BLEU, and MOS scores
- Sample counts and quality interpretations
- Reset metrics functionality

### 4. Language Selection
- Source language: English, Spanish, Hindi
- Target language: English, Spanish, Hindi
- Easy toggle between languages

## Environment Variables

Create a `.env.local` file for custom configuration:

```env
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:5000

# WebSocket URL (if different from API URL)
NEXT_PUBLIC_WS_URL=ws://localhost:5000
```

## Troubleshooting

### Common Issues

**1. Cannot Connect to Backend**
```
Error: ERR_CONNECTION_REFUSED
```
**Solution**: Ensure backend is running on `http://localhost:5000`
```bash
cd ../real_time_voice_translation_backend/api
python main.py
```

**2. Microphone Access Denied**
**Solution**: 
- Check browser permissions (Settings → Privacy → Microphone)
- Use HTTPS in production (HTTP only works on localhost)
- Try a different browser

**3. WebSocket Connection Failed**
**Solution**:
- Verify backend WebSocket is running
- Check CORS settings in backend
- Ensure no firewall blocking port 5000

**4. Module Not Found Errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**5. Build Errors**
```bash
# Clear Next.js cache
rm -rf .next
npm run build
```

**6. Audio Playback Issues**
- Ensure browser supports Web Audio API
- Check audio format compatibility
- Try refreshing the page

## Browser Compatibility

Recommended browsers:
- ✅ Chrome 90+
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

**Note**: Microphone access requires HTTPS in production (localhost HTTP is allowed for development).

## Development Tips

### Hot Reload
Next.js automatically reloads when you save changes to:
- Components (`.tsx` files)
- Styles (`.css` files)
- Configuration files

### Debugging
1. Open browser DevTools (F12)
2. Check Console for errors
3. Monitor Network tab for WebSocket connections
4. Use React DevTools for component inspection

### Testing Locally
1. Start backend: `cd backend/api && python main.py`
2. Start frontend: `npm run dev`
3. Open `http://localhost:3000`
4. Allow microphone access
5. Select languages and start recording

## API Integration

The frontend communicates with the backend via:

### REST API
- Health check: `GET http://localhost:5000/api/health`
- Evaluation summary: `GET http://localhost:5000/api/evaluation/summary`
- Auto-track metrics: `POST http://localhost:5000/api/evaluation/auto-track`

### WebSocket
- Connect: `io('http://localhost:5000')`
- Send audio: `socket.emit('audio_chunk', audioData)`
- Receive results: `socket.on('translation_result', callback)`

## Performance Optimization

### For Better Performance:
- Use production build (`npm run build && npm start`)
- Enable audio compression in VoiceRecorder
- Reduce audio chunk sizes for faster streaming
- Use smaller buffer sizes for lower latency

### For Lower Bandwidth:
- Reduce audio sample rate (16000 Hz)
- Increase chunk interval
- Disable auto-refresh in metrics

## Scripts

```bash
# Development
npm run dev          # Start dev server

# Production
npm run build        # Build for production
npm start            # Start production server

# Linting & Formatting
npm run lint         # Run ESLint
npm run lint:fix     # Fix linting issues

# Type Checking
npx tsc --noEmit     # Check TypeScript types
```

## Supported Languages

| Language | Code | Flag |
|----------|------|------|
| English | `en` | 🇺🇸 |
| Spanish | `es` | 🇪🇸 |
| Hindi | `hi` | 🇮🇳 |
