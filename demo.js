#!/usr/bin/env node

/**
 * Demo script to showcase FlacBot functionality without requiring a Telegram bot token
 * This simulates the bot interactions for testing and demonstration purposes
 */

const QobuzDownloader = require('./downloader.js');

class FlacBotDemo {
    constructor() {
        this.downloader = new QobuzDownloader();
    }

    async simulateSearch(query) {
        console.log(`\n🔍 User searches for: "${query}"`);
        console.log('⏳ Searching...\n');

        try {
            const results = await this.downloader.searchMusic(query);
            
            console.log(`🎵 Found ${results.length} results:\n`);
            
            results.forEach((track, index) => {
                console.log(`${index + 1}. ${this.downloader.formatTrackInfo(track)}\n`);
            });

            return results;
        } catch (error) {
            console.error('❌ Search failed:', error.message);
            return [];
        }
    }

    async simulateDownload(track) {
        console.log(`⬬ User selects: "${track.title}" by ${track.artist}`);
        console.log('📥 Downloading...\n');

        try {
            const filePath = await this.downloader.downloadTrack(track);
            console.log(`✅ Download completed!`);
            console.log(`📁 File saved to: ${filePath}`);
            console.log(`📤 Bot would now send this file to the user via Telegram\n`);
            
            return filePath;
        } catch (error) {
            console.error('❌ Download failed:', error.message);
            return null;
        }
    }

    async runDemo() {
        console.log('🎵 FlacBot Demo - Simulating Telegram Bot Interactions 🎵\n');
        console.log('This demo shows how the bot would work on Telegram:\n');

        // Simulate multiple search scenarios
        const queries = [
            'Bohemian Rhapsody Queen',
            'The Beatles Abbey Road',
            'Daft Punk'
        ];

        for (const query of queries) {
            console.log('=' .repeat(60));
            const results = await this.simulateSearch(query);
            
            if (results.length > 0) {
                // Simulate user selecting the first result
                const selectedTrack = results[0];
                await this.simulateDownload(selectedTrack);
            }
            
            console.log('=' .repeat(60));
        }

        console.log('\n✨ Demo completed!');
        console.log('\n📱 On Telegram, users would:');
        console.log('   1. Send a message to the bot with their search query');
        console.log('   2. See an inline keyboard with clickable track options');
        console.log('   3. Click on their preferred track to download it');
        console.log('   4. Receive the FLAC file directly in their chat');
        console.log('\n🚀 To run the actual bot, set BOT_TOKEN and use: npm start');
    }
}

// Run demo if this file is executed directly
if (require.main === module) {
    const demo = new FlacBotDemo();
    demo.runDemo().catch(console.error);
}

module.exports = FlacBotDemo;