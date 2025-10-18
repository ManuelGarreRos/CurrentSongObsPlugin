# WebSocket Server & OBS Display

WebSocket server that bridges browser extension and OBS Studio browser source for real-time video information display.

## Overview

This server receives video information from the browser extension via WebSocket and relays it to the OBS browser source display. It serves both as a WebSocket relay server and an HTTP server for the browser source HTML file.

## Features

### Server Features
- 🔌 **WebSocket server** - Relays messages between extension and OBS (port 8765)
- 🌐 **HTTP server** - Serves the OBS browser source display (port 8008)
- 🔄 **Multi-client support** - Handles multiple simultaneous connections
- 📡 **Message broadcasting** - Forwards messages between all connected clients
- 💾 **State preservation** - Caches current video data for new connections

### Display Features
- 💿 **Vinyl disk effect** - Realistic spinning record with grooves and center hole
- 🎚️ **Animated equalizer** - 10-bar music visualizer with randomized animations
- 🖼️ **Album cover crossfade** - Smooth transitions between thumbnail and album art
- ⏭️ **Next song preview** - Shows upcoming track on hover or when song is ending
- 🎨 **6 Theme presets** - Customizable color schemes (Cyberpunk, Midnight, Purple, Pink, Mint, Warm)
- 🎼 **Interactive playlist** - Searchable playlist with click-to-play navigation
- ⚙️ **Configuration modal** - Full customization UI with export/import support
- 🔀 **Playlist persistence** - Maintains shuffle/loop settings across tracks

## Installation

```bash
npm install
```

Dependencies:
- `ws` (v8.14.0) - WebSocket server implementation

## Usage

### Start Server

```bash
npm start
```

Output:
```
WebSocket server started on ws://localhost:8765
HTTP server started on http://localhost:8008

Instructions:
   1. Add a Browser Source in OBS
   2. Set URL to: http://localhost:8008
   3. Set Width: 400, Height: 340
   4. Install and enable the browser extension
   5. Play a video in your browser
```

### Windows Batch Scripts

**Start server (visible):**
```batch
start-server.bat
```

**Start server (hidden):**
```batch
start-server-hidden.vbs
```

**Stop server:**
```batch
stop-server.bat
```

### Auto-start on Windows Boot

1. Press `Win+R`, type `shell:startup`, press Enter
2. Create shortcut to `start-server-hidden.vbs`
3. Server starts automatically on login

## OBS Configuration

### Add Browser Source

1. Open **OBS Studio**
2. In Sources panel, click **+** → **Browser Source**
3. Configure:
   - **Name:** "Current Video"
   - **URL:** `http://localhost:8008`
   - **Width:** `400`
   - **Height:** `340`
   - **FPS:** `30` (or lower for better performance)
   - ✅ **Shutdown source when not visible**
   - ✅ **Refresh browser when scene becomes active**

### Recommended Settings

**Performance optimization:**
- Width: 400, Height: 340 (default)
- FPS: 15-30 (lower = less CPU usage)
- Enable "Shutdown source when not visible"

**For larger displays:**
- Width: 600, Height: 510 (1.5x scale)
- Width: 800, Height: 680 (2x scale)

## Configuration

### Change Ports

Edit `websocket-server.js` lines 6-7:
```javascript
const PORT = 8765;       // WebSocket port
const HTTP_PORT = 8008;  // HTTP server port
```

**After changing ports, update:**
1. Chrome extension: `chrome-extension/background.js` line 13
2. OBS Browser Source URL: `http://localhost:NEW_PORT`
3. Display HTML: `video-display.html` line 514

### Remote Access

To access from another computer on your network:

1. Edit `websocket-server.js`:
```javascript
const wss = new WebSocket.Server({ 
    host: '0.0.0.0',  // Listen on all network interfaces
    port: PORT 
});
```

2. Update extension WebSocket URL to your PC's IP:
```javascript
ws = new WebSocket('ws://192.168.1.100:8765');
```

3. Configure firewall to allow ports 8765 and 8008

## Architecture

### WebSocket Server (`websocket-server.js`)

```javascript
// Handles two types of clients:
// 1. Browser Extension - Sends video data
// 2. OBS Display - Receives and displays video data

// Message flow:
Extension → Server → OBS Display
OBS Display → Server → Extension  // For playlist navigation
```

**Key features:**
- Tracks all connected clients in a Set
- Identifies client type by User-Agent header
- Stores `currentVideoData` for late-joining clients
- Broadcasts messages to all clients except sender
- Handles graceful shutdown on SIGINT (Ctrl+C)

### HTTP Server

Simple HTTP server that:
- Serves `video-display.html` on `http://localhost:8008`
- Adds CORS headers for cross-origin access
- Returns 404 for any other path

### Display UI (`video-display.html`)

**Layout:**
```
┌─────────────────────────┐
│  [═══ Equalizer ═══]    │  ← Animated music bars
│   [Rotating Vinyl]      │  ← Spinning thumbnail/album
│        [Next Song]→     │  ← Next song preview (hover)
│                         │
│  ┌───────────────────┐  │
│  │ 🔍 Song Title     │  │  ← Search icon (if playlist)
│  │    Artist Name    │  │
│  │    💿 Album       │  │
│  │ ─────────────────│  │  ← Progress bar
│  │ 0:45      3:00    │  │  ← Time display
│  └───────────────────┘  │
│                    [⚙️] │  ← Config button
└─────────────────────────┘
```

**Features:**
- 💿 Rotating vinyl disk with realistic grooves and center hole
- 🎚️ 10-bar animated equalizer with randomized motion
- 🖼️ Album cover crossfade (alternates every 15 seconds)
- ⏭️ Next song preview (shows on hover or at 85% progress)
- 🎨 6 theme presets with customizable colors
- ⚙️ Full configuration UI (show/hide, themes, effects, fonts)
- 🎼 Interactive playlist panel with search and navigation
- 🔀 Playlist shuffle/loop state persistence
- 📏 Adjustable font size, family, and corner radius
- 💾 Export/import configuration as JSON
- 🎨 Custom CSS injection support
- 🔄 Auto-reconnection on disconnect

## Message Protocol

### Extension → Server → Display

**Video update:**
```javascript
{
    title: "Artist - Song Title",
    songTitle: "Song Title",
    artist: "Artist Name",
    thumbnail: "https://...",
    currentTime: 45.2,
    duration: 180.5,
    progress: 25.04,
    playing: true,
    url: "https://youtube.com/...",
    site: "YouTube",
    playlist: {
        playlistId: "PLxxxxxx",
        items: [{
            index: 0,
            videoId: "dQw4w9WgXcQ",
            title: "Song Title",
            url: "https://...",
            isCurrent: true
        }],
        count: 50
    }
}
```

**Video stopped:**
```javascript
{
    type: 'stopped'
}
```

### Display → Server → Extension

**Navigate playlist:**
```javascript
{
    type: 'NAVIGATE_PLAYLIST',
    data: { direction: 'next' | 'prev' }
}
```

**Play specific video:**
```javascript
{
    type: 'PLAY_VIDEO',
    data: {
        videoId: "dQw4w9WgXcQ",
        url: "https://youtube.com/watch?v=..."
    }
}
```

**Request full playlist:**
```javascript
{
    type: 'LOAD_FULL_PLAYLIST'
}
```

## Display Customization

### Change Colors

Edit `video-display.html` CSS:

```css
/* Progress bar color */
.progress-fill {
    background: linear-gradient(90deg, #a78bfa 0%, #8b5cf6 100%);
}

/* Playlist border color */
.playlist-panel {
    border: 2px solid rgba(167, 139, 250, 0.6);
}

/* Glow effect */
.thumbnail-wrapper::after {
    box-shadow: 
        inset 0 0 30px rgba(167, 139, 250, 0.22),
        0 0 40px rgba(139, 92, 246, 0.27);
}
```

### Change Animations

```css
/* Rotation speed */
@keyframes rotate-thumbnail {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
}

.thumbnail-wrapper {
    animation: rotate-thumbnail 20s linear infinite;  /* Change 20s */
}
```

### Remove Playlist Feature

In `video-display.html`, add:
```css
.playlist-icon, .playlist-panel {
    display: none !important;
}
```

## Troubleshooting

### Port Already in Use

**Error:** `EADDRINUSE: address already in use`

**Find what's using the port:**
```bash
# Windows
netstat -ano | findstr :8765
netstat -ano | findstr :8008

# Mac/Linux
lsof -i :8765
lsof -i :8008
```

**Solutions:**
1. Close the conflicting application
2. Change ports in configuration

### OBS Shows "Connection Error"

**Causes:**
- WebSocket server not running
- Firewall blocking connection
- Wrong URL in browser source

**Solutions:**
1. Verify server is running: `npm start`
2. Check terminal for errors
3. Restart server
4. Right-click browser source → Refresh
5. Check firewall settings

### Display Not Updating

**Causes:**
- Extension not connected
- WebSocket connection broken
- CORS issues

**Solutions:**
1. Check extension popup shows "Connected"
2. Check browser console (F12) for errors
3. Restart both server and extension
4. Refresh OBS browser source

### High CPU Usage

**Causes:**
- Browser source FPS too high
- Complex animations
- Multiple visible instances

**Solutions:**
1. Lower FPS in OBS browser source (15-30 instead of 60)
2. Enable "Shutdown source when not visible"
3. Reduce animation complexity in CSS

## Performance Tips

1. **Lower FPS:** Set OBS Browser Source FPS to 15-30
2. **Hide when not visible:** Enable in browser source properties
3. **Smaller size:** Use 400×340 instead of larger dimensions
4. **Disable unused features:** Comment out playlist code if not needed

## Development

### Enable Debug Logging

Add to `websocket-server.js`:
```javascript
const DEBUG = true;

wss.on('connection', (ws, req) => {
    if (DEBUG) console.log('Headers:', req.headers);
});

ws.on('message', (data) => {
    if (DEBUG) console.log('Raw message:', data.toString());
});
```

### Test Display Without OBS

Open `video-display.html` directly in browser:
```
file:///path/to/video-display.html
```

Send test data via browser console:
```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.onopen = () => {
    ws.send(JSON.stringify({
        title: "Test Artist - Test Song",
        songTitle: "Test Song",
        artist: "Test Artist",
        thumbnail: "https://via.placeholder.com/300",
        currentTime: 45,
        duration: 180,
        progress: 25,
        playing: true,
        site: "YouTube"
    }));
};
```

## File Structure

```
web-server/
├── websocket-server.js        # WebSocket relay server
├── video-display.html         # OBS browser source UI
├── package.json               # Dependencies and scripts
├── start-server.bat          # Windows start script (visible)
├── start-server-hidden.vbs   # Windows start script (hidden)
├── stop-server.bat           # Windows stop script
├── PLAYLIST_FEATURE.md       # Playlist implementation docs
└── README.md                 # This file
```

## License

MIT License - See package.json for details

## Credits

**Author:** MGRDesarrollo - Manuel Garre Ros

---

*This README was written by Claude, an AI assistant by Anthropic.*
