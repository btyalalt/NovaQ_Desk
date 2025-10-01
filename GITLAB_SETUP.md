# 🔄 NovaQ Desktop GitLab Auto-Update Setup

This guide explains how to set up automatic updates using GitLab instead of GitHub.

## 📋 Prerequisites

1. **GitLab Account**: Create account at [gitlab.com](https://gitlab.com)
2. **GitLab Repository**: Create a new repository for your app
3. **GitLab Token**: Personal access token with API permissions
4. **Code Signing**: For production releases (recommended)

## 🚀 Quick Setup

### 1. Create GitLab Account

1. Go to [gitlab.com](https://gitlab.com)
2. Click "Register now"
3. Fill in your details
4. Verify your email

### 2. Create Repository

1. Click "New Project"
2. Choose "Create blank project"
3. Set project name: `nova-desktop`
4. Set visibility: `Public` (for auto-updates)
5. Click "Create project"

### 3. Generate GitLab Token

1. Go to **User Settings** → **Access Tokens**
2. Create new token:
   - **Name**: `nova-desktop-updater`
   - **Scopes**: `api`, `read_repository`, `write_repository`
3. Copy the token (you won't see it again!)

### 4. Set Environment Variable

```bash
# macOS/Linux
export GL_TOKEN=your_gitlab_token_here

# Windows
set GL_TOKEN=your_gitlab_token_here
```

### 5. Update package.json

Make sure your `package.json` has the GitLab configuration:

```json
{
  "build": {
    "publish": [
      {
        "provider": "gitlab",
        "owner": "your-gitlab-username",
        "repo": "nova-desktop",
        "private": false
      }
    ]
  }
}
```

### 6. Build and Publish

```bash
# Build and publish to GitLab
npm run build

# Or build for specific platform
npm run build:mac
npm run build:win
npm run build:linux
```

## 🔧 GitLab-Specific Features

### **GitLab Releases**

GitLab releases work similarly to GitHub:
- Automatic release creation
- Asset uploads
- Release notes
- Version tagging

### **GitLab CI/CD Integration**

You can also set up GitLab CI/CD for automated builds:

```yaml
# .gitlab-ci.yml
stages:
  - build
  - release

build:
  stage: build
  script:
    - npm install
    - npm run build
  artifacts:
    paths:
      - dist/

release:
  stage: release
  script:
    - npm run build
  only:
    - tags
```

## 🎯 Advantages of GitLab

### **Free Features**
- ✅ Unlimited private repositories
- ✅ Unlimited CI/CD minutes
- ✅ Built-in container registry
- ✅ Advanced security scanning

### **Enterprise Features**
- ✅ Self-hosted option
- ✅ Advanced project management
- ✅ Built-in issue tracking
- ✅ Merge request workflows

## 🔍 Troubleshooting

### **Common GitLab Issues**

1. **Token Permissions**
   - Ensure token has `api` scope
   - Check repository access
   - Verify token is not expired

2. **Repository Access**
   - Make sure repository is public
   - Check project visibility settings
   - Verify owner permissions

3. **Build Failures**
   - Check GitLab CI/CD logs
   - Verify build dependencies
   - Check file size limits

## 📊 Monitoring

### **GitLab Analytics**
- Release download statistics
- Project activity metrics
- User engagement data
- Performance monitoring

### **Update Tracking**
- Monitor release downloads
- Track update success rates
- User feedback collection
- Error reporting

## 🛡️ Security

### **GitLab Security Features**
- ✅ Built-in security scanning
- ✅ Dependency vulnerability checks
- ✅ Container scanning
- ✅ SAST/DAST analysis

### **Code Signing**
Same as GitHub - sign your releases for security:

```json
{
  "build": {
    "mac": {
      "identity": "Your Developer ID"
    },
    "win": {
      "certificateFile": "path/to/certificate.p12"
    }
  }
}
```

## 🔄 Migration from GitHub

If you're migrating from GitHub:

1. **Export Data**: Download your GitHub repository
2. **Import to GitLab**: Use GitLab's import feature
3. **Update Configuration**: Change provider to `gitlab`
4. **Test Builds**: Verify everything works
5. **Update Documentation**: Point users to GitLab

## 📞 GitLab Support

- **Documentation**: [docs.gitlab.com](https://docs.gitlab.com)
- **Community**: [forum.gitlab.com](https://forum.gitlab.com)
- **Issues**: [gitlab.com/gitlab-org/gitlab/-/issues](https://gitlab.com/gitlab-org/gitlab/-/issues)

## 🎉 Success Checklist

- [ ] GitLab account created
- [ ] Repository created
- [ ] GitLab token generated
- [ ] Environment variable set
- [ ] package.json updated
- [ ] Build successful
- [ ] Release published
- [ ] Auto-updates working

---

**Note**: GitLab provides excellent alternatives to GitHub with additional features and often better free tier offerings.
