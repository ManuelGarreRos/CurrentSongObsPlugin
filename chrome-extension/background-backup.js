let ws = null;
let reconnectInterval = null;
let currentVideoData = null;
let cachedPlaylistItems = new Map();
let lastPlaylistId = null;
let isConnected = false;
let hasLoggedDisconnection = false;

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    try {
        ws = new WebSocket('ws://localhost:8765');

        ws.onopen = () => {
            console.log('✅ Connected to OBS WebSocket server');
            isConnected = true;
            hasLoggedDisconnection = false;
            
            if (reconnectInterval) {
                clearInterval(reconnectInterval);
                reconnectInterval = null;
            }
            
            if (currentVideoData) {
                ws.send(JSON.stringify(currentVideoData));
            }
        };

        ws.onclose = () => {
            const wasConnected = isConnected;
            isConnected = false;
            ws = null;
            
            if (wasConnected && !hasLoggedDisconnection) {
                console.log('🔌 Disconnected from OBS server, will retry...');
                hasLoggedDisconnection = true;
            }
            
            if (!reconnectInterval) {
                reconnectInterval = setInterval(connectWebSocket, 5000);
            }
        };

        ws.onerror = () => {
            if (isConnected) {
                console.log('⚠️ WebSocket connection error');
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                if (message.type === 'NAVIGATE_PLAYLIST') {
                    console.log('Received NAVIGATE_PLAYLIST command:', message.data.direction);
                    
                    chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            tabs.forEach(tab => {
                                chrome.tabs.sendMessage(tab.id, message, (response) => {
                                    if (chrome.runtime.lastError) {
                                        // Ignore connection errors (tab may not have content script loaded)
                                    }
                                });
                            });
                        }
                    });
                } else if (message.type === 'PLAY_VIDEO') {
                    console.log('Received PLAY_VIDEO command:', message.data);
                    
                    chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            tabs.forEach(tab => {
                                chrome.tabs.sendMessage(tab.id, message, (response) => {
                                    if (chrome.runtime.lastError) {
                                        // Ignore connection errors (tab may not have content script loaded)
                                    }
                                });
                            });
                        }
                    });
                } else if (message.type === 'LOAD_FULL_PLAYLIST') {
                    console.log('Received LOAD_FULL_PLAYLIST command');
                    
                    chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            tabs.forEach(tab => {
                                chrome.tabs.sendMessage(tab.id, message, (response) => {
                                    if (chrome.runtime.lastError) {
                                        // Ignore connection errors (tab may not have content script loaded)
                                    } else if (response && response.playlist) {
                                        const mergedPlaylist = mergePlaylistData(response.playlist);
                                        if (mergedPlaylist && ws.readyState === WebSocket.OPEN) {
                                            ws.send(JSON.stringify({
                                                ...currentVideoData,
                                                playlist: mergedPlaylist
                                            }));
                                        }
                                    }
                                });
                            });
                        }
                    });
                }
            } catch (error) {
                console.error('Error parsing message:', error);
            }
        };

    } catch (error) {
        console.error('Failed to connect:', error);
        if (!reconnectInterval) {
            reconnectInterval = setInterval(connectWebSocket, 5000);
        }
    }
}

function mergePlaylistData(newPlaylist) {
    if (!newPlaylist || !newPlaylist.playlistId) return null;
    
    if (lastPlaylistId && lastPlaylistId !== newPlaylist.playlistId) {
        console.log(`New playlist detected, clearing cache`);
        cachedPlaylistItems.clear();
    }
    lastPlaylistId = newPlaylist.playlistId;
    
    let newItemsAdded = 0;
    
    if (newPlaylist.items) {
        newPlaylist.items.forEach(item => {
            const cacheKey = `${newPlaylist.playlistId}_${item.index}`;
            if (!cachedPlaylistItems.has(cacheKey)) {
                cachedPlaylistItems.set(cacheKey, item);
                newItemsAdded++;
            }
        });
    }
    
    const cachedForThisPlaylist = Array.from(cachedPlaylistItems.values())
        .filter(item => item.playlistId === newPlaylist.playlistId)
        .sort((a, b) => a.index - b.index);
    
    cachedForThisPlaylist.forEach(item => item.isCurrent = false);
    const currentItem = cachedForThisPlaylist.find(item => item.isCurrent || 
        newPlaylist.items?.find(newItem => newItem.isCurrent && newItem.videoId === item.videoId));
    if (currentItem) currentItem.isCurrent = true;
    
    if (newItemsAdded > 0) {
        console.log(`Added ${newItemsAdded} new songs. Total cache: ${cachedForThisPlaylist.length}`);
    }
    console.log(`Background cache: ${cachedForThisPlaylist.length} songs`);
    
    return {
        playlistId: newPlaylist.playlistId,
        items: cachedForThisPlaylist,
        count: cachedForThisPlaylist.length
    };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'VIDEO_UPDATE') {
        currentVideoData = message.data;
        
        if (message.data.playlist) {
            const mergedPlaylist = mergePlaylistData(message.data.playlist);
            if (mergedPlaylist) {
                currentVideoData.playlist = mergedPlaylist;
            }
        }
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(currentVideoData));
        }
    } else if (message.type === 'VIDEO_STOPPED') {
        currentVideoData = null;
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stopped' }));
        }
    }
});

connectWebSocket();
