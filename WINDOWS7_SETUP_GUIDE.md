# Windows 7 CAPTCHA Setup Guide

## Асуудал
Windows 7 дээр CAPTCHA цонх `chrome-error://chromewebdata/` гэж саатаж, body length=0 гарч байна.

## Шийдэл

### 1. Системийн цаг/он сар шалгах
- Control Panel → Date and Time → зөв цаг/он сар тохируулах

### 2. Windows Updates суулгах (SP1 шаардлагатай)
- **KB3140245** - WinHTTP/Schannel дээр TLS 1.1/1.2 идэвхжүүлдэг
- **KB3020369** (SSU) - байхгүй бол
- **KB3125574** (Convenience rollup) - байхгүй бол  
- **KB4474419** (SHA-2 support) + **KB4490628** (SSU 2019)

### 3. TLS 1.2 идэвхжүүлэх
`enable-tls12.reg` файлыг double-click хийж registry-д импортлох:
- Double-click `enable-tls12.reg`
- "Yes" дарж импортлох
- **Restart** хийх

### 4. Root certificates шинэчлэх
- Windows Update ажиллуулах
- Эсвэл "Trusted Root Certification Authorities" store руу шинэчлэл импортлох

### 5. Internet Explorer тохиргоо
- Internet Explorer → Tools → Internet Options → Advanced
- "Use TLS 1.2" ✓ (баталгаажуулах зорилгоор)

### 6. Antivirus/Proxy шалгах
- Antivirus түр унтрааж шалгах
- Proxy settings шалгах

### 7. GPU driver шинэчлэх
- GPU driver шинэчлэх
- Device Manager → Display adapters → Update driver

## Build файлууд

### Windows 7 32-bit дээр ажиллах:
- `release\win-ia32-unpacked\` - 32-bit build
- `release\NovaQ-Portable-1.0.4.zip` - 32-bit portable

### Windows 7 64-bit болон Windows 10/11 дээр:
- `release\win-unpacked\` - 64-bit build  
- `release\NovaQ-Portable-1.0.4.zip` - universal build

## Тест хийх
1. Chrome/Firefox-оор `https://e.khanbank.com/auth/login` шалгах
2. Хэрэв энд хоосон бол → ОС/TLS асуудал
3. Хэрэв энд зөв бол → Electron compatibility асуудал
