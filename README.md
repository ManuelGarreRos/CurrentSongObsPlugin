# YoutubeMediaDisplay

> Real-time video information display for OBS Studio using WebSockets and Browser Extensions

Display currently playing videos from YouTube, Vimeo, Twitch, and other platforms directly in OBS Studio with a beautiful animated interface. Perfect for streamers who want to share what they're watching with their audience.

## Features

- 🎵 **Real-time video tracking** - Automatically detects and displays currently playing videos
- 🎨 **Beautiful animated UI** - Rotating thumbnail with glowing effects and smooth animations
- 📊 **Live progress tracking** - Progress bar with current time and duration
- 🎭 **Smart song parsing** - Automatically extracts artist and song title from video titles
- 🎼 **Playlist support** - Interactive playlist viewer with search functionality
- 🔄 **Auto-reconnection** - Automatically reconnects if connection is lost
- 🌐 **Multi-platform** - Supports YouTube, Vimeo, Twitch, Dailymotion, and generic video players
- ⚡ **No compilation needed** - Pure JavaScript, runs directly in Node.js

## Architecture

```
Browser Video → Chrome Extension → WebSocket Server → OBS Browser Source
                     ↓                    ↑
              Detects playback    Relays data to display
```

**Components:**
1. **Chrome Extension** (`chrome-extension/`) - Monitors video playback and sends data
2. **WebSocket Server** (`web-server/`) - Relays messages between extension and OBS
3. **OBS Browser Source** - Displays video information with animated UI

## Quick Start

### Prerequisites

- Node.js 14+ ([Download](https://nodejs.org/))
- OBS Studio ([Download](https://obsproject.com/))
- Chrome or Edge browser

### Installation

1. **Install dependencies:**
   ```bash
   cd web-server
   npm install
   ```

2. **Start the WebSocket server:**
   ```bash
   npm start
   ```
   Server runs on:
   - WebSocket: `ws://localhost:8765`
   - HTTP: `http://localhost:8008`

3. **Install Chrome extension:**
   - Open `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the `chrome-extension` folder

4. **Add Browser Source in OBS:**
   - Add new Browser Source
   - URL: `http://localhost:8008`
   - Width: `400`, Height: `340`
   - Check "Shutdown source when not visible"

5. **Test it:**
   - Play a video on YouTube
   - Video info should appear in OBS!

## Usage

### Starting the Server

**Windows:**
```batch
cd web-server
npm start
```

Or use the provided batch files:
- `start-server.bat` - Start server in visible window
- `start-server-hidden.vbs` - Start server hidden
- `stop-server.bat` - Stop the server

**Mac/Linux:**
```bash
cd web-server
npm start
```

### Supported Platforms

- ✅ YouTube (with playlist support)
- ✅ Vimeo
- ✅ Twitch
- ✅ Dailymotion
- ✅ Any site with HTML5 video players

### Playlist Features

When watching a YouTube playlist:
- 🔍 Click the search icon to view the full playlist
- 🔎 Search songs by title or number
- ▶️ Click any song to play it
- ⏭️ Navigate with next/previous buttons

## Configuration

### Change Ports

Edit `web-server/websocket-server.js`:
```javascript
const PORT = 8765;       // WebSocket port
const HTTP_PORT = 8008;  // HTTP server port
```

Then update:
- Chrome extension: `chrome-extension/background.js` line 13
- OBS Browser Source URL

### Customize Display

Edit `web-server/video-display.html`:
- Colors: Modify CSS gradient values
- Size: Adjust container dimensions
- Animation: Change rotation speed or effects

## Project Structure

```
YoutubeMediaDisplay/
├── chrome-extension/          # Browser extension
│   ├── manifest.json         # Extension configuration
│   ├── background.js         # WebSocket connection & message relay
│   ├── content.js            # Video detection & playlist scraping
│   ├── popup.html/js         # Extension popup UI
│   └── icon*.png             # Extension icons
├── web-server/               # WebSocket server & display
│   ├── websocket-server.js   # Server handling messages
│   ├── video-display.html    # OBS browser source UI
│   ├── package.json          # Dependencies
│   └── README.md             # Detailed server docs
├── AGENTS.md                 # Developer guidelines
└── README.md                 # This file
```

## Troubleshooting

### "Cannot find module 'ws'"
```bash
cd web-server
npm install
```

### "Address already in use"
Port 8765 or 8008 is taken by another application.
- Change ports in configuration
- Or close the conflicting application

### Extension shows "Not connected to OBS"
- Ensure WebSocket server is running (`npm start`)
- Check that port 8765 is correct
- Restart browser
- Check firewall settings

### Video playing but not showing in OBS
- Check browser console (F12) for errors
- Click extension icon - should show "Connected"
- Restart WebSocket server
- Refresh OBS browser source (right-click → Refresh)

## Development

### Run Server
```bash
cd web-server
node websocket-server.js
```

### Test Display Locally
Open `web-server/video-display.html` in browser and use browser console to send test data:
```javascript
const ws = new WebSocket('ws://localhost:8765');
ws.onopen = () => {
    ws.send(JSON.stringify({
        title: "Test Video",
        songTitle: "Test Song",
        artist: "Test Artist",
        thumbnail: "https://via.placeholder.com/150",
        currentTime: 45,
        duration: 180,
        progress: 25,
        playing: true
    }));
};
```

## Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - See package.json for details

## Credits

**Author:** MGRDesarrollo - Manuel Garre Ros  
**Documentation:** Generated with assistance from Claude (Anthropic)

## Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

*This README was written by Claude, an AI assistant by Anthropic.*
