const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8765;
const HTTP_PORT = 8008;

const wss = new WebSocket.Server({ port: PORT });

let currentVideoData = null;
const clients = new Set();

wss.on('connection', (ws, req) => {
    const clientType = req.headers['user-agent']?.includes('Chrome') ? 'Browser Extension' : 'OBS Display';
    console.log(`Client connected: ${clientType}`);
    
    clients.add(ws);

    if (currentVideoData) {
        ws.send(JSON.stringify(currentVideoData));
    }

    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data.toString());
            if (message.type === 'NAVIGATE_PLAYLIST') {
            } else {
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
    let filePath = path.join(__dirname, req.url === '/' ? 'video-display.html' : req.url);
    
    const extname = path.extname(filePath);
    const contentTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'text/javascript',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.gif': 'image/gif'
    };
    
    const contentType = contentTypes[extname] || 'text/plain';
    
    fs.readFile(filePath, (err, content) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('404 Not Found');
            return;
        }

        res.writeHead(200, { 
            'Content-Type': contentType,
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
