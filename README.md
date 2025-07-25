# Easy HTUI

A customizable entertainment hub for managing your apps, games, and services. Perfect for TV setups, kiosks, or any environment where you want a controller-friendly interface to launch your entertainment.

## Features

- **Keyboard & Controller Navigation** with full Xbox/PlayStation controller support
- **Admin Mode** for adding, editing, and deleting apps without touching code
- **Categories** for organizing your content (Streaming, Games, Applications, etc.)
- **Search Functionality** to quickly find what you're looking for
- **Export/Import** configuration for backup and sharing
- **Single Point of Entry** - starts server and launches browser automatically
- **Kiosk Mode** support for dedicated entertainment setups

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- A modern web browser (Chrome recommended for best compatibility)

### Installation & Setup

1. **Download or clone** this project to your desired location
2. **Double-click `launcher.bat`** - that's it!

The launcher will:
- Install dependencies automatically (first run only)
- Start the Node.js server
- Open your browser in kiosk mode
- Handle cleanup when you exit

If the browser doesn't open (may happen after initialization), open the launcher.bat file once more.

### First Time Setup

1. After the app loads, press **Ctrl+A** to enter Admin Mode
2. Click "Add New App" to start adding your applications
3. Create categories as needed using "Add New Category"
4. Customize the interface to your liking

## Usage

### Navigation Controls

- **Arrow Keys**: Navigate between apps
- **Enter/Space**: Launch selected app (or edit in admin mode)
- **Type**: Start searching immediately
- **/ or F**: Focus search box
- **Escape**: Exit navigation mode or close modals
- **Ctrl+A**: Toggle admin mode

### Controller Support

- **D-Pad/Left Stick**: Navigate
- **A Button**: Launch/Select
- **B Button**: Back/Cancel

### Admin Mode

Press **Ctrl+A** to toggle admin mode, which allows you to:

- **Add new apps** with custom icons, categories, and launch methods
- **Edit existing apps** by clicking on them in admin mode
- **Delete apps** using the × button that appears on cards
- **Manage categories** - add new ones or delete existing ones
- **Export your configuration** for backup
- **Import configurations** from other setups

### Adding Applications

When adding apps, you can specify:

- **Website**: Any URL or URI (Netflix, YouTube, etc.)
- **Steam Game**: Use `steam://rungameid/APPID` format
- **Epic Games**: Use `com.epicgames.launcher://` format
- **Executable**: Full local path to .exe files

Executables work slightly differently than other shortcuts as by default they can't be opened via the browser for security reasons. To get around this once you add an executable app, the server will automatically create a corresponding .bat file in the **launchers** folder to act as a shortcut. Then when opening the app via Easy HTUI, the .bat file will act as shortcut to open up the application.

### App Types and Examples

```json
{
  "name": "Netflix",
  "type": "website",
  "url": "https://www.netflix.com",
  "icon": "path/to/icon.png"
}

{
  "name": "Steam Game",
  "type": "steam", 
  "path": "steam://rungameid/1091500",
  "icon": "path/to/icon.png"
}

{
  "name": "Epic Game",
  "type": "epic",
  "path": "com.epicgames.launcher://apps/Fortnite",
  "icon": "path/to/icon.png"
}
```

## Configuration

The system stores all configuration in `config.json`. You can:

- **Backup**: Use the Export button in admin mode
- **Restore**: Use the Import button to load a saved configuration
- **Manual editing**: Edit `config.json` directly (server restart required)

## File Structure

```
easy-htui/
├── server.js              # Node.js server with API
├── package.json           # Dependencies
├── launcher.bat           # Single-click launcher
├── index.html             # Main interface
├── script.js              # Frontend logic with CRUD
├── style.css              # Styling and themes
├── config.json            # App configuration
└── images/               # Icon assets
```

---

Enjoy your new entertainment hub! 🎮🎬📺