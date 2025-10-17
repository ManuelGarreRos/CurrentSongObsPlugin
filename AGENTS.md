# Agent Guidelines for YoutubeMediaDisplay

## Build/Test Commands
- **Start server**: `cd web-server && npm start` (runs on http://localhost:8008 and ws://localhost:8765)
- **Install dependencies**: `cd web-server && npm install`
- **Test**: No test suite defined (package.json shows `echo "No tests specified"`)

## Code Style & Conventions

### JavaScript Style
- Use `let`/`const` for variables, avoid `var`
- Use camelCase for variables and functions
- Use PascalCase for class names (though no classes in current codebase)
- No semicolons required (codebase is inconsistent but generally omits them)
- Use single quotes for strings where possible

### Structure
- Chrome extension code goes in `chrome-extension/` directory
- WebSocket server and web display code goes in `web-server/` directory
- No compilation/build step needed - direct JavaScript execution

### Naming Conventions
- WebSocket constants: UPPERCASE (e.g., `PORT`, `HTTP_PORT`)
- Event handlers: prefix with `on` (e.g., `onopen`, `onmessage`)
- DOM element IDs: camelCase (e.g., `videoInfo`, `playlistPanel`)

### Error Handling
- Use try-catch blocks for JSON parsing and message handling
- Log errors with `console.error()`, info with `console.log()`
- Check WebSocket readyState before sending messages
- Handle chrome.runtime.lastError in extension code

### Best Practices
- Always check if elements exist before manipulating them
- Use strict equality (`===`) over loose equality (`==`)
- Clean up intervals/timeouts on disconnect or error
- Use optional chaining (`?.`) for safe property access
