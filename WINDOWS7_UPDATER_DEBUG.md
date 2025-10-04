# Windows 7 Updater Debug Guide

## Асуудал
Windows 7 дээр updater process "Please wait while update completes..." гэсэн мессежээр гацчихсан байна.

## Debugging алхамууд

### 1. Update.log файл шалгах
```
C:\novaq\NovaQ Desktop\update.log
```

Энэ файлд дараах мэдээллүүд байх ёстой:
- Process monitoring messages
- Current step information
- Error messages
- Download progress

### 2. Console дээр харах messages
```
🔍 Updater process monitoring started...
💡 If update takes too long, check update.log file
⏰ Process running for X seconds
📊 Last activity: Y seconds ago
🔍 Process PID: Z
```

### 3. Hanging detection messages
```
⚠️ Process appears to be hanging (no activity for 10 minutes)
💡 This may be due to Windows 7 compatibility issues
🔍 Current step: Step 2: Download
📁 Install directory: C:\novaq\NovaQ Desktop
📥 Download URL: https://desktop-f96376.gitlab.io/...
```

### 4. Manual debugging (Developer Console)
```javascript
// Manual updater trigger
window.electron.invoke('manual-updater-trigger', 'https://desktop-f96376.gitlab.io/NovaQ-Portable-1.0.4.zip')
  .then(result => console.log('Manual updater result:', result));

// Check current processes
tasklist /FI "IMAGENAME eq updater-32.exe"
```

### 5. Common hanging points
- **Step 2: Download** - HTTPS/TLS certificate issues
- **Step 4: Close App** - NovaQ Desktop process close issues
- **Step 6: Cleanup** - File permission issues
- **Step 7: Extract** - ZIP extraction problems

### 6. Windows 7 specific fixes
1. **TLS 1.2 enable** - enable-tls12.reg файл импортлох
2. **Run as Administrator** - Updater-г admin эрхтэйгээр ажиллуулах
3. **Antivirus disable** - Түр унтрааж шалгах
4. **Firewall check** - Windows Firewall шалгах

### 7. Force restart
```powershell
# Kill hanging updater process
taskkill /F /IM updater-32.exe

# Kill NovaQ Desktop process
taskkill /F /IM "NovaQ Desktop.exe"

# Restart application
```

## Expected log output
```
🚀 Starting NovaQ Desktop Update Process...
📊 Process monitoring started
🔍 Checking Windows compatibility...
📥 Step 2: Starting download...
⏰ Process running for 30 seconds
📥 Download progress: 25%
✅ Step 2: Download completed successfully!
🔄 Step 4: Closing NovaQ Desktop app...
✅ Step 4: Desktop app closed
🧹 Step 6: Cleaning up old files...
✅ Step 6: Old files cleanup completed
📦 Step 7: Extracting ZIP file...
✅ Step 7: ZIP extraction completed
✅ Update completed successfully!
```

## Troubleshooting
1. **Check update.log** for specific error messages
2. **Verify TLS 1.2** is enabled
3. **Check disk space** in C:\novaq\NovaQ Desktop
4. **Verify network connectivity** to download URL
5. **Check file permissions** in install directory
