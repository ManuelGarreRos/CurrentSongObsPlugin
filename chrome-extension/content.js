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
    
    console.log('🔍 Shuffle button:', shuffleButton);
    console.log('🔍 Loop button:', loopButton);
    
    const shuffleActive = shuffleButton?.getAttribute('aria-pressed') === 'true';
    
    let loopState = 'none';
    if (loopButton) {
        const ariaLabel = loopButton.getAttribute('aria-label') || '';
        const title = loopButton.getAttribute('title') || '';
        const combinedText = (ariaLabel + ' ' + title).toLowerCase();
        
        console.log('🔍 Loop button aria-label:', ariaLabel);
        console.log('🔍 Loop button title:', title);
        console.log('🔍 Combined text:', combinedText);
        
        if (combinedText.includes('una vez') || combinedText.includes('loop one')) {
            loopState = 'one';
        } else if (combinedText.includes('activado') || combinedText.includes('on')) {
            loopState = 'all';
        }
    }
    
    console.log('🎯 Detected states:', { shuffle: shuffleActive, loop: loopState });
    return { shuffle: shuffleActive, loop: loopState };
}

function savePlaylistStates() {
    console.log('🔄 savePlaylistStates() called');
    const states = getPlaylistStates();
    console.log('📊 Current states from getPlaylistStates():', states);
    console.log('📊 Saved states in memory:', savedPlaylistStates);
    if (states.shuffle !== savedPlaylistStates.shuffle || states.loop !== savedPlaylistStates.loop) {
        savedPlaylistStates = states;
        savePlaylistStatesToStorage();
        console.log('💾 Saved playlist states:', states);
    }
}

function restorePlaylistStates() {
    setTimeout(() => {
        const currentStates = getPlaylistStates();
        console.log('🔍 Current states:', currentStates);
        console.log('🔍 Saved states:', savedPlaylistStates);
        
        if (savedPlaylistStates.shuffle !== currentStates.shuffle) {
            const shuffleButton = document.querySelector('ytd-toggle-button-renderer button[aria-label*="aleatoria"], ytd-toggle-button-renderer button[aria-label*="Shuffle"]');
            if (shuffleButton) {
                console.log('🔀 Restoring shuffle state:', savedPlaylistStates.shuffle);
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
                console.log('🔁 Restoring loop state:', savedPlaylistStates.loop, `(${clicks} clicks)`);
                
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
            console.log('📦 Loaded saved playlist states:', savedPlaylistStates);
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

window.addEventListener('load', init);

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
