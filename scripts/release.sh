#!/bin/bash

# NovaQ Desktop Release Script
# This script builds and releases to the public releases branch

set -e  # Exit on any error

echo "🚀 Starting NovaQ Desktop release process..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the desktop directory."
    exit 1
fi

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
print_status "Current version: $CURRENT_VERSION"

# Check if we have uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    print_warning "You have uncommitted changes. Please commit or stash them before releasing."
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Build the application
print_status "Building application..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed!"
    exit 1
fi

print_success "Build completed successfully!"

# Check if releases branch exists
if ! git show-ref --verify --quiet refs/remotes/origin/releases; then
    print_status "Creating releases branch..."
    git checkout -b releases
    git push origin releases
else
    print_status "Switching to releases branch..."
    git checkout releases
    git pull origin releases
fi

# Add built files
print_status "Adding built files to releases branch..."
git add dist/
git add package.json

# Check if there are changes to commit
if [ -z "$(git status --porcelain)" ]; then
    print_warning "No changes to commit. Build files are already up to date."
else
    # Commit changes
    COMMIT_MESSAGE="Release v$CURRENT_VERSION - $(date '+%Y-%m-%d %H:%M:%S')"
    print_status "Committing changes: $COMMIT_MESSAGE"
    git commit -m "$COMMIT_MESSAGE"
    
    # Push to releases branch
    print_status "Pushing to releases branch..."
    git push origin releases
    
    print_success "Successfully pushed to releases branch!"
fi

# Create and push tag
print_status "Creating release tag..."
git tag -f "v$CURRENT_VERSION"
git push origin "v$CURRENT_VERSION" --force

print_success "Release tag v$CURRENT_VERSION created and pushed!"

# Return to main branch
print_status "Switching back to main branch..."
git checkout main

print_success "🎉 Release process completed successfully!"
print_status "Version $CURRENT_VERSION is now available for auto-updates."
print_status "Users will receive update notifications automatically."

# Display next steps
echo
print_status "Next steps:"
echo "  1. Test the auto-update functionality"
echo "  2. Monitor update success rates"
echo "  3. Check user feedback"
echo "  4. Prepare for next release"

echo
print_success "Release v$CURRENT_VERSION is live! 🚀"
