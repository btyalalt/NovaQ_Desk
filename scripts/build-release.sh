#!/bin/bash

echo "🚀 Building NovaQ Desktop Release..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/

# Build the webpack bundle
echo "📦 Building webpack bundle..."
npm run webpack:build:prod

# Build the Electron app
echo "🔨 Building Electron app..."
npm run dist

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Build completed successfully!"
    echo "📁 Output directory: dist/"
    echo ""
    echo "📋 Next steps:"
    echo "1. Upload the installer files to your update server"
    echo "2. Ensure latest.yml files are accessible"
    echo "3. Test the auto-updater functionality"
    echo ""
    echo "🔧 To test locally:"
    echo "npm run update-server"
else
    echo "❌ Build failed!"
    exit 1
fi
