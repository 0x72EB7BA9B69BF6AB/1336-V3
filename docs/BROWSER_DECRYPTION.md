# Browser Data Decryption Implementation

## Overview
This implementation addresses the requirement to decrypt browser data and convert it to readable text files instead of saving raw encrypted database files.

## Key Changes

### 1. New Decryption Module (`src/modules/browsers/decryptor.js`)
- **BrowserDecryptor class**: Handles decryption and parsing of browser data
- **DPAPI Support**: Windows Data Protection API for older Chrome versions
- **Chrome v80+ Support**: AES-GCM decryption using master key from Local State
- **Multi-browser Support**: Chrome, Edge, Firefox, Opera, Brave
- **Data Type Parsers**: Passwords, cookies, history, downloads, autofill, bookmarks

### 2. Enhanced Browser Collector (`src/modules/browsers/collector.js`)
- **Integration**: Uses BrowserDecryptor for data processing
- **Text File Output**: Saves readable .txt files instead of raw databases
- **Structured Naming**: passwords.txt, history.txt, cookies.txt, etc.
- **Error Handling**: Graceful handling of decryption failures

### 3. Supported Data Types

#### Passwords (passwords.txt)
```
=== PASSWORDS (X entries) ===

[1] https://example.com
Username: user@example.com
Password: decryptedPassword123
Date Created: 2024-01-15 10:30:45
==================================================
```

#### History (history.txt)
```
=== HISTORY (X entries) ===

[1] Page Title
URL: https://example.com
Visit Count: 25
Last Visit: 2024-01-28 16:45:00
==================================================
```

#### Bookmarks (bookmarks.txt)
```
=== BOOKMARKS (X entries) ===

[1] Bookmark Name
URL: https://example.com
Folder: Bookmarks Bar/Subfolder
Date Added: 2024-01-01 12:00:00
==================================================
```

#### Cookies (cookies.txt)
```
=== COOKIES (X entries) ===

[1] host.example.com
Name: session_id
Value: abc123xyz
Path: /
Secure: true
HttpOnly: false
Expires: 2024-12-31 23:59:59
==================================================
```

### 4. Technical Features

#### Password Decryption
- **DPAPI**: For Chrome versions < 80 on Windows
- **AES-GCM**: For Chrome v80+ using master key extraction
- **Cross-platform**: Appropriate handling for non-Windows systems
- **Firefox**: Handles encrypted JSON format

#### Master Key Extraction
- Reads `Local State` file from browser user data directory
- Decrypts base64-encoded encrypted key using DPAPI
- Uses master key for Chrome v80+ password decryption

#### Database Parsing
- **SQLite**: Native parsing for Chrome-based browsers
- **JSON**: For Firefox passwords and Chrome bookmarks
- **Error Recovery**: Continues processing even if some files fail

### 5. File Structure in Archive

Before (raw encrypted files):
```
Browsers/
├── Chrome/
│   └── Default/
│       ├── Login Data (encrypted)
│       ├── History (encrypted)
│       └── Web Data (encrypted)
```

After (readable text files):
```
Browsers/
├── Chrome/
│   └── Default/
│       ├── passwords.txt (decrypted, readable)
│       ├── history.txt (parsed, readable)
│       ├── cookies.txt (parsed, readable)
│       ├── autofill.txt (parsed, readable)
│       ├── bookmarks.txt (parsed, readable)
│       └── downloads.txt (parsed, readable)
```

## Dependencies Added
- **sqlite3**: For SQLite database parsing
- **@primno/dpapi**: For Windows DPAPI decryption

## Browser Support
- ✅ Chrome (all versions including v80+)
- ✅ Microsoft Edge
- ✅ Firefox
- ✅ Opera
- ✅ Brave Browser

## Platform Support
- ✅ Windows (full decryption support)
- ✅ Linux/macOS (parsing support, encryption noted)

## Error Handling
- Graceful degradation when decryption fails
- Clear error messages in output files
- Continues processing other browsers/profiles
- Logs debug information for troubleshooting

This implementation fully addresses the requirement to decrypt browser data and provide readable text files instead of raw encrypted databases.