# FlacBot 🎵

A Telegram bot for downloading high-quality FLAC music files. This bot transforms CLI music downloading functionality into an intuitive Telegram interface with interactive menus and seamless file delivery.

## Features

- 🔍 **Music Search**: Search for tracks by song name, artist, or album
- 🎵 **Interactive Selection**: Browse search results with inline keyboards
- ⬬ **High-Quality Downloads**: Download music in FLAC format
- 📱 **Telegram Integration**: Seamless file delivery directly to your chat
- ⚡ **Real-time Feedback**: Live status updates during search and download

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- A Telegram Bot Token from [@BotFather](https://t.me/botfather)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/fildotsh/flacbot.git
   cd flacbot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment:
   ```bash
   cp .env.example .env
   # Edit .env and add your BOT_TOKEN
   ```

4. Start the bot:
   ```bash
   npm start
   ```

### Demo Mode

To see how the bot works without setting up a Telegram bot token:

```bash
npm run demo
```

This will simulate the complete bot workflow including search, selection, and download processes.

## Usage

### Bot Commands

- `/start` - Welcome message and introduction
- `/help` - Show available commands and usage instructions
- `/search <query>` - Search for music (or just send any text message)

### How to Use

1. **Start a conversation** with your bot on Telegram
2. **Send a search query** - just type the name of a song, artist, or album
3. **Browse results** - use the inline keyboard to see available tracks
4. **Download music** - click on any track to download it as a FLAC file
5. **Receive your file** - the bot will send the high-quality audio file directly to your chat

### Example Searches

- `Bohemian Rhapsody Queen`
- `The Beatles Abbey Road`
- `Daft Punk Random Access Memories`
- `Pink Floyd Dark Side of the Moon`

## Architecture

The bot is built with a modular architecture that maintains the original CLI program structure:

### Core Components

- **`index.js`** - Main Telegram bot handler with interactive UI
- **`downloader.js`** - QobuzDownloader class for music search and download
- **User Sessions** - Manages search state and user interactions

### Key Features

- **Inline Keyboards**: Replace terminal prompts with Telegram inline buttons
- **Session Management**: Track user searches and selections
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **File Management**: Automatic cleanup of downloaded files after sending

## Development

### Project Structure

```
flacbot/
├── index.js           # Main Telegram bot implementation
├── downloader.js      # Music search and download logic
├── package.json       # Dependencies and scripts
├── .env.example       # Environment variables template
├── .gitignore         # Git ignore rules
└── README.md          # Documentation
```

### Testing

Currently using mock data for demonstration. To test:

1. Set your `BOT_TOKEN` in `.env`
2. Start the bot with `npm start`
3. Message your bot on Telegram
4. Try searching for any music - you'll get mock results that demonstrate the full workflow

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see LICENSE file for details
