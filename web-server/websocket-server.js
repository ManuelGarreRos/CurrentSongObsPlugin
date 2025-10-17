const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const HTTP_PORT = 8008;

const wss = new WebSocket.Server({ port: PORT });

let currentVideoData = null;
const clients = new Set();

console.log(`WebSocket server started on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
    const clientType = req.headers['user-agent']?.includes('Chrome') ? 'Browser Extension' : 'OBS Display';
    console.log(`📡 Client connected: ${clientType}`);
    
    clients.add(ws);

    if (currentVideoData) {
        ws.send(JSON.stringify(currentVideoData));
    }

    ws.on('message', (data) => {
        console.log(`Message received from ${clientType}`);
        console.log(`Raw data: ${data}`);
        try {
            const message = JSON.parse(data.toString());
            console.log(`Received message from ${clientType}:`, message);
            
            if (message.type === 'NAVIGATE_PLAYLIST') {
                console.log(`Playlist navigation: ${message.data.direction}`);
            } else if (message.type === 'LOAD_FULL_PLAYLIST') {
                console.log(`Request to load full playlist`);
            } else {
                console.log(`Video update: ${message.title || 'Stopped'}`);
                currentVideoData = message;
            }

            clients.forEach(client => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify(message));
                }
            });
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });

    ws.on('close', () => {
        console.log(`Client disconnected: ${clientType}`);
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

const server = http.createServer((req, res) => {
    const filePath = path.join(__dirname, 'video-display.html');
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        res.writeHead(200, { 
            'Content-Type': 'text/html',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(content);
    });
});

server.listen(HTTP_PORT, () => {
    console.log(`HTTP server started on http://localhost:${HTTP_PORT}`);
    console.log(`\nInstructions:`);
    console.log(`   1. Add a Browser Source in OBS`);
    console.log(`   2. Set URL to: http://localhost:${HTTP_PORT}`);
    console.log(`   3. Set Width: 800, Height: 200`);
    console.log(`   4. Install and enable the browser extension`);
    console.log(`   5. Play a video in your browser\n`);
});

process.on('SIGINT', () => {
    console.log('\nShutting down servers...');
    wss.close();
    server.close();
    process.exit(0);
});
