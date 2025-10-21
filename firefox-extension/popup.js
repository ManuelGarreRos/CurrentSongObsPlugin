const statusDiv = document.getElementById('status');
const videoInfoDiv = document.getElementById('videoInfo');
const videoTitleSpan = document.getElementById('videoTitle');

function checkConnection() {
    const ws = new WebSocket('ws://localhost:8765');
    
    ws.onopen = () => {
        statusDiv.textContent = 'Connected to OBS';
        statusDiv.className = 'status connected';
        ws.close();
    };
    
    ws.onerror = () => {
        statusDiv.textContent = 'Not connected to OBS';
        statusDiv.className = 'status disconnected';
    };
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'VIDEO_UPDATE') {
        videoInfoDiv.style.display = 'block';
        videoTitleSpan.textContent = message.data.title;
    } else if (message.type === 'VIDEO_STOPPED') {
        videoInfoDiv.style.display = 'none';
    }
});

checkConnection();
setInterval(checkConnection, 5000);
