# 🚀 Quick Setup: Public Releases Branch

## 📋 What We've Set Up

✅ **Private Repository** - `novaq_finance/desktop` (private)  
✅ **Public Releases Branch** - `releases` branch (public)  
✅ **Auto-Update System** - Electron Updater with GitLab  
✅ **Release Script** - Automated release process  

## 🎯 How It Works

```
Private Repository (novaq_finance/desktop)
├── main branch (private) ← Your source code
├── develop branch (private) ← Development
└── releases branch (public) ← Public releases only
    ├── dist/ (built files)
    ├── package.json
    └── latest.yml (update metadata)
```

## 🚀 Quick Start

### **1. Create Releases Branch**
```bash
# Create and push releases branch
git checkout -b releases
git push origin releases
```

### **2. Make Releases Branch Public**
1. Go to GitLab → Repository → Settings → General
2. Set releases branch visibility to "Public"
3. Keep main repository private

### **3. Release Your App**
```bash
# Automated release process
npm run release
```

## 📦 Release Process

### **What Happens:**
1. **Builds** your application
2. **Switches** to releases branch
3. **Commits** built files
4. **Pushes** to public releases branch
5. **Creates** release tag
6. **Returns** to main branch

### **User Experience:**
- ✅ **Auto-updates** work seamlessly
- ✅ **Source code** stays protected
- ✅ **Public distribution** enabled
- ✅ **Security** maintained

## 🔒 Security Benefits

### **What's Public:**
- Built application files
- Release notes
- Update metadata
- Version information

### **What's Private:**
- Source code
- Development history
- Internal documentation
- API keys and secrets

## 🎉 You're Ready!

### **Next Steps:**
1. **Create releases branch** in GitLab
2. **Make it public**
3. **Run first release**: `npm run release`
4. **Test auto-updates** in your app

### **Commands:**
```bash
# Development
npm run dev:live

# Release
npm run release

# Build only
npm run build
```

---

**Your NovaQ Desktop app now has secure, automated releases with public distribution! 🎯**
