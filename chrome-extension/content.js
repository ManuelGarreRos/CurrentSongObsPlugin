let currentVideoData = null;
let updateInterval = null;

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
    
    return { songTitle, artist };
}

function getPlaylistInfo() {
    const urlParams = new URLSearchParams(window.location.search);
    const playlistId = urlParams.get('list');
    
    if (!playlistId) return null;
    
    const playlistItems = document.querySelectorAll('ytd-playlist-panel-video-renderer');
    const items = [];
    let minIndex = Infinity;
    let maxIndex = -Infinity;
    
    playlistItems.forEach((item, domIndex) => {
        const titleEl = item.querySelector('#video-title');
        const linkEl = item.querySelector('a#wc-endpoint');
        const videoId = linkEl?.href?.match(/v=([^&]+)/)?.[1];
        const isCurrent = item.hasAttribute('selected');
        const indexEl = item.querySelector('#index');
        const playlistIndex = indexEl ? parseInt(indexEl.textContent.trim()) - 1 : domIndex;
        
        if (playlistIndex < minIndex) minIndex = playlistIndex;
        if (playlistIndex > maxIndex) maxIndex = playlistIndex;
        
        if (titleEl && videoId) {
            items.push({
                index: playlistIndex,
                videoId: videoId,
                title: titleEl.textContent.trim(),
                url: `https://www.youtube.com/watch?v=${videoId}&list=${playlistId}`,
                playlistId: playlistId,
                isCurrent: isCurrent
            });
        }
    });
    
    console.log(`👀 Visible in DOM: ${items.length} items (indices ${minIndex === Infinity ? '?' : minIndex+1} to ${maxIndex === -Infinity ? '?' : maxIndex+1})`);
    
    return {
        playlistId: playlistId,
        items: items,
        count: items.length
    };
}

function getYouTubeVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer, h1.title.style-scope.ytd-video-primary-info-renderer, yt-formatted-string.style-scope.ytd-watch-metadata');
    const rawTitle = titleElement ? titleElement.textContent.trim() : document.title.replace(' - YouTube', '');
    
    const { songTitle, artist } = parseSongInfo(rawTitle);
    
    let thumbnail = '';
    
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('v');
    
    if (videoId) {
        thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    } else {
        const linkTag = document.querySelector('link[rel="image_src"]');
        if (linkTag) {
            thumbnail = linkTag.href;
        } else {
            const thumbnailMeta = document.querySelector('meta[property="og:image"]');
            if (thumbnailMeta) {
                thumbnail = thumbnailMeta.content;
            }
        }
    }

    const playlist = getPlaylistInfo();

    return {
        title: rawTitle,
        songTitle: songTitle,
        artist: artist,
        thumbnail: thumbnail,
        currentTime: video.currentTime,
        duration: video.duration,
        progress: video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0,
        playing: !video.paused,
        url: window.location.href,
        site: 'YouTube',
        playlist: playlist
    };
}

function getVimeoVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const titleElement = document.querySelector('.player-title');
    const title = titleElement ? titleElement.textContent.trim() : document.title.replace(' on Vimeo', '');

    return {
        title: title,
        thumbnail: '',
        currentTime: video.currentTime,
        duration: video.duration,
        progress: video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0,
        playing: !video.paused,
        url: window.location.href,
        site: 'Vimeo'
    };
}

function getGenericVideoInfo() {
    const video = document.querySelector('video');
    if (!video) return null;

    const thumbnailMeta = document.querySelector('meta[property="og:image"]');
    
    return {
        title: document.title,
        thumbnail: thumbnailMeta ? thumbnailMeta.content : '',
        currentTime: video.currentTime,
        duration: video.duration,
        progress: video.duration > 0 ? (video.currentTime / video.duration) * 100 : 0,
        playing: !video.paused,
        url: window.location.href,
        site: 'Generic'
    };
}

function getVideoInfo() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('youtube.com')) {
        return getYouTubeVideoInfo();
    } else if (hostname.includes('vimeo.com')) {
        return getVimeoVideoInfo();
    } else {
        return getGenericVideoInfo();
    }
}

function sendVideoInfo() {
    const videoData = getVideoInfo();
    
    if (videoData && videoData.playing) {
        if (JSON.stringify(videoData) !== JSON.stringify(currentVideoData)) {
            currentVideoData = videoData;
            try {
                chrome.runtime.sendMessage({
                    type: 'VIDEO_UPDATE',
                    data: videoData
                });
            } catch (error) {
                console.log('Extension context invalidated, please refresh the page');
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            }
        }
    } else if (currentVideoData && (!videoData || !videoData.playing)) {
        currentVideoData = null;
        try {
            chrome.runtime.sendMessage({
                type: 'VIDEO_STOPPED'
            });
        } catch (error) {
            console.log('Extension context invalidated, please refresh the page');
            if (updateInterval) {
                clearInterval(updateInterval);
                updateInterval = null;
            }
        }
    }
}

function init() {
    if (updateInterval) {
        clearInterval(updateInterval);
    }
    
    updateInterval = setInterval(sendVideoInfo, 1000);
    sendVideoInfo();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('load', init);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.type === 'NAVIGATE_PLAYLIST') {
        const direction = message.data.direction;
        console.log('Navigating playlist:', direction);
        
        if (direction === 'next') {
            const nextButton = document.querySelector('.ytp-next-button');
            console.log('Next button found:', !!nextButton);
            if (nextButton) {
                nextButton.click();
                console.log('✅ Clicked next button');
                sendResponse({success: true});
            } else {
                console.log('❌ Next button not found');
                sendResponse({success: false, error: 'Button not found'});
            }
        } else if (direction === 'prev') {
            const prevButton = document.querySelector('.ytp-prev-button');
            console.log('Prev button found:', !!prevButton);
            if (prevButton) {
                prevButton.click();
                console.log('✅ Clicked previous button');
                sendResponse({success: true});
            } else {
                console.log('❌ Previous button not found');
                sendResponse({success: false, error: 'Button not found'});
            }
        }
        return true;
    } else if (message.type === 'PLAY_VIDEO') {
        console.log('Playing video:', message.data.url);
        window.location.href = message.data.url;
        sendResponse({success: true});
        return true;
    } else if (message.type === 'LOAD_FULL_PLAYLIST') {
        console.log('📋 Sending cached playlist data');
        const playlist = getPlaylistInfo();
        sendResponse({success: true, playlist: playlist});
        return true;
    }
});
