let currentVideoData = null;
let updateInterval = null;
let isTabVisible = !document.hidden;
let savedPlaylistStates = {
    shuffle: false,
    loop: 'none'
};

function getPlaylistStates() {
    const shuffleButton = document.querySelector('ytd-toggle-button-renderer button[aria-label*="aleatoria"], ytd-toggle-button-renderer button[aria-label*="Shuffle"]');
    const loopButton = document.querySelector('ytd-playlist-loop-button-renderer button[aria-label*="bucle"], ytd-playlist-loop-button-renderer button[aria-label*="loop"]');
    
    const shuffleActive = shuffleButton?.getAttribute('aria-pressed') === 'true';
    
    let loopState = 'none';
    if (loopButton) {
        const ariaLabel = loopButton.getAttribute('aria-label') || '';
        const title = loopButton.getAttribute('title') || '';
        const combinedText = (ariaLabel + ' ' + title).toLowerCase();
        
        if (combinedText.includes('una vez') || combinedText.includes('loop one')) {
            loopState = 'one';
        } else if (combinedText.includes('activado') || combinedText.includes('on')) {
            loopState = 'all';
        }
    }
    
    return { shuffle: shuffleActive, loop: loopState };
}

function savePlaylistStates() {
    const states = getPlaylistStates();
    if (states.shuffle !== savedPlaylistStates.shuffle || states.loop !== savedPlaylistStates.loop) {
        savedPlaylistStates = states;
        savePlaylistStatesToStorage();
    }
}

function restorePlaylistStates() {
    setTimeout(() => {
        const currentStates = getPlaylistStates();

        if (savedPlaylistStates.shuffle !== currentStates.shuffle) {
            const shuffleButton = document.querySelector('ytd-toggle-button-renderer button[aria-label*="aleatoria"], ytd-toggle-button-renderer button[aria-label*="Shuffle"]');
            if (shuffleButton) {
                shuffleButton.click();
            }
        }
        
        if (savedPlaylistStates.loop !== currentStates.loop) {
            const loopButton = document.querySelector('ytd-playlist-loop-button-renderer button[aria-label*="bucle"], ytd-playlist-loop-button-renderer button[aria-label*="loop"]');
            if (loopButton) {
                const clicksNeeded = {
                    'none': { 'one': 2, 'all': 1 },
                    'all': { 'none': 1, 'one': 1 },
                    'one': { 'none': 1, 'all': 2 }
                };
                
                const clicks = clicksNeeded[currentStates.loop]?.[savedPlaylistStates.loop] || 0;

                for (let i = 0; i < clicks; i++) {
                    setTimeout(() => loopButton.click(), i * 100);
                }
            }
        }
    }, 1000);
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
    
    updateInterval = setInterval(() => {
        sendVideoInfo();
        savePlaylistStates();
    }, 1000);
    sendVideoInfo();
    
    chrome.storage.local.get(['playlist_states'], (result) => {
        if (result.playlist_states) {
            savedPlaylistStates = result.playlist_states;
        }
    });
}

function savePlaylistStatesToStorage() {
    chrome.storage.local.set({
        playlist_states: savedPlaylistStates
    });
}

document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    
    if (isTabVisible) {
        if (!updateInterval) {
            init();
        } else {
            sendVideoInfo();
        }
    } else {
        console.log('Tab hidden, continuing updates in background');
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('load', init);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    if (message.type === 'REQUEST_UPDATE') {
        sendVideoInfo();
        sendResponse({success: true});
        return true;
    } else if (message.type === 'NAVIGATE_PLAYLIST') {
        const direction = message.data.direction;

        if (direction === 'next') {
            const nextButton = document.querySelector('.ytp-next-button');
            if (nextButton) {
                nextButton.click();
                sendResponse({success: true});
            } else {
                sendResponse({success: false, error: 'Button not found'});
            }
        } else if (direction === 'prev') {
            const prevButton = document.querySelector('.ytp-prev-button');
            if (prevButton) {
                prevButton.click();
                sendResponse({success: true});
            } else {
                sendResponse({success: false, error: 'Button not found'});
            }
        }
        return true;
    } else if (message.type === 'PLAY_VIDEO') {
        console.log('Playing video:', message.data.url);
        savePlaylistStates();
        window.location.href = message.data.url;
        
        window.addEventListener('load', () => {
            restorePlaylistStates();
        }, { once: true });
        
        sendResponse({success: true});
        return true;
    } else if (message.type === 'LOAD_FULL_PLAYLIST') {
        console.log('Sending cached playlist data');
        const playlist = getPlaylistInfo();
        sendResponse({success: true, playlist: playlist});
        return true;
    }
});
