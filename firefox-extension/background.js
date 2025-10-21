let ws = null;
let reconnectInterval = null;
let currentVideoData = null;
let cachedPlaylistItems = new Map();
let lastPlaylistId = null;
let isConnected = false;
let hasLoggedDisconnection = false;

const STORAGE_KEY = 'youtube_playlist_cache';
const LAST_PLAYLIST_KEY = 'last_playlist_id';

async function loadPlaylistFromStorage() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEY, LAST_PLAYLIST_KEY]);
        
        if (result[STORAGE_KEY]) {
            const playlistArray = JSON.parse(result[STORAGE_KEY]);
            cachedPlaylistItems = new Map(playlistArray);
        }
        
        if (result[LAST_PLAYLIST_KEY]) {
            lastPlaylistId = result[LAST_PLAYLIST_KEY];
        }
    } catch (error) {
        console.error('❌ Error loading playlist from storage:', error);
    }
}

async function savePlaylistToStorage() {
    try {
        const playlistArray = Array.from(cachedPlaylistItems.entries());
        await chrome.storage.local.set({
            [STORAGE_KEY]: JSON.stringify(playlistArray),
            [LAST_PLAYLIST_KEY]: lastPlaylistId
        });
    } catch (error) {
        console.error('Error saving playlist to storage:', error);
    }
}

function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        return;
    }

    try {
        ws = new WebSocket('ws://localhost:8765');

        ws.onopen = () => {
            console.log('Connected to OBS WebSocket server');
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
                console.log('Disconnected from OBS server, will retry every 5 seconds...');
                hasLoggedDisconnection = true;
            }
            
            if (!reconnectInterval) {
                reconnectInterval = setInterval(connectWebSocket, 5000);
            }
        };

        ws.onerror = () => {
            if (isConnected) {
                console.log('WebSocket connection error');
            }
        };

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                
                if (message.type === 'NAVIGATE_PLAYLIST') {
                    chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            tabs.forEach(tab => {
                                chrome.tabs.sendMessage(tab.id, message, (response) => {
                                    if (chrome.runtime.lastError) {
                                    }
                                });
                            });
                        }
                    });
                } else if (message.type === 'PLAY_VIDEO') {
                    chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            const targetTab = tabs[0];
                            chrome.tabs.update(targetTab.id, { active: true }, () => {
                                chrome.tabs.sendMessage(targetTab.id, message, (response) => {
                                    if (chrome.runtime.lastError) {
                                    }
                                });
                            });
                        } else {
                            chrome.tabs.create({ url: message.data.url, active: true });
                        }
                    });
                } else if (message.type === 'LOAD_FULL_PLAYLIST') {
                    chrome.tabs.query({url: "*://*.youtube.com/*"}, (tabs) => {
                        if (tabs && tabs.length > 0) {
                            tabs.forEach(tab => {
                                chrome.tabs.sendMessage(tab.id, message, (response) => {
                                    if (chrome.runtime.lastError) {
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
        savePlaylistToStorage();
    }

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
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'stopped' }));
        }
    }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.url.includes('youtube.com')) {
        chrome.tabs.sendMessage(tab.id, { type: 'REQUEST_UPDATE' }, (response) => {
            if (chrome.runtime.lastError) {
            }
        });
    }
});

loadPlaylistFromStorage().then(() => {
    connectWebSocket();
});
