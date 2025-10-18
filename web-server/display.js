const ws = new WebSocket('ws://localhost:8765');
const statusIndicator = document.getElementById('statusIndicator');
const connectionStatus = document.getElementById('connectionStatus');
const noVideo = document.getElementById('noVideo');
const videoInfo = document.getElementById('videoInfo');
const thumbnail = document.getElementById('thumbnail');
const albumCoverEl = document.getElementById('albumCover');
const title = document.getElementById('title');
const artist = document.getElementById('artist');
const album = document.getElementById('album');
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
let crossfadeInterval = null;
let showingAlbumCover = false;

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

function startCrossfade(videoThumbnail, albumCover) {
    if (crossfadeInterval) {
        clearInterval(crossfadeInterval);
    }
    
    thumbnail.src = videoThumbnail;
    albumCoverEl.src = albumCover;
    
    thumbnail.style.display = 'block';
    albumCoverEl.style.display = 'block';
    
    thumbnail.classList.remove('fade-out');
    albumCoverEl.classList.remove('fade-in');
    
    showingAlbumCover = false;
    
    crossfadeInterval = setInterval(() => {
        if (showingAlbumCover) {
            thumbnail.classList.remove('fade-out');
            albumCoverEl.classList.remove('fade-in');
            console.log('🖼️ Showing video thumbnail');
        } else {
            thumbnail.classList.add('fade-out');
            albumCoverEl.classList.add('fade-in');
            console.log('💿 Showing album cover');
        }
        showingAlbumCover = !showingAlbumCover;
    }, 15000);
}

function stopCrossfade() {
    if (crossfadeInterval) {
        clearInterval(crossfadeInterval);
        crossfadeInterval = null;
    }
    thumbnail.classList.remove('fade-out');
    albumCoverEl.classList.remove('fade-in');
    albumCoverEl.style.display = 'none';
}

function updateDisplay(data) {
    if (data.type === 'stopped' || !data.playing) {
        if (!hasDisplayedVideo) {
            noVideo.style.display = 'flex';
            videoInfo.classList.remove('active');
        }
        stopCrossfade();
        return;
    }

    hasDisplayedVideo = true;
    noVideo.style.display = 'none';
    videoInfo.classList.add('active');

    let displayTitle = data.songTitle || data.title || 'Unknown Title';
    let displayArtist = data.artist || 'Unknown Artist';
    
    if (!data.songTitle && data.title) {
        const { songTitle, artist: parsedArtist } = parseSongInfo(data.title);
        displayTitle = songTitle;
        displayArtist = parsedArtist;
    }
    
    if (data.metadataSource) {
        console.log(`📊 Using metadata from: ${data.metadataSource}`);
    }
    
    title.textContent = displayTitle;
    artist.textContent = displayArtist;
    
    if (data.album) {
        album.textContent = `💿 ${data.album}`;
        album.classList.add('show');
        console.log(`💿 Album: ${data.album}`);
    } else {
        album.textContent = '';
        album.classList.remove('show');
    }
    
    if (data.albumCover && data.videoThumbnail && data.albumCover !== data.videoThumbnail) {
        startCrossfade(data.videoThumbnail, data.albumCover);
    } else {
        stopCrossfade();
        const thumbnailToUse = data.albumCover || data.videoThumbnail || data.thumbnail;
        if (thumbnailToUse) {
            thumbnail.src = thumbnailToUse;
            thumbnail.style.display = 'block';
            albumCoverEl.style.display = 'none';
        } else {
            thumbnail.style.display = 'none';
        }
    }

    currentTimeEl.textContent = formatTime(data.currentTime || 0);
    durationEl.textContent = formatTime(data.duration || 0);

    const progress = data.progress || 0;
    progressFill.style.width = progress + '%';
    progressText.textContent = Math.round(progress) + '%';
    
    updateNextSongPreview(data, progress);

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

const defaultConfig = {
    theme: 'cyberpunk',
    visibility: {
        thumbnail: true,
        title: true,
        artist: true,
        album: true,
        progress: true,
        playlistIcon: true,
        equalizer: true,
        nextSongPreview: true
    },
    playlistIcon: {
        invisible: false,
        opacity: 100
    },
    display: {
        fontSize: 'medium',
        fontFamily: 'modern',
        crossfadeSpeed: 'normal',
        cornerRadius: 50,
        vinylLook: true,
        rotatingEffect: true
    },
    customCSS: ''
};

let currentConfig = { ...defaultConfig };

function loadConfig() {
    const saved = localStorage.getItem('displayConfig');
    if (saved) {
        try {
            currentConfig = { ...defaultConfig, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Failed to load config:', e);
        }
    }
    applyConfig();
}

function saveConfig() {
    localStorage.setItem('displayConfig', JSON.stringify(currentConfig));
}

function applyConfig() {
    applyTheme(currentConfig.theme);
    applyVisibility();
    applyDisplay();
    applyCustomCSS();
}

function openConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) {
        modal.classList.add('active');
        loadConfigToUI();
    }
}

function closeConfigModal() {
    document.getElementById('configModal').classList.remove('active');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    event.target.classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');
}

function selectTheme(themeName) {
    currentConfig.theme = themeName;
    saveConfig();
    applyTheme(themeName);
    
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
    document.querySelector(`[data-theme="${themeName}"]`).classList.add('selected');
}

const themes = {
    cyberpunk: {
        primary: 'rgba(139, 92, 246, 0.9)',
        secondary: 'rgba(167, 139, 250, 0.9)',
        glow1: 'rgba(167, 139, 250, 0.22)',
        glow2: 'rgba(139, 92, 246, 0.27)',
        glow3: 'rgba(167, 139, 250, 0.17)'
    },
    midnight: {
        primary: 'rgba(30, 58, 138, 0.9)',
        secondary: 'rgba(59, 130, 246, 0.9)',
        glow1: 'rgba(59, 130, 246, 0.22)',
        glow2: 'rgba(30, 58, 138, 0.27)',
        glow3: 'rgba(59, 130, 246, 0.17)'
    },
    purple: {
        primary: 'rgba(88, 28, 135, 0.9)',
        secondary: 'rgba(124, 58, 237, 0.9)',
        glow1: 'rgba(124, 58, 237, 0.22)',
        glow2: 'rgba(88, 28, 135, 0.27)',
        glow3: 'rgba(124, 58, 237, 0.17)'
    },
    pink: {
        primary: 'rgba(236, 72, 153, 0.9)',
        secondary: 'rgba(249, 168, 212, 0.9)',
        glow1: 'rgba(249, 168, 212, 0.22)',
        glow2: 'rgba(236, 72, 153, 0.27)',
        glow3: 'rgba(249, 168, 212, 0.17)'
    },
    mint: {
        primary: 'rgba(16, 185, 129, 0.9)',
        secondary: 'rgba(110, 231, 183, 0.9)',
        glow1: 'rgba(110, 231, 183, 0.22)',
        glow2: 'rgba(16, 185, 129, 0.27)',
        glow3: 'rgba(110, 231, 183, 0.17)'
    },
    warm: {
        primary: 'rgba(217, 119, 6, 0.9)',
        secondary: 'rgba(251, 191, 36, 0.9)',
        glow1: 'rgba(251, 191, 36, 0.22)',
        glow2: 'rgba(217, 119, 6, 0.27)',
        glow3: 'rgba(251, 191, 36, 0.17)'
    }
};

function applyTheme(themeName) {
    const theme = themes[themeName];
    if (!theme) return;
    
    document.documentElement.style.setProperty('--theme-primary', theme.primary);
    document.documentElement.style.setProperty('--theme-secondary', theme.secondary);
    document.documentElement.style.setProperty('--theme-glow1', theme.glow1);
    document.documentElement.style.setProperty('--theme-glow2', theme.glow2);
    document.documentElement.style.setProperty('--theme-glow3', theme.glow3);
}

function updateVisibility() {
    currentConfig.visibility = {
        thumbnail: document.getElementById('showThumbnail').checked,
        title: document.getElementById('showTitle').checked,
        artist: document.getElementById('showArtist').checked,
        album: document.getElementById('showAlbum').checked,
        progress: document.getElementById('showProgress').checked,
        playlistIcon: document.getElementById('showPlaylistIcon').checked,
        equalizer: document.getElementById('showEqualizer').checked,
        nextSongPreview: document.getElementById('showNextSongPreview').checked
    };
    
    currentConfig.playlistIcon.invisible = document.getElementById('playlistIconInvisible').checked;
    
    saveConfig();
    applyVisibility();
}

function applyVisibility() {
    const v = currentConfig.visibility;
    
    const thumbnailContainer = document.querySelector('.thumbnail-container');
    const titleEl = document.getElementById('title');
    const artistEl = document.getElementById('artist');
    const albumEl = document.getElementById('album');
    const progressContainer = document.querySelector('.progress-container');
    const icon = document.getElementById('playlistIcon');
    const equalizer = document.getElementById('equalizer');
    const nextPreview = document.getElementById('nextSongPreview');
    
    if (thumbnailContainer) {
        if (v.thumbnail) {
            thumbnailContainer.style.removeProperty('display');
        } else {
            thumbnailContainer.style.display = 'none';
        }
    }
    
    if (titleEl) {
        if (v.title) {
            titleEl.style.removeProperty('display');
        } else {
            titleEl.style.display = 'none';
        }
    }
    
    if (artistEl) {
        if (v.artist) {
            artistEl.style.removeProperty('display');
        } else {
            artistEl.style.display = 'none';
        }
    }
    
    if (albumEl) {
        if (v.album) {
            albumEl.style.removeProperty('display');
        } else {
            albumEl.style.display = 'none';
        }
    }
    
    if (progressContainer) {
        if (v.progress) {
            progressContainer.style.removeProperty('display');
        } else {
            progressContainer.style.display = 'none';
        }
    }
    
    if (icon) {
        if (!v.playlistIcon) {
            icon.style.display = 'none';
        } else if (currentConfig.playlistIcon.invisible) {
            icon.style.opacity = '0';
            icon.style.display = 'flex';
            icon.addEventListener('mouseenter', () => icon.style.opacity = '1');
            icon.addEventListener('mouseleave', () => icon.style.opacity = '0');
        } else {
            icon.style.display = 'flex';
            icon.style.opacity = currentConfig.playlistIcon.opacity / 100;
        }
    }
    
    if (equalizer) {
        equalizer.style.display = v.equalizer ? 'flex' : 'none';
    }
    
    if (nextPreview) {
        if (v.nextSongPreview) {
            nextPreview.classList.remove('hidden');
        } else {
            nextPreview.classList.add('hidden');
        }
    }
}

function updateIconOpacity(value) {
    document.getElementById('iconOpacityValue').textContent = value;
    currentConfig.playlistIcon.opacity = parseInt(value);
    saveConfig();
    applyVisibility();
}

function updateDisplayConfig() {
    currentConfig.display = {
        fontSize: document.getElementById('fontSize').value,
        fontFamily: document.getElementById('fontFamily').value,
        crossfadeSpeed: document.getElementById('crossfadeSpeed').value,
        cornerRadius: parseInt(document.getElementById('cornerRadius').value),
        vinylLook: document.getElementById('vinylLook').checked,
        rotatingEffect: document.getElementById('rotatingEffect').checked
    };
    
    saveConfig();
    applyDisplay();
}

function applyDisplay() {
    const d = currentConfig.display;
    
    const fontSizes = {
        small: '0.85',
        medium: '1',
        large: '1.15',
        xlarge: '1.3'
    };
    document.documentElement.style.setProperty('--font-scale', fontSizes[d.fontSize] || '1');
    
    const fontFamilies = {
        modern: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        classic: "Georgia, 'Times New Roman', serif",
        monospace: "'Courier New', Courier, monospace",
        rounded: "'Quicksand', 'Segoe UI', sans-serif"
    };
    document.body.style.fontFamily = fontFamilies[d.fontFamily] || fontFamilies.modern;
    
    const crossfadeSpeeds = {
        fast: '1s',
        normal: '2s',
        slow: '3s',
        off: '0s'
    };
    document.documentElement.style.setProperty('--crossfade-speed', crossfadeSpeeds[d.crossfadeSpeed] || '2s');
    
    const thumbnailContainer = document.querySelector('.thumbnail-container');
    const thumbnailWrapper = document.querySelector('.thumbnail-wrapper');
    
    if (thumbnailContainer) thumbnailContainer.style.borderRadius = d.cornerRadius + '%';
    if (thumbnailWrapper) thumbnailWrapper.style.borderRadius = d.cornerRadius + '%';
    
    if (thumbnailContainer) {
        if (d.vinylLook) {
            thumbnailContainer.classList.add('vinyl-effect');
        } else {
            thumbnailContainer.classList.remove('vinyl-effect');
        }
    }
    
    if (thumbnailWrapper) {
        if (d.rotatingEffect) {
            thumbnailWrapper.classList.add('rotating');
        } else {
            thumbnailWrapper.classList.remove('rotating');
        }
    }
}

function updateCornerRadius(value) {
    document.getElementById('cornerRadiusValue').textContent = value;
    currentConfig.display.cornerRadius = parseInt(value);
    saveConfig();
    applyDisplay();
}

function updateCustomCSS() {
    currentConfig.customCSS = document.getElementById('customCSS').value;
    saveConfig();
    applyCustomCSS();
}

function applyCustomCSS() {
    let styleEl = document.getElementById('customStyleTag');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'customStyleTag';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = currentConfig.customCSS;
}

function loadConfigToUI() {
    document.getElementById('showThumbnail').checked = currentConfig.visibility.thumbnail;
    document.getElementById('showTitle').checked = currentConfig.visibility.title;
    document.getElementById('showArtist').checked = currentConfig.visibility.artist;
    document.getElementById('showAlbum').checked = currentConfig.visibility.album;
    document.getElementById('showProgress').checked = currentConfig.visibility.progress;
    document.getElementById('showPlaylistIcon').checked = currentConfig.visibility.playlistIcon;
    document.getElementById('showEqualizer').checked = currentConfig.visibility.equalizer;
    document.getElementById('showNextSongPreview').checked = currentConfig.visibility.nextSongPreview;
    
    document.getElementById('playlistIconInvisible').checked = currentConfig.playlistIcon.invisible;
    document.getElementById('iconOpacity').value = currentConfig.playlistIcon.opacity;
    document.getElementById('iconOpacityValue').textContent = currentConfig.playlistIcon.opacity;
    
    document.getElementById('fontSize').value = currentConfig.display.fontSize;
    document.getElementById('fontFamily').value = currentConfig.display.fontFamily;
    document.getElementById('crossfadeSpeed').value = currentConfig.display.crossfadeSpeed;
    document.getElementById('cornerRadius').value = currentConfig.display.cornerRadius;
    document.getElementById('cornerRadiusValue').textContent = currentConfig.display.cornerRadius;
    document.getElementById('vinylLook').checked = currentConfig.display.vinylLook;
    document.getElementById('rotatingEffect').checked = currentConfig.display.rotatingEffect;
    
    document.getElementById('customCSS').value = currentConfig.customCSS;
    
    document.querySelectorAll('.theme-option').forEach(opt => opt.classList.remove('selected'));
    const selected = document.querySelector(`[data-theme="${currentConfig.theme}"]`);
    if (selected) selected.classList.add('selected');
}

function exportConfig() {
    const dataStr = JSON.stringify(currentConfig, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'youtube-display-config.json';
    link.click();
    URL.revokeObjectURL(url);
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    currentConfig = { ...defaultConfig, ...imported };
                    saveConfig();
                    applyConfig();
                    loadConfigToUI();
                    alert('Config imported successfully!');
                } catch (err) {
                    alert('Failed to import config: Invalid file format');
                }
            };
            reader.readAsText(file);
        }
    };
    input.click();
}

function resetConfig() {
    if (confirm('Reset all settings to defaults?')) {
        currentConfig = { ...defaultConfig };
        saveConfig();
        applyConfig();
        loadConfigToUI();
    }
}

loadConfig();

function updateNextSongPreview(data, progress) {
    const nextPreview = document.getElementById('nextSongPreview');
    if (!nextPreview || !currentConfig.visibility.nextSongPreview) return;
    
    if (!currentPlaylist || !currentPlaylist.items || currentPlaylist.items.length === 0) {
        nextPreview.classList.add('hidden');
        return;
    }
    
    const currentIndex = currentPlaylist.items.findIndex(item => item.isCurrent);
    if (currentIndex === -1 || currentIndex >= currentPlaylist.items.length - 1) {
        nextPreview.classList.add('hidden');
        return;
    }
    
    const nextSong = currentPlaylist.items[currentIndex + 1];
    if (nextSong) {
        nextPreview.classList.remove('hidden');
        
        const { songTitle, artist } = parseSongInfo(nextSong.title);
        document.getElementById('nextTitle').textContent = songTitle;
        document.getElementById('nextArtist').textContent = artist;
        
        if (progress >= 90) {
            nextPreview.classList.add('auto-show');
        } else {
            nextPreview.classList.remove('auto-show');
        }
    }
}
