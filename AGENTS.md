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
- Semicolons are optional but be consistent within each file
- Use single quotes for strings where possible

### File Organization
- **Separate concerns**: Keep HTML, CSS, and JavaScript in separate files
- **Keep files under 300 lines**: If a file grows larger, consider splitting it
- **One responsibility per file**: Each file should have a clear, single purpose
- Chrome extension code goes in `chrome-extension/` directory
- WebSocket server and web display code goes in `web-server/` directory
- No compilation/build step needed - direct JavaScript execution

### Structure
- **Web server**: HTML uses `<link>` for CSS and `<script>` for JS (external files)
- **Extension**: Use multiple scripts in manifest.json content_scripts array
- **Parsers**: Platform-specific code goes in separate parser files

### Naming Conventions
- WebSocket constants: UPPERCASE (e.g., `PORT`, `HTTP_PORT`)
- Event handlers: prefix with `on` (e.g., `onopen`, `onmessage`)
- DOM element IDs: camelCase (e.g., `videoInfo`, `playlistPanel`)
- File names: kebab-case (e.g., `video-parsers.js`, `display.js`)

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
- Extract reusable functions into separate modules
- Document complex logic with comments

## Refactoring Notes
- New modular structure available (see REFACTORING.md)
- Old monolithic files kept for backward compatibility
- Migrate gradually using `-new` suffixed files for testing
