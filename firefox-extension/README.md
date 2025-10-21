# Current Video for OBS - Browser Extension

Chrome/Edge extension that detects video playback and sends information to OBS Studio via WebSocket.

## Overview

This extension monitors video playback across multiple platforms and sends real-time information about the currently playing video to a WebSocket server, which then displays it in OBS Studio.

## Features

- 🎥 **Automatic video detection** - Monitors all tabs for video playback
- 📡 **WebSocket communication** - Connects to `ws://localhost:8765`
- 🔄 **Auto-reconnection** - Automatically reconnects if server goes down
- 🎼 **Playlist scraping** - Extracts full YouTube playlist information
- 🎭 **Smart parsing** - Extracts artist and song title from video titles
- 💾 **Playlist caching** - Builds complete playlist as you browse
- ⚡ **Low overhead** - Updates every 1 second only when video is playing

## Installation

### Method 1: Load Unpacked (Development)

1. Open Chrome/Edge and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top-right corner)
3. Click **"Load unpacked"**
4. Select the `chrome-extension` folder
5. Extension should appear in your toolbar

### Method 2: Install from Chrome Web Store

*(Not yet published)*

## Configuration

### Change WebSocket URL

Edit `background.js` line 13:
```javascript
ws = new WebSocket('ws://localhost:8765');
```

Change `localhost:8765` to your server address.

## How It Works

### Architecture

```
Web Page (video playing)
    ↓
Content Script (content.js) - Detects video, scrapes info
    ↓
Background Script (background.js) - Manages WebSocket connection
    ↓
WebSocket Server (ws://localhost:8765)
    ↓
OBS Display
```

### Content Script (`content.js`)

Runs on every webpage and:
- Detects `<video>` elements
- Extracts video metadata (title, thumbnail, duration, progress)
- Scrapes YouTube playlist information
- Parses song titles to extract artist and song name
- Sends updates every 1 second when video is playing

### Background Script (`background.js`)

Runs persistently and:
- Maintains WebSocket connection to server
- Receives messages from content scripts
- Caches playlist data across page navigations
- Handles playlist navigation commands from OBS
- Auto-reconnects every 5 seconds if disconnected

### Popup (`popup.html/js`)

Simple UI that shows:
- Connection status (Connected/Disconnected)
- Currently playing video title
- Auto-checks connection every 5 seconds

## Supported Platforms

### Full Support (with metadata)
- ✅ **YouTube** - Title, thumbnail, playlist support
- ✅ **Vimeo** - Title, duration, progress
- ✅ **Generic sites** - Basic video detection

### Playlist Support
- ✅ **YouTube playlists** - Full scraping and caching
- ✅ **Navigation** - Next/previous controls
- ✅ **Search** - Filter songs by title
- ✅ **Click-to-play** - Jump to any song in playlist

## Message Protocol

### Sent to Server

**Video Update:**
```javascript
{
    type: 'VIDEO_UPDATE',
    data: {
        title: "Artist - Song Title",
        songTitle: "Song Title",
        artist: "Artist",
        thumbnail: "https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg",
        currentTime: 45.2,
        duration: 180.5,
        progress: 25.04,
        playing: true,
        url: "https://youtube.com/watch?v=...",
        site: "YouTube",
        playlist: {
            playlistId: "PLxxxxxx",
            items: [...],
            count: 50
        }
    }
}
```

**Video Stopped:**
```javascript
{
    type: 'VIDEO_STOPPED'
}
```

### Received from Server

**Navigate Playlist:**
```javascript
{
    type: 'NAVIGATE_PLAYLIST',
    data: { direction: 'next' | 'prev' }
}
```

**Play Specific Video:**
```javascript
{
    type: 'PLAY_VIDEO',
    data: {
        videoId: "dQw4w9WgXcQ",
        url: "https://youtube.com/watch?v=..."
    }
}
```

**Load Full Playlist:**
```javascript
{
    type: 'LOAD_FULL_PLAYLIST'
}
```

## Playlist Caching

The extension builds a complete playlist cache as you browse:
- Scrapes visible playlist items on each page
- Caches items by `playlistId` and `index`
- Merges new items with existing cache
- Clears cache when switching playlists
- Sends cumulative playlist data with each video update

## Song Title Parsing

Automatically extracts artist and song title using patterns:
- `Artist - Song Title`
- `Artist _ Song Title`
- `Artist | Song Title`
- `Artist ・ Song Title`
- `Artist by Song Title`
- `Artist 『Song Title』`
- `Artist "Song Title"`

Removes common noise:
- `[MV]`, `[Official Video]`, `(Official Video)`
- `Official Music Video`, `MV`, `M/V`
- `Lyrics`, `Audio`
- Parentheses and brackets with extra info

## Permissions

### Required Permissions

- **`tabs`** - Query active tabs to send messages
- **`storage`** - Store settings (currently unused)
- **`nativeMessaging`** - Future feature for native plugin

### Host Permissions

- `https://www.youtube.com/*` - YouTube video detection
- `https://vimeo.com/*` - Vimeo video detection
- `https://www.twitch.tv/*` - Twitch video detection
- `https://dailymotion.com/*` - Dailymotion video detection
- `*://*/*` - Generic video detection on all sites

## Troubleshooting

### Extension shows "Not connected to OBS"

**Cause:** WebSocket server is not running or blocked

**Solutions:**
1. Start the WebSocket server: `cd web-server && npm start`
2. Check firewall isn't blocking port 8765
3. Verify WebSocket URL is correct in `background.js`
4. Check browser console for errors (F12 → Console)

### Videos not detected

**Cause:** Content script not loaded or blocked

**Solutions:**
1. Refresh the webpage after installing extension
2. Check that page URL matches manifest permissions
3. Open browser console (F12) and look for content script logs
4. Ensure site is using HTML5 `<video>` element

### Playlist not showing

**Cause:** YouTube's dynamic content not loaded

**Solutions:**
1. Wait for playlist panel to load on YouTube
2. Scroll through playlist to load more items
3. Extension scrapes only visible playlist items
4. Use search feature to load more items on demand

### Extension context invalidated error

**Cause:** Extension was updated or reloaded while page was open

**Solutions:**
1. Refresh all tabs where videos are playing
2. Restart browser if issue persists

## Development

### Testing Extension

1. Open `chrome://extensions/`
2. Click **"Reload"** on the extension after making changes
3. Refresh any tabs where content script needs to reload
4. Open extension popup to check connection status
5. Check browser console (F12) for logs

### Debug Console Logs

**Content Script (per-tab):**
- Open page → F12 → Console
- Look for logs from `content.js`

**Background Script (persistent):**
- Open `chrome://extensions/`
- Click "service worker" or "background page" link
- Console shows logs from `background.js`

**Popup Script:**
- Right-click extension icon → Inspect popup
- Console shows logs from `popup.js`

## File Structure

```
chrome-extension/
├── manifest.json         # Extension configuration & permissions
├── background.js         # WebSocket connection & message relay
├── content.js            # Video detection & playlist scraping
├── popup.html            # Extension popup UI
├── popup.js              # Popup logic & connection status
├── icon16.png            # 16x16 icon
├── icon48.png            # 48x48 icon
├── icon128.png           # 128x128 icon
└── README.md             # This file
```

## Future Enhancements

- [ ] Settings page for WebSocket URL configuration
- [ ] Support for more video platforms
- [ ] Video thumbnail caching
- [ ] Keyboard shortcuts for playlist navigation
- [ ] Multiple WebSocket server support
- [ ] Chrome Web Store publication

## License

MIT License - See root package.json for details

## Credits

**Author:** MGRDesarrollo - Manuel Garre Ros

---

*This README was written by Claude, an AI assistant by Anthropic.*
