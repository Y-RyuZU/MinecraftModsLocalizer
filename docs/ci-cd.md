# CI/CD Documentation

## Overview

The MinecraftModsLocalizer project uses GitHub Actions for continuous integration and deployment. The pipeline automates testing, building, and releasing the application for multiple platforms.

## Workflows

### 1. Build and Release Workflow

**File**: `.github/workflows/build.yml`

**Triggers**:
- Push to main branch
- Version tags (v*)
- Pull requests to main
- Manual dispatch

**Jobs**:

#### Test Job
- Runs on Ubuntu latest
- Executes linting, type checking, and tests
- Must pass before build jobs start

#### Build Job
- Matrix build for multiple platforms:
  - Linux (x86_64) - AppImage, DEB
  - macOS Intel (x86_64) - DMG
  - macOS Apple Silicon (aarch64) - DMG  
  - Windows (x86_64) - NSIS, MSI
- Uses Tauri GitHub Action
- Caches dependencies for faster builds
- Uploads artifacts for 7 days

#### Release Job
- Only runs on version tags
- Creates draft GitHub release
- Attaches all build artifacts
- Generates release notes

### 2. PR Validation Workflow

**File**: `.github/workflows/pr-validation.yml`

**Triggers**:
- Pull request events (opened, synchronized, reopened)

**Checks**:
- Rust formatting (rustfmt)
- Rust linting (clippy)
- TypeScript linting (ESLint)
- Type checking
- Test suite execution
- Security audit (cargo audit)
- Build verification

### 3. Update Manifest Workflow

**File**: `.github/workflows/update-manifest.yml`

**Triggers**:
- Release published

**Actions**:
- Generates `latest.json` for Tauri updater
- Extracts version and asset URLs
- Uploads manifest to release

## Configuration

### Required Secrets

Configure these in GitHub repository settings:

1. **TAURI_PRIVATE_KEY** (optional)
   - Private key for code signing
   - Generated with: `tauri signer generate`

2. **TAURI_KEY_PASSWORD** (optional)
   - Password for the private key

### Environment Variables

- `RUST_BACKTRACE=1`: Enable Rust backtraces for debugging

## Build Matrix

| Platform | OS | Target | Bundles |
|----------|----|---------|---------| 
| Linux | ubuntu-22.04 | x86_64-unknown-linux-gnu | AppImage, DEB |
| macOS Intel | macos-latest | x86_64-apple-darwin | DMG |
| macOS ARM | macos-latest | aarch64-apple-darwin | DMG |
| Windows | windows-latest | x86_64-pc-windows-msvc | NSIS, MSI |

## Caching Strategy

The pipeline caches:
- Rust dependencies (cargo registry, build artifacts)
- Node modules
- Cache keys based on lock file hashes

## Release Process

### Automated Release

1. **Version Update**
   ```bash
   # Update version in src-tauri/tauri.conf.json
   # Update version in src-tauri/Cargo.toml
   ```

2. **Commit and Tag**
   ```bash
   git add .
   git commit -m "chore: bump version to v3.0.1"
   git tag v3.0.1
   git push origin main --tags
   ```

3. **Automated Steps**
   - CI builds for all platforms
   - Creates draft release
   - Uploads artifacts
   - Generates update manifest

4. **Manual Steps**
   - Review draft release
   - Update release notes
   - Publish release

### Manual Release

For hotfixes or special releases:

1. Go to Actions tab
2. Select "Build and Release" workflow
3. Click "Run workflow"
4. Select branch and run

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check system dependencies for Linux builds
   - Ensure Rust/Node versions match requirements
   - Review build logs for specific errors

2. **Cache Issues**
   - Caches expire after 7 days of inactivity
   - Clear cache through GitHub UI if corrupted

3. **Release Issues**
   - Ensure tag follows v* pattern
   - Check GitHub token permissions
   - Verify all artifacts uploaded

### Local Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
# Test PR validation
act pull_request

# Test build workflow
act push --secret-file .env.secrets
```

## Best Practices

1. **Version Management**
   - Use semantic versioning (MAJOR.MINOR.PATCH)
   - Keep version consistent across all files
   - Tag releases with v prefix

2. **Commit Messages**
   - Follow conventional commits
   - Include scope for clarity
   - Reference issues when applicable

3. **Dependencies**
   - Regular dependency updates
   - Security audit before releases
   - Test thoroughly after updates

4. **Performance**
   - Utilize caching effectively
   - Run jobs in parallel when possible
   - Minimize unnecessary builds