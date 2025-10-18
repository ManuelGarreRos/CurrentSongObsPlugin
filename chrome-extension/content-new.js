let currentVideoData = null;
let updateInterval = null;

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
        window.location.href = message.data.url;
        sendResponse({success: true});
        return true;
    } else if (message.type === 'LOAD_FULL_PLAYLIST') {
        console.log('Sending cached playlist data');
        const playlist = getPlaylistInfo();
        sendResponse({success: true, playlist: playlist});
        return true;
    }
});
