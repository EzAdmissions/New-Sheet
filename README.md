# New Sheet

A desktop policy debate flow app for Windows and macOS.

---

## Download

### Windows
[**Download New Sheet Setup 2.0.0.exe**](https://github.com/EzAdmissions/New-Sheet/releases/latest)

### macOS
[**Download New Sheet 2.0.0.dmg**](https://github.com/EzAdmissions/New-Sheet/releases/latest)

> **Mac note:** After opening the DMG, drag New Sheet to Applications. On first launch, right-click the app icon, click Open, then click Open again (required once to bypass Gatekeeper on unsigned apps).

---

## What's new in V2

- **Team Viewer** - View your partner's flow live during a round. Works across any network (different Wi-Fi, hotspot, etc.). One person hosts, the other connects with a short session code. Partner's flow updates in real time with ~300ms latency.
- **Undo deleted flows** - Ctrl+Z now restores accidentally deleted sheets. Undo/redo buttons also added to the toolbar.
- **Space key bug fixed** - Typing in Round Info (judges field) no longer redirects focus to the sheet rename bar.
- **Mac installer** - Proper `.dmg` drag-to-install for Intel and Apple Silicon Macs.

---

## Features

- Policy and LD debate formats
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
