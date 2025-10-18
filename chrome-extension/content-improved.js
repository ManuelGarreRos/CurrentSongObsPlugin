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
    if (isRestoring) {
        return;
    }
    
    const states = getPlaylistStates();
    if (states.shuffle !== savedPlaylistStates.shuffle || states.loop !== savedPlaylistStates.loop) {
        savedPlaylistStates = states;
        savePlaylistStatesToStorage();
    }
}

let isRestoring = false;

function restorePlaylistStates() {
    isRestoring = true;
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
        
        setTimeout(() => {
            isRestoring = false;
        }, 500);
    }, 3000);
}

function savePlaylistStatesToStorage() {
    chrome.storage.local.set({
        playlist_states: savedPlaylistStates
    });
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
            
            const url = location.href;
            if (url.includes('&list=') || url.includes('?list=')) {
                restorePlaylistStates();
            }
        }
    });
}

document.addEventListener('visibilitychange', () => {
    isTabVisible = !document.hidden;
    
    if (isTabVisible) {
        console.log('Tab became visible, resuming updates');
        if (!updateInterval) {
            init();
        } else {
            sendVideoInfo();
        }
    } else {
        console.log('Tab hidden, continuing updates in background');
    }
});

let lastUrl = location.href;
function startUrlMonitoring() {
    setInterval(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            if (url.includes('&list=') || url.includes('?list=')) {
                restorePlaylistStates();
            }
        }
    }, 500);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('load', () => {
    init();
    startUrlMonitoring();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Content script received message:', message);
    
    if (message.type === 'REQUEST_UPDATE') {
        sendVideoInfo();
        sendResponse({success: true});
        return true;
    } else if (message.type === 'NAVIGATE_PLAYLIST') {
        const direction = message.data.direction;
        console.log('Navigating playlist:', direction);
        
        if (direction === 'next') {
            const nextButton = document.querySelector('.ytp-next-button');
            console.log('Next button found:', !!nextButton);
            if (nextButton) {
                nextButton.click();
                console.log('Clicked next button');
                sendResponse({success: true});
            } else {
                console.log('Next button not found');
                sendResponse({success: false, error: 'Button not found'});
            }
        } else if (direction === 'prev') {
            const prevButton = document.querySelector('.ytp-prev-button');
            console.log('Prev button found:', !!prevButton);
            if (prevButton) {
                prevButton.click();
                console.log('Clicked previous button');
                sendResponse({success: true});
            } else {
                console.log('Previous button not found');
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
