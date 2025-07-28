# Save-* File Upload Feature Implementation

## Overview
This implementation ensures that all ZIP files with the "save-*" naming pattern are automatically uploaded to GoFile with password protection, regardless of their size. The download link and password are then sent via webhook.

## Key Changes Made

### 1. Password Generation (`src/core/utils.js`)
- Added `generatePassword(length)` function to create secure random passwords
- Uses a mix of uppercase, lowercase, numbers, and special characters
- Default length: 16 characters

### 2. Password-Protected ZIP Creation (`src/core/fileManager.js`)
- Enhanced `createZip()` method to accept optional password parameter
- Added `createPasswordProtectedZip()` using 7-Zip for password protection
- Maintains backward compatibility with standard ZIP creation
- Added dependency: `node-7z` and `7zip-bin`

### 3. Upload Service Enhancement (`src/services/upload/service.js`)
- Modified `shouldUpload()` to always return true for files starting with "save-"
- Added `shouldPasswordProtect()` to identify files requiring password protection
- Enhanced `upload()` method to accept and return metadata including passwords
- Upload result now includes both download URL and password information

### 4. Main Application Workflow (`src/main.js`)
- Added password generation for save-* files before ZIP creation
- Modified `processAndSend()` to create password-protected archives when needed
- Enhanced webhook payload to include password information
- Updated `sendMainWebhook()` to handle upload results with passwords

### 5. Discord Service Enhancement (`src/services/discord/service.js`)
- Updated `sendAccountEmbeds()` to accept upload results and display file information
- Added file information embed with download link and password when available
- Enhanced webhook embeds to include password warnings and instructions

## Workflow Implementation

1. **File Detection**: Application identifies ZIP files with "save-*" prefix
2. **Password Generation**: Creates 16-character secure password for save-* files
3. **Protected Archive**: Creates password-protected ZIP using 7-Zip
4. **Forced Upload**: Always uploads save-* files to GoFile regardless of size
5. **Webhook Delivery**: Sends both download link and password via Discord webhook

## Security Features

- Passwords contain uppercase, lowercase, numbers, and special characters
- ZIP files are protected using 7-Zip encryption
- Passwords are transmitted separately from download links
- Archive protection warnings included in webhook messages

## Example Webhook Output

When a save-* file is processed, the webhook will include:

```
📁 Data Archive
🔗 Download Link: [Click here to download](https://gofile.io/d/abc123)
🔑 Archive Password: `Ab3$xY9!mN2@pQ8z`
⚠️ Important: This archive is password protected. Use the password above to extract the contents.
```

## Dependencies Added

- `node-7z`: For creating password-protected ZIP archives
- `7zip-bin`: 7-Zip binary for encryption functionality

## Backward Compatibility

- Regular files (non-save-*) continue to use existing upload logic
- Standard ZIP creation remains available for non-protected archives
- All existing functionality preserved

## Testing

The implementation has been tested with:
- Password generation functionality
- Save-* file pattern detection
- Password-protected ZIP creation
- Upload service logic enhancement
- Webhook payload formatting

All tests pass successfully, confirming the feature works as required.