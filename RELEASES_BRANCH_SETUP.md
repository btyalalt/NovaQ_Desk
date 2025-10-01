# 🌿 Public Releases Branch Setup

This guide explains how to set up a public branch for releases while keeping your main repository private.

## 📋 Strategy Overview

### **Repository Structure:**
```
Private Repository (novaq_finance/desktop)
├── main branch (private) - Source code
├── develop branch (private) - Development
└── releases branch (public) - Public releases only
```

### **Benefits:**
- ✅ **Source code protected** - Main branches stay private
- ✅ **Public distribution** - Users can download updates
- ✅ **Security** - Only built files are public
- ✅ **Easy management** - Automated release process

## 🚀 Setup Steps

### **1. Create Releases Branch**

```bash
# Create and push releases branch
git checkout -b releases
git push origin releases

# Make releases branch public
# Go to GitLab → Repository → Settings → General → Visibility
# Set releases branch to "Public"
```

### **2. Update package.json Configuration**

```json
{
  "build": {
    "publish": [
      {
        "provider": "gitlab",
        "owner": "novaq_finance",
        "repo": "desktop",
        "branch": "releases",
        "private": false
      }
    ]
  }
}
```

### **3. GitLab Branch Protection**

Set up branch protection rules:

1. **Go to**: Repository → Settings → Repository → Protected Branches
2. **Add Protection Rule**:
   - **Branch**: `releases`
   - **Allowed to merge**: Maintainers
   - **Allowed to push**: Maintainers
   - **Code owner approval**: Required

### **4. Automated Release Process**

Create a release script:

```bash
#!/bin/bash
# scripts/release.sh

# Build the application
npm run build

# Create release commit
git checkout releases
git add dist/
git commit -m "Release v$(node -p "require('./package.json').version")"

# Push to releases branch
git push origin releases

# Return to main branch
git checkout main
```

## 🔄 Workflow

### **Development Workflow:**
1. **Develop** on `main` branch (private)
2. **Test** on `develop` branch (private)
3. **Release** to `releases` branch (public)

### **Release Process:**
1. **Build** application
2. **Commit** built files to `releases` branch
3. **Push** to public releases branch
4. **Users** get auto-updates from public branch

## 🛡️ Security Considerations

### **What's Public:**
- ✅ Built application files
- ✅ Release notes
- ✅ Update metadata
- ✅ Version information

### **What's Private:**
- 🔒 Source code
- 🔒 Development history
- 🔒 Internal documentation
- 🔒 API keys and secrets

## 📦 Release Management

### **Version Control:**
```bash
# Update version
npm version patch  # 1.0.2 → 1.0.3
npm version minor  # 1.0.3 → 1.1.0
npm version major  # 1.1.0 → 2.0.0
```

### **Release Script:**
```bash
#!/bin/bash
# Complete release process

# 1. Update version
npm version patch

# 2. Build application
npm run build

# 3. Commit to releases branch
git checkout releases
git add dist/
git commit -m "Release v$(node -p "require('./package.json').version")"
git push origin releases

# 4. Tag release
git tag v$(node -p "require('./package.json').version")
git push origin --tags

# 5. Return to main
git checkout main
```

## 🎯 User Experience

### **Auto-Update Flow:**
1. **App checks** `releases` branch for updates
2. **Downloads** from public releases
3. **Installs** update automatically
4. **Source code** remains protected

### **Update Notifications:**
- Users see update notifications
- Download progress shown
- Install & restart functionality
- Error handling for failed updates

## 🔍 Monitoring

### **Release Analytics:**
- Download statistics from `releases` branch
- Update success rates
- User adoption metrics
- Error reporting

### **Security Monitoring:**
- Monitor access to `releases` branch
- Track download patterns
- Detect unusual activity
- Log security events

## 📋 Checklist

- [ ] Create `releases` branch
- [ ] Make `releases` branch public
- [ ] Set up branch protection
- [ ] Update package.json configuration
- [ ] Create release script
- [ ] Test release process
- [ ] Verify auto-updates work
- [ ] Monitor security

## 🚨 Important Notes

### **Branch Management:**
- Never commit source code to `releases` branch
- Only built files should be in `releases`
- Keep `releases` branch clean and minimal
- Regular cleanup of old releases

### **Security Best Practices:**
- Use branch protection rules
- Require code review for releases
- Monitor branch access
- Regular security audits

---

**This approach provides maximum security while enabling seamless auto-updates for your users.**
