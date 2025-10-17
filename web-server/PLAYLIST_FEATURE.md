# Playlist Feature Implementation Plan

## Overview
Add the ability to see the full YouTube playlist and click songs to play them directly from the OBS browser source.

## Architecture

```
YouTube Page → Extension (scrape playlist) → WebSocket Server → OBS Display (show & click) → Extension (navigate)
```

## Implementation Steps

### Phase 1: Capture Playlist Data (Browser Extension)

**Changes to `content.js`:**
```javascript
function getPlaylistInfo() {
    const playlistId = new URLSearchParams(window.location.search).get('list');
    if (!playlistId) return null;
    
    const items = [];
    const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer');
    
    playlistItems.forEach((item, index) => {
        const titleEl = item.querySelector('#video-title');
        const videoId = item.querySelector('a')?.href?.split('v=')[1]?.split('&')[0];
        
        if (titleEl && videoId) {
            items.push({
                index: index,
                videoId: videoId,
                title: titleEl.textContent.trim(),
                url: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`
            });
        }
    });
    
    return {
        playlistId: playlistId,
        items: items
    };
}
```

### Phase 2: WebSocket Protocol Extension

**New message types:**
```javascript
// Extension → Server
{
    type: 'PLAYLIST_UPDATE',
    data: {
        playlistId: 'PLxxxxxx',
        items: [...],
        currentIndex: 2
    }
}

// Display → Server → Extension
{
    type: 'PLAY_VIDEO',
    data: {
        videoId: 'dQw4w9WgXcQ',
        url: 'https://youtube.com/watch?v=...'
    }
}
```

### Phase 3: Display UI (OBS Browser Source)

**New UI Elements:**
```html
<!-- Playlist Toggle Button -->
<button id="playlistToggle" class="playlist-btn">
    🎵 Playlist (12)
</button>

<!-- Playlist Panel (Hidden by default) -->
<div id="playlistPanel" class="playlist-panel">
    <div class="playlist-header">
        <h3>Playlist</h3>
        <button id="closePlaylist">✕</button>
    </div>
    <div id="playlistItems" class="playlist-items">
        <!-- Dynamic items -->
    </div>
</div>
```

### Phase 4: Two-way Communication

**Extension listens for play requests:**
```javascript
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PLAY_VIDEO') {
        window.location.href = message.data.url;
    }
});
```

## Challenges & Solutions

### Challenge 1: YouTube's Dynamic Content
**Problem:** Playlist items load dynamically as you scroll  
**Solution:** Only show currently visible items, or trigger scroll events to load more

### Challenge 2: Extension → Page Communication
**Problem:** Content script can't directly control video playback  
**Solution:** Navigate to new URL with `window.location.href`

### Challenge 3: OBS Browser Source Input
**Problem:** OBS browser source has limited interaction capabilities  
**Solution:** Enable "Interact" in OBS source properties

### Challenge 4: Playlist Not Always Visible
**Problem:** YouTube hides playlist panel sometimes  
**Solution:** Click the playlist button programmatically or parse from page data

## UI Design Concept

```
┌─────────────────────────────────┐
│  [🎵 Playlist (12)]             │  ← Button to toggle
│                                  │
│  ╔═══════════════════════════╗  │
│  ║  Current Playlist     [✕] ║  │
│  ╠═══════════════════════════╣  │
│  ║  ▶ Song 1 - Artist 1      ║  │
│  ║  ● Song 2 - Artist 2      ║  ← Current (highlighted)
│  ║    Song 3 - Artist 3      ║  │
│  ║    Song 4 - Artist 4      ║  │
│  ║    Song 5 - Artist 5      ║  │
│  ╚═══════════════════════════╝  │
│                                  │
│  [Thumbnail] [Info] [Progress]  │
└─────────────────────────────────┘
```

## Simpler Alternative: Just Show Next/Previous

Instead of full playlist, add simple next/previous buttons:

```javascript
// In display
<button onclick="navigatePlaylist('prev')">⏮️ Prev</button>
<button onclick="navigatePlaylist('next')">⏭️ Next</button>

// Send to extension
function navigatePlaylist(direction) {
    ws.send(JSON.stringify({
        type: 'NAVIGATE_PLAYLIST',
        direction: direction
    }));
}

// In extension
if (message.type === 'NAVIGATE_PLAYLIST') {
    const button = direction === 'next' 
        ? document.querySelector('.ytp-next-button')
        : document.querySelector('.ytp-prev-button');
    button?.click();
}
```

## Recommendation

**Start with the simpler version:**
1. ✅ Add Next/Previous buttons to OBS display
2. ✅ Send commands to extension
3. ✅ Extension clicks YouTube's next/prev buttons

**Then expand if needed:**
- Show current playlist count
- Show next song title
- Eventually add full playlist view

## Estimated Complexity

- **Simple Next/Prev:** 🟢 Easy (1-2 hours)
- **Show Playlist List:** 🟡 Medium (4-6 hours)
- **Interactive Playlist:** 🔴 Complex (8-12 hours)

## Want me to implement this?

Let me know which version you'd like:
1. **Simple** - Just Next/Prev buttons
2. **Medium** - Show playlist list (read-only)
3. **Full** - Interactive playlist with click-to-play

I can start with option 1 (simplest) and we can build from there!
