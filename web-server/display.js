const ws = new WebSocket('ws://localhost:8765');
const statusIndicator = document.getElementById('statusIndicator');
const connectionStatus = document.getElementById('connectionStatus');
const noVideo = document.getElementById('noVideo');
const videoInfo = document.getElementById('videoInfo');
const thumbnail = document.getElementById('thumbnail');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
const playlistPanel = document.getElementById('playlistPanel');
const playlistIcon = document.getElementById('playlistIcon');
const playlistItems = document.getElementById('playlistItems');
const playlistCount = document.getElementById('playlistCount');

let reconnectInterval = null;
let hasDisplayedVideo = false;
let currentPlaylist = null;
let playlistUpdateInterval = null;
let isConnected = false;

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function parseSongInfo(rawTitle) {
    let songTitle = rawTitle;
    let artist = '';
    
    let cleanTitle = rawTitle
        .replace(/^\s*\[MV\]\s*/gi, '')
        .replace(/^\s*\[Official.*?\]\s*/gi, '')
        .replace(/^\s*\(Official.*?\)\s*/gi, '')
        .replace(/\s*Official\s+(Music\s+)?Video/gi, '')
        .replace(/\s*MV\s*$/gi, '')
        .replace(/\s*M\/V\s*$/gi, '')
        .trim();
    
    const patterns = [
        /^(.+?)\s*_\s*(.+?)$/,
        /^(.+?)\s*-\s*(.+?)$/,
        /^(.+?)\s*by\s+(.+?)$/i,
        /^(.+?)\s*\|\s*(.+?)$/,
        /^(.+?)\s*・\s*(.+?)$/,
        /(.+?)\s*『(.+?)』/,
        /^(.+?)\s+["'](.+?)["']$/
    ];
    
    for (const pattern of patterns) {
        const match = cleanTitle.match(pattern);
        if (match) {
            artist = match[1].trim();
            songTitle = match[2].trim();
            
            artist = artist.replace(/\s*\([^)]*\)/g, '').trim();
            artist = artist.replace(/\s*\[[^\]]*\]/g, '').trim();
            artist = artist.replace(/\s*【[^】]*】/g, '').trim();
            
            songTitle = songTitle.replace(/\s*\([^)]*\)/g, '').trim();
            songTitle = songTitle.replace(/\s*\[[^\]]*\]/g, '').trim();
            songTitle = songTitle.replace(/\s*【[^】]*】/g, '').trim();
            songTitle = songTitle.replace(/\s*Lyrics?$/gi, '').trim();
            songTitle = songTitle.replace(/\s*Audio$/gi, '').trim();
            
            break;
        }
    }
    
    if (!artist) {
        artist = cleanTitle;
        songTitle = cleanTitle;
    }

    console.log(`Parsed Title: "${songTitle}", Artist: "${artist}"`);
    
    return { songTitle, artist };
}

function updateDisplay(data) {
    if (data.type === 'stopped' || !data.playing) {
        if (!hasDisplayedVideo) {
            noVideo.style.display = 'flex';
            videoInfo.classList.remove('active');
        }
        return;
    }

    hasDisplayedVideo = true;
    noVideo.style.display = 'none';
    videoInfo.classList.add('active');

    const rawTitle = data.title || 'Unknown Title';
    const { songTitle, artist: parsedArtist } = parseSongInfo(rawTitle);
    
    title.textContent = songTitle;
    artist.textContent = parsedArtist;
    
    if (data.thumbnail) {
        thumbnail.src = data.thumbnail;
        thumbnail.style.display = 'block';
    } else {
        thumbnail.style.display = 'none';
    }

    currentTimeEl.textContent = formatTime(data.currentTime || 0);
    durationEl.textContent = formatTime(data.duration || 0);

    const progress = data.progress || 0;
    progressFill.style.width = progress + '%';
    progressText.textContent = Math.round(progress) + '%';

    if (data.playlist) {
        updatePlaylist(data.playlist);
    }
}

function updatePlaylist(playlist) {
    if (!playlist || !playlist.items || playlist.items.length === 0) {
        playlistIcon.classList.remove('show');
        currentPlaylist = null;
        if (playlistUpdateInterval) {
            clearInterval(playlistUpdateInterval);
            playlistUpdateInterval = null;
        }
        return;
    }

    const playlistChanged = !currentPlaylist || 
        currentPlaylist.count !== playlist.count ||
        JSON.stringify(currentPlaylist.items.map(i => i.videoId)) !== JSON.stringify(playlist.items.map(i => i.videoId));

    currentPlaylist = playlist;
    playlistIcon.classList.add('show');
    playlistCount.textContent = playlist.count;

    if (playlistChanged) {
        console.log(`📋 Playlist updated: ${playlist.count} songs`);
        const searchInput = document.getElementById('playlistSearch');
        renderPlaylistItems(searchInput ? searchInput.value : '');
    }
    
    if (!playlistUpdateInterval) {
        playlistUpdateInterval = setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'LOAD_FULL_PLAYLIST'
                }));
            }
        }, 5000);
    }
}

function renderPlaylistItems(filterText = '') {
    if (!currentPlaylist) return;

    playlistItems.innerHTML = '';
    const filter = filterText.toLowerCase();

    let filteredItems = currentPlaylist.items;
    if (filter) {
        filteredItems = currentPlaylist.items.filter(item => {
            const titleMatch = item.title.toLowerCase().includes(filter);
            const indexMatch = String(item.index + 1).includes(filter);
            return titleMatch || indexMatch;
        });
    }

    if (filteredItems.length === 0) {
        playlistItems.innerHTML = '<div style="color: rgba(255,255,255,0.5); text-align: center; padding: 20px;">No songs match your search</div>';
        return;
    }

    filteredItems.forEach((item) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'playlist-item' + (item.isCurrent ? ' current' : '');
        itemEl.onclick = () => playVideo(item);
        
        itemEl.innerHTML = `
            <div class="playlist-item-title">${item.isCurrent ? '▶ ' : ''}${item.title}</div>
            <div class="playlist-item-index">#${item.index + 1}</div>
        `;
        
        playlistItems.appendChild(itemEl);
    });
}

function filterPlaylist() {
    const searchInput = document.getElementById('playlistSearch');
    renderPlaylistItems(searchInput.value);
}

function togglePlaylist() {
    playlistPanel.classList.toggle('show');
    
    if (playlistPanel.classList.contains('show')) {
        document.getElementById('playlistSearch').value = '';
        renderPlaylistItems();
    }
}

function playVideo(item) {
    console.log('Playing video:', item);
    document.getElementById('playlistSearch').value = '';
    renderPlaylistItems();
    togglePlaylist();
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'PLAY_VIDEO',
            data: {
                videoId: item.videoId,
                url: item.url
            }
        }));
    }
}

ws.onopen = () => {
    console.log('✅ Connected to WebSocket server');
    isConnected = true;
    statusIndicator.classList.remove('disconnected');
    connectionStatus.textContent = 'Connected';
    
    if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
    }
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        updateDisplay(data);
    } catch (error) {
        console.error('❌ Error parsing message:', error);
    }
};

ws.onclose = () => {
    if (isConnected) {
        console.log('🔌 Disconnected from server, reloading in 5 seconds...');
    }
    isConnected = false;
    statusIndicator.classList.add('disconnected');
    connectionStatus.textContent = 'Disconnected';
    
    if (!reconnectInterval) {
        reconnectInterval = setInterval(() => {
            location.reload();
        }, 5000);
    }
};

ws.onerror = () => {
    if (isConnected) {
        console.log('⚠️ WebSocket connection error');
    }
    statusIndicator.classList.add('disconnected');
    connectionStatus.textContent = 'Waiting for server...';
};
