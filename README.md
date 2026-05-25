# New Sheet

A desktop policy debate flow app for Windows and macOS.

---

## Download

### Windows
[**Download New Sheet Setup 2.1.0.exe**](https://github.com/EzAdmissions/New-Sheet/releases/latest)

### macOS
[**Download New Sheet 2.1.0.dmg**](https://github.com/EzAdmissions/New-Sheet/releases/latest)

> **Mac note:** After opening the DMG, drag New Sheet to Applications. On first launch, right-click the app icon, click Open, then click Open again (required once to bypass Gatekeeper on unsigned apps).

---

## What's new in V2.1

- **Two-way Team Viewer** - Both debaters now share live flows at the same time. Your partner's flow opens in a separate window so you can keep your own flow and your partner's flow visible simultaneously.
- **Public Forum format** - New PF rounds use Pro Constructive, Con Constructive, Pro Rebuttal, Con Rebuttal, Pro Summary, Con Summary, Pro Final Focus, and Con Final Focus.
- **Team Viewer setup cleanup** - The connection flow has clearer start/join language. The app still uses serverless WebRTC, so it needs a session code and reply code instead of a tiny single code.
- **Undo deleted flows** - Ctrl+Z now restores accidentally deleted sheets. Undo/redo buttons also added to the toolbar.
- **Space key bug fixed** - Typing in Round Info (judges field) no longer redirects focus to the sheet rename bar.
- **Mac installer** - Proper `.dmg` drag-to-install for Intel and Apple Silicon Macs.

---

## Features

- Policy, LD, and PF debate formats
- Aff/Off sheet tabs with drag reorder
- Keyboard-driven navigation (Tab, Enter, arrow keys)
- Argument extension arrows
- Export to CSV and HTML
- Multiple themes and UI styles
- Zoom (Ctrl+scroll)
- Undo/redo for cell edits and sheet deletions
- Team Viewer for live partner flow sync

---

## Build from source

```bash
npm install

# Development
npm run dev           # Vite dev server
npm run desktop:dev   # Electron with dev server

# Production builds
npm run dist:win      # Windows NSIS installer (run on Windows)
npm run dist:mac      # macOS DMG - Intel + Apple Silicon (run on a Mac)
```

**Mac build requirement:** `npm run dist:mac` must be run on a macOS machine. Apple does not allow cross-compilation for macOS from other platforms.

For a Gatekeeper-friendly public macOS build, run the mac build with an Apple Developer ID Application certificate available to electron-builder and notarization credentials set:

```bash
CSC_LINK=/path/to/developer-id-cert.p12
CSC_KEY_PASSWORD=certificate-password
APPLE_ID=apple-id@example.com
APPLE_APP_SPECIFIC_PASSWORD=app-specific-password
APPLE_TEAM_ID=TEAMID12345
npm run dist:mac
```

Unsigned workaround for private testers: right-click the app in Applications, choose Open, then confirm Open. If macOS still blocks the app, run:

```bash
xattr -dr com.apple.quarantine "/Applications/New Sheet.app"
```
