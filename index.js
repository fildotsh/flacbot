const TelegramBot = require('node-telegram-bot-api');
const QobuzDownloader = require('./downloader');
const fs = require('fs-extra');

class FlacBot {
    constructor(token, qobuzBaseUrl = null) {
        this.bot = new TelegramBot(token, { polling: true });
        this.downloader = new QobuzDownloader(qobuzBaseUrl);
        this.userSessions = new Map(); // Store user search sessions
        this.setupHandlers();
    }

    setupHandlers() {
        // Handle /start command
        this.bot.onText(/\/start/, (msg) => {
            this.handleStart(msg);
        });

        // Handle /help command
        this.bot.onText(/\/help/, (msg) => {
            this.handleHelp(msg);
        });

        // Handle search command
        this.bot.onText(/\/search (.+)/, (msg, match) => {
            this.handleSearch(msg, match[1]);
        });

        // Handle callback queries (inline keyboard responses)
        this.bot.on('callback_query', (callbackQuery) => {
            this.handleCallbackQuery(callbackQuery);
        });

        // Handle text messages (search queries)
        this.bot.on('message', (msg) => {
            if (!msg.text.startsWith('/')) {
                this.handleTextMessage(msg);
            }
        });

        // Handle errors
        this.bot.on('polling_error', (error) => {
            console.error('Polling error:', error);
        });
    }

    handleStart(msg) {
        const chatId = msg.chat.id;
        const welcomeMessage = `
🎵 Welcome to FlacBot! 🎵

I can help you search and download high-quality FLAC music files.

📖 Commands:
• Send me any text to search for music
• /search <query> - Search for music
• /help - Show this help message

🎧 Just type the name of a song, artist, or album to get started!
        `.trim();

        this.bot.sendMessage(chatId, welcomeMessage);
    }

    handleHelp(msg) {
        const chatId = msg.chat.id;
        const helpMessage = `
🎵 FlacBot Help 🎵

📖 Available commands:
• /start - Show welcome message
• /search <query> - Search for music
• /help - Show this help message

🔍 How to use:
1. Send me a search query (song name, artist, or album)
2. I'll show you search results with inline buttons
3. Click on a track to download it
4. I'll send you the FLAC file

💡 Tips:
• Be specific with your search terms for better results
• You can search by artist name, song title, or album
• All files are delivered in high-quality FLAC format

🎧 Example: "Bohemian Rhapsody Queen"
        `.trim();

        this.bot.sendMessage(chatId, helpMessage);
    }

    async handleSearch(msg, query) {
        const chatId = msg.chat.id;
        await this.performSearch(chatId, query);
    }

    async handleTextMessage(msg) {
        const chatId = msg.chat.id;
        const query = msg.text;

        // Ignore empty messages or commands
        if (!query || query.trim().length === 0) {
            return;
        }

        await this.performSearch(chatId, query);
    }

    async performSearch(chatId, query) {
        try {
            // Send "searching" message
            const searchingMsg = await this.bot.sendMessage(chatId, '🔍 Searching for music...', {
                reply_markup: {
                    inline_keyboard: []
                }
            });

            // Perform search
            const searchResults = await this.downloader.searchMusic(query);

            if (searchResults.length === 0) {
                await this.bot.editMessageText('❌ No results found. Try a different search term.', {
                    chat_id: chatId,
                    message_id: searchingMsg.message_id
                });
                return;
            }

            // Store search results in user session
            this.userSessions.set(chatId, {
                query: query,
                results: searchResults,
                timestamp: Date.now()
            });

            // Create inline keyboard with search results
            const keyboard = searchResults.map((track, index) => {
                return [{
                    text: `🎵 ${track.title} - ${track.artist}`,
                    callback_data: `download_${track.id}`
                }];
            });

            // Add a "New Search" button
            keyboard.push([{
                text: '🔍 New Search',
                callback_data: 'new_search'
            }]);

            // Create result message with status
            let resultMessage = `🎵 Found ${searchResults.length} results for "${query}":\n\n`;
            
            // Add status message about API availability
            const statusMessage = this.downloader.getStatusMessage();
            resultMessage += `${statusMessage}\n\n`;
            
            resultMessage += 'Click on a track to download:';

            await this.bot.editMessageText(resultMessage, {
                chat_id: chatId,
                message_id: searchingMsg.message_id,
                reply_markup: {
                    inline_keyboard: keyboard
                }
            });

        } catch (error) {
            console.error('Search error:', error);
            const errorMessage = error.message.includes('network') || error.message.includes('connect') ?
                '🌐 Connection issue with music service. Please try again later.' :
                '❌ An error occurred while searching. Please try again.';
            await this.bot.sendMessage(chatId, errorMessage);
        }
    }

    async handleCallbackQuery(callbackQuery) {
        const chatId = callbackQuery.message.chat.id;
        const messageId = callbackQuery.message.message_id;
        const data = callbackQuery.data;

        try {
            if (data === 'new_search') {
                await this.bot.editMessageText('🔍 Send me a new search query:', {
                    chat_id: chatId,
                    message_id: messageId,
                    reply_markup: { inline_keyboard: [] }
                });
                return;
            }

            if (data.startsWith('download_')) {
                const trackId = data.replace('download_', '');
                await this.handleDownload(chatId, messageId, trackId);
            }

            // Answer the callback query to remove loading state
            await this.bot.answerCallbackQuery(callbackQuery.id);

        } catch (error) {
            console.error('Callback query error:', error);
            await this.bot.answerCallbackQuery(callbackQuery.id, {
                text: 'An error occurred. Please try again.',
                show_alert: true
            });
        }
    }

    async handleDownload(chatId, messageId, trackId) {
        try {
            // Get user session
            const session = this.userSessions.get(chatId);
            if (!session) {
                await this.bot.editMessageText('❌ Session expired. Please perform a new search.', {
                    chat_id: chatId,
                    message_id: messageId
                });
                return;
            }

            // Find the track
            const track = this.downloader.getTrackById(session.results, trackId);
            if (!track) {
                await this.bot.editMessageText('❌ Track not found. Please perform a new search.', {
                    chat_id: chatId,
                    message_id: messageId
                });
                return;
            }

            // Update message to show downloading status
            const downloadType = track._isMock ? 'demo file' : 'FLAC track';
            await this.bot.editMessageText(`⬬ Downloading ${downloadType}: ${track.title} by ${track.artist}...`, {
                chat_id: chatId,
                message_id: messageId,
                reply_markup: { inline_keyboard: [] }
            });

            // Download the track
            const filePath = await this.downloader.downloadTrack(track);

            // Send the file
            const caption = this.downloader.formatTrackInfo(track);
            await this.bot.sendDocument(chatId, filePath, {
                caption: caption
            });

            // Update the download message
            const successMessage = track._isMock ? 
                `✅ Demo file sent: ${track.title} by ${track.artist}\n🚧 This is demonstration content. Real music will be available when API is accessible.` :
                `✅ Successfully sent: ${track.title} by ${track.artist}`;
                
            await this.bot.editMessageText(successMessage, {
                chat_id: chatId,
                message_id: messageId
            });

            // Clean up downloaded file after sending
            await fs.remove(filePath);

        } catch (error) {
            console.error('Download error:', error);
            const errorMessage = error.message.includes('network') || error.message.includes('connect') ?
                '🌐 Connection issue while downloading. Please try again later.' :
                '❌ Failed to download track. Please try again.';
            await this.bot.editMessageText(errorMessage, {
                chat_id: chatId,
                message_id: messageId
            });
        }
    }

    // Clean up old user sessions (call periodically)
    cleanupSessions() {
        const now = Date.now();
        const maxAge = 30 * 60 * 1000; // 30 minutes

        for (const [chatId, session] of this.userSessions.entries()) {
            if (now - session.timestamp > maxAge) {
                this.userSessions.delete(chatId);
            }
        }
    }

    start() {
        console.log('🎵 FlacBot started successfully!');
        console.log('Waiting for messages...');

        // Clean up sessions every 10 minutes
        setInterval(() => {
            this.cleanupSessions();
        }, 10 * 60 * 1000);
    }
}

// Start the bot if this file is run directly
if (require.main === module) {
    require('dotenv').config();
    const BOT_TOKEN = process.env.BOT_TOKEN;
    const QOBUZ_BASE_URL = process.env.QOBUZ_BASE_URL;
    
    if (!BOT_TOKEN) {
        console.error('❌ BOT_TOKEN environment variable is required!');
        console.log('Please set your Telegram Bot Token:');
        console.log('export BOT_TOKEN="your_bot_token_here"');
        console.log('\nOptional: Set custom Qobuz API URL:');
        console.log('export QOBUZ_BASE_URL="https://your.custom.api.url"');
        process.exit(1);
    }

    console.log('🎵 Starting FlacBot...');
    console.log(`📡 Qobuz API endpoint: ${QOBUZ_BASE_URL || 'https://eu.qobuz.squid.wtf'} (default)`);
    
    const bot = new FlacBot(BOT_TOKEN, QOBUZ_BASE_URL);
    bot.start();
}

module.exports = FlacBot;