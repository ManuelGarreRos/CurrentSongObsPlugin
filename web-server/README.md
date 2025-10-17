# Current Video OBS - Browser Source Version

**⚡ NO COMPILATION NEEDED! ⚡**

This is the simpler version that uses OBS's built-in Browser Source instead of a C++ plugin.

## Why This Version?

- ✅ **No C++ compilation required**
- ✅ **No OBS SDK needed**
- ✅ **Works on Windows, Mac, and Linux**
- ✅ **Easier to install and maintain**
- ✅ **Beautiful animated UI**
- ✅ **Same functionality as the plugin version**

## Requirements

- OBS Studio (any recent version)
- Node.js 14+ (https://nodejs.org/)
- Chrome/Edge browser
- The browser extension (in `../browser-extension`)

## Installation

### Step 1: Install Node.js

Download and install from https://nodejs.org/  
Choose the LTS (Long Term Support) version.

Verify installation:
```bash
node --version
npm --version
```

### Step 2: Install Dependencies

```bash
cd browser-source-version
npm install
```

### Step 3: Start the WebSocket Server

```bash
npm start
```

You should see:
```
✅ WebSocket server started on ws://localhost:8765
🌐 HTTP server started on http://localhost:8080

📋 Instructions:
   1. Add a Browser Source in OBS
   2. Set URL to: http://localhost:8080
   3. Set Width: 800, Height: 200
   4. Install and enable the browser extension
   5. Play a video in your browser
```

**Keep this terminal window open!** The server needs to run while using OBS.

### Step 4: Add Browser Source in OBS

1. Open **OBS Studio**
2. In the **Sources** panel, click **+**
3. Select **Browser Source**
4. Name it "Current Video" and click **OK**
5. In the properties:
   - **URL:** `http://localhost:8080`
   - **Width:** `800`
   - **Height:** `200`
   - **FPS:** `30`
   - ✅ Check "Shutdown source when not visible"
   - ✅ Check "Refresh browser when scene becomes active"
6. Click **OK**

### Step 5: Install Browser Extension

1. Open **Chrome** or **Edge**
2. Go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right)
4. Click **"Load unpacked"**
5. Navigate to and select the `browser-extension` folder (one level up)
6. Extension should appear in your toolbar

### Step 6: Test It!

1. Make sure the WebSocket server is running (`npm start`)
2. Go to **YouTube** and play a video
3. Check **OBS** - the video info should appear!

## Usage

### Starting the Server

**Method 1: Command Line**
```bash
cd browser-source-version
npm start
```

**Method 2: Double-click (Windows)**
Create `start-server.bat`:
```batch
@echo off
cd /d "%~dp0"
npm start
pause
```

**Method 3: Double-click (Mac/Linux)**
Create `start-server.sh`:
```bash
#!/bin/bash
cd "$(dirname "$0")"
npm start
```
Make executable: `chmod +x start-server.sh`

### Auto-start with Windows

1. Press `Win+R`, type `shell:startup`, press Enter
2. Create shortcut to `start-server.bat`
3. Server will start automatically when Windows starts

## Customization

### Change Colors

Edit `video-display.html` and modify the CSS:

```css
/* Background gradient */
.container {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

/* Progress bar color */
.progress-fill {
    background: linear-gradient(90deg, #00ff88 0%, #00cc6a 100%);
}
```

### Change Size

In OBS Browser Source properties:
- **Small:** 600 x 150
- **Medium:** 800 x 200 (default)
- **Large:** 1000 x 250

### Change Ports

Edit `websocket-server.js`:
```javascript
const PORT = 8765;       // WebSocket port
const HTTP_PORT = 8080;  // HTTP server port
```

Then update:
- OBS Browser Source URL
- Browser extension `background.js` WebSocket URL

## Troubleshooting

### ❌ "Cannot find module 'ws'"

**Solution:**
```bash
cd browser-source-version
npm install
```

### ❌ "Address already in use"

Port 8765 or 8080 is already used by another program.

**Solution 1:** Close the other program
**Solution 2:** Change ports (see Customization above)

To find what's using the port (Windows):
```bash
netstat -ano | findstr :8765
netstat -ano | findstr :8080
```

### ❌ Browser source shows "Connection Error"

**Solution:**
1. Make sure WebSocket server is running
2. Check terminal for errors
3. Try restarting the server
4. Refresh the browser source in OBS (right-click → Refresh)

### ❌ Extension shows "Not connected to OBS"

**Solution:**
1. Ensure WebSocket server is running
2. Check that port 8765 is correct
3. Restart browser
4. Check Windows Firewall isn't blocking Node.js

### ❌ Video playing but not showing in OBS

**Solution:**
1. Check browser console (F12) for errors
2. Click extension icon - should show "Connected"
3. Restart WebSocket server
4. Refresh OBS browser source

## Features

### Current Features
- ✨ Real-time video detection
- 📺 Support for YouTube, Vimeo, Twitch, etc.
- 🎨 Beautiful animated UI
- 📊 Live progress bar
- 🖼️ Video thumbnails
- 🔄 Auto-reconnection
- 💚 Connection status indicator

### Display Shows:
- Video title
- Thumbnail image
- Current time / Duration
- Progress bar with percentage
- Video platform (YouTube, Vimeo, etc.)
- Connection status

## Comparison: Browser Source vs C++ Plugin

| Feature | Browser Source | C++ Plugin |
|---------|---------------|-----------|
| Installation | ⚡ Easy | 😰 Complex |
| Compilation | ❌ Not needed | ✅ Required |
| Cross-platform | ✅ Yes | ❌ Windows only |
| OBS SDK | ❌ Not needed | ✅ Required |
| Customization | ⚡ Easy (HTML/CSS) | 😰 Hard (C++) |
| Performance | 💚 Good | 💚 Excellent |
| Resource usage | ~50MB RAM | ~5MB RAM |

**Recommendation:** Use Browser Source version unless you need absolute minimum resource usage.

## Performance Tips

1. **Lower FPS in OBS:** Set Browser Source FPS to 15-30 instead of 60
2. **Hide when not visible:** Enable "Shutdown source when not visible"
3. **Smaller size:** Use 600x150 instead of 800x200 if possible

## Development

### Running in Development

```bash
cd browser-source-version
node websocket-server.js
```

### Testing Locally

Open `video-display.html` directly in browser:
```
file:///path/to/browser-source-version/video-display.html
```

Use browser console to manually send test data:
```javascript
ws = new WebSocket('ws://localhost:8765');
ws.onopen = () => {
    ws.send(JSON.stringify({
        title: "Test Video",
        thumbnail: "https://via.placeholder.com/150",
        currentTime: 45,
        duration: 180,
        progress: 25,
        playing: true,
        site: "YouTube"
    }));
};
```

### Debugging

Enable debug logging in `websocket-server.js`:
```javascript
const DEBUG = true;

// Add logging
if (DEBUG) console.log('Debug info:', data);
```

## Advanced Usage

### Multiple Displays

You can create multiple browser sources with different styles:

1. Copy `video-display.html` to `video-display-compact.html`
2. Modify the CSS for compact view
3. Add different browser sources pointing to different files

### Remote Access

To access from another computer on your network:

1. Edit `websocket-server.js`:
```javascript
const wss = new WebSocket.Server({ 
    host: '0.0.0.0',  // Listen on all interfaces
    port: PORT 
});
```

2. Update browser extension to use your PC's IP:
```javascript
// In background.js
ws = new WebSocket('ws://192.168.1.100:8765');
```

3. Configure firewall to allow ports 8765 and 8080

## Support

- **Documentation:** See main README.md
- **Issues:** GitHub Issues
- **Questions:** GitHub Discussions

## Next Steps

- [X] Install Node.js
- [X] Run `npm install`
- [X] Run `npm start`
- [X] Add Browser Source to OBS
- [X] Install browser extension
- [X] Test with YouTube video

**Enjoy streaming! 🎥✨**
