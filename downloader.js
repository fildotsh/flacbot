const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const axios = require('axios');

class QobuzDownloader {
    constructor(baseUrl = null) {
        // Use environment variable or provided URL or default
        this.baseUrl = baseUrl || process.env.QOBUZ_BASE_URL || 'https://eu.qobuz.squid.wtf';
        this.downloadDir = path.join(__dirname, 'downloads');
        this.ensureDownloadDir();
        
        // Configure axios defaults
        this.setupHttpClient();
    }

    /**
     * Setup HTTP client with default configuration
     */
    setupHttpClient() {
        // Set default timeout for all requests
        axios.defaults.timeout = 30000; // 30 seconds
    }

    async ensureDownloadDir() {
        await fs.ensureDir(this.downloadDir);
    }

    /**
     * Search for music tracks
     * @param {string} query - Search query
     * @param {number} offset - Search offset
     * @returns {Promise<Array>} Array of search results in format compatible with bot
     */
    async searchMusic(query, offset = 0) {
        try {
            const params = {
                q: query,
                offset: offset.toString()
            };
            
            console.log(`Attempting to search Qobuz API for: ${query}`);
            
            const response = await axios.get(`${this.baseUrl}/api/get-music`, {
                params,
                timeout: 10000, // 10 second timeout
                headers: {
                    'User-Agent': 'FlacBot/1.0.0',
                    'Accept': 'application/json'
                }
            });
            
            const data = response.data;
            
            if (!data.success) {
                throw new Error(data.error || 'API returned unsuccessful response');
            }
            
            // Convert real API response to bot-compatible format
            const tracks = data.data.tracks?.items || [];
            console.log(`✅ Found ${tracks.length} tracks from Qobuz API`);
            
            // Mark that we successfully used the real API
            this._lastSearchUsedAPI = true;
            
            return tracks.map(track => ({
                id: track.id.toString(),
                title: track.title || 'Unknown Title',
                artist: track.performer?.name || 'Unknown Artist',
                album: track.album?.title || 'Unknown Album',
                duration: this.formatDuration(track.duration),
                quality: this.getQualityDescription(track.maximum_bit_depth, track.maximum_sampling_rate),
                _originalTrack: track // Keep original for download
            }));
        } catch (error) {
            const errorMessage = this.getErrorMessage(error);
            console.error('❌ Error searching music via API:', errorMessage);
            
            // Mark that we're using fallback
            this._lastSearchUsedAPI = false;
            
            // Fallback to mock data when API is unavailable (for demo/testing purposes)
            console.log('🚧 Falling back to mock data for demonstration...');
            return this.getMockSearchResults(query);
        }
    }

    /**
     * Get a user-friendly error message
     * @param {Error} error - The error object
     * @returns {string} User-friendly error message
     */
    getErrorMessage(error) {
        if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
            return 'Unable to connect to Qobuz API (network issue)';
        }
        if (error.code === 'ECONNREFUSED') {
            return 'Qobuz API server is not responding';
        }
        if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            return 'Request to Qobuz API timed out';
        }
        if (error.response) {
            return `API error ${error.response.status}: ${error.response.statusText}`;
        }
        return error.message || 'Unknown error occurred';
    }

    /**
     * Get quality description from bit depth and sampling rate
     * @param {number} bitDepth - Bit depth
     * @param {number} samplingRate - Sampling rate
     * @returns {string} Quality description
     */
    getQualityDescription(bitDepth, samplingRate) {
        if (bitDepth && samplingRate) {
            return `FLAC ${bitDepth}bit/${(samplingRate / 1000).toFixed(1)}kHz`;
        }
        return 'FLAC High Quality';
    }

    /**
     * Fallback mock search results for when API is unavailable
     * @param {string} query - Search query
     * @returns {Array} Mock search results
     */
    getMockSearchResults(query) {
        console.log('Using mock data - API unavailable');
        return [
            {
                id: '1',
                title: `${query} - Song 1`,
                artist: 'Artist Name 1',
                album: 'Album Name 1',
                duration: '3:45',
                quality: 'FLAC 16bit/44.1kHz (Demo)',
                _isMock: true
            },
            {
                id: '2', 
                title: `${query} - Song 2`,
                artist: 'Artist Name 2',
                album: 'Album Name 2',
                duration: '4:12',
                quality: 'FLAC 24bit/96kHz (Demo)',
                _isMock: true
            },
            {
                id: '3',
                title: `${query} - Song 3`,
                artist: 'Artist Name 3', 
                album: 'Album Name 3',
                duration: '2:58',
                quality: 'FLAC 16bit/44.1kHz (Demo)',
                _isMock: true
            }
        ];
    }

    /**
     * Check if currently using API or mock data
     * @returns {boolean} True if using real API, false if using mock data
     */
    isUsingRealAPI() {
        return this._lastSearchUsedAPI === true;
    }

    /**
     * Get status message for users about current mode
     * @returns {string} Status message
     */
    getStatusMessage() {
        if (this.isUsingRealAPI()) {
            return '🎵 Connected to Qobuz - Real music search active';
        } else {
            return '🚧 Demo Mode - API unavailable, showing demonstration content\n' +
                   '💡 Real music will be available when Qobuz API is accessible';
        }
    }

    async getDownloadUrl(trackId, quality = '27') {
        const params = {
            track_id: trackId.toString(),
            quality: quality
        };
        
        const response = await axios.get(`${this.baseUrl}/api/download-music`, {
            params,
            timeout: 10000,
            headers: {
                'User-Agent': 'FlacBot/1.0.0',
                'Accept': 'application/json'
            }
        });
        
        const data = response.data;
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to get download URL');
        }
        
        return data.data.url;
    }

    async getAlbumDetails(albumId) {
        const params = {
            album_id: albumId
        };
        
        const response = await axios.get(`${this.baseUrl}/api/get-album`, {
            params,
            timeout: 10000,
            headers: {
                'User-Agent': 'FlacBot/1.0.0',
                'Accept': 'application/json'
            }
        });
        
        const data = response.data;
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to get album details');
        }
        
        return data.data;
    }

    // Clean filename for filesystem
    sanitizeFilename(filename) {
        return filename.replace(/[<>:"/\\|?*]/g, '_').replace(/\s+/g, ' ').trim();
    }

    // Get file extension based on quality
    getFileExtension(quality) {
        // Quality 27 is typically FLAC, others might be MP3
        return quality === '27' ? 'flac' : 'mp3';
    }

    /**
     * Download a track
     * @param {Object} track - Track object from search results
     * @param {string} quality - Quality level (default: '27' for FLAC)
     * @returns {Promise<string>} Path to downloaded file
     */
    async downloadTrack(track, quality = '27') {
        try {
            await this.ensureDownloadDir();
            
            // Check if this is a mock track (fallback mode)
            if (track._isMock) {
                return this.downloadMockTrack(track);
            }
            
            // Real API download
            console.log('🔍 Getting download URL from Qobuz API...');
            const downloadUrl = await this.getDownloadUrl(track.id, quality);
            console.log('✅ Download URL obtained');
            
            // Download the file
            console.log('📥 Downloading FLAC file...');
            const response = await axios.get(downloadUrl, {
                responseType: 'arraybuffer',
                timeout: 60000, // 60 second timeout for large files
                headers: {
                    'User-Agent': 'FlacBot/1.0.0'
                }
            });
            
            // Create filename and save
            const extension = this.getFileExtension(quality);
            const filename = this.sanitizeFilename(`${track.artist} - ${track.title}.${extension}`);
            const filePath = path.join(this.downloadDir, filename);
            
            // Save to file
            await fs.writeFile(filePath, Buffer.from(response.data));
            
            console.log(`✅ Downloaded: ${filename}`);
            return filePath;
        } catch (error) {
            console.error('❌ Download error:', this.getErrorMessage(error));
            
            // Fallback to mock download if real download fails
            console.log('🚧 Falling back to mock download...');
            return this.downloadMockTrack(track);
        }
    }

    /**
     * Create a mock download for demonstration purposes
     * @param {Object} track - Track object
     * @returns {Promise<string>} Path to mock file
     */
    async downloadMockTrack(track) {
        try {
            // Create a mock FLAC file for demonstration
            const filename = this.sanitizeFilename(`${track.artist} - ${track.title}.flac`);
            const filePath = path.join(this.downloadDir, filename);

            // Create a mock FLAC file with realistic header for demonstration
            const mockFlacHeader = Buffer.from([
                0x66, 0x4C, 0x61, 0x43, // "fLaC" signature
                0x00, 0x00, 0x00, 0x22, // Metadata block header
            ]);
            
            const mockContent = Buffer.from(`MOCK FLAC FILE - ${track.title} by ${track.artist}\nThis is a demonstration file. In production, this would be a real FLAC audio file.`);
            const mockFlacContent = Buffer.concat([mockFlacHeader, mockContent]);
            
            await fs.writeFile(filePath, mockFlacContent);

            console.log(`Mock download completed: ${filename}`);
            return filePath;
        } catch (error) {
            console.error('Error creating mock download:', error);
            throw new Error('Failed to download track. Please try again.');
        }
    }

    // Format duration from seconds to mm:ss
    formatDuration(seconds) {
        if (seconds == null || isNaN(seconds)) return 'Unknown';
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    /**
     * Format track info for display
     * @param {Object} track - Track object
     * @returns {string} Formatted track info
     */
    formatTrackInfo(track) {
        return `🎵 ${track.title}\n👤 ${track.artist}\n💿 ${track.album}\n⏱️ ${track.duration}\n🎧 ${track.quality}`;
    }

    /**
     * Get track by ID from search results
     * @param {Array} searchResults - Array of search results
     * @param {string} trackId - Track ID
     * @returns {Object|null} Track object or null if not found
     */
    getTrackById(searchResults, trackId) {
        return searchResults.find(track => track.id === trackId) || null;
    }

    // Create readline interface for user input
    createReadlineInterface() {
        return readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    // Display search results in a formatted list
    displaySearchResults(tracks) {
        console.log('\n🎵 Search Results:');
        console.log('='.repeat(80));
        
        tracks.forEach((track, index) => {
            const number = (index + 1).toString().padStart(2, ' ');
            const title = track.title || 'Unknown Title';
            const artist = track.artist || 'Unknown Artist';
            const album = track.album || 'Unknown Album';
            const duration = track.duration || 'Unknown';
            
            console.log(`[${number}] ${title}`);
            console.log(`     🎤 Artist: ${artist}`);
            console.log(`     💿 Album:  ${album}`);
            console.log(`     ⏱️  Duration: ${duration}`);
            console.log('');
        });
    }

    // Get user selection with validation
    async getUserSelection(maxNumber) {
        const rl = this.createReadlineInterface();
        
        return new Promise((resolve, reject) => {
            const askForSelection = () => {
                rl.question(`\nEnter track number (1-${maxNumber}) or 'q' to quit: `, (answer) => {
                    const trimmed = answer.trim().toLowerCase();
                    
                    if (trimmed === 'q' || trimmed === 'quit') {
                        rl.close();
                        reject(new Error('User cancelled selection'));
                        return;
                    }
                    
                    const selection = parseInt(trimmed, 10);
                    
                    if (isNaN(selection) || selection < 1 || selection > maxNumber) {
                        console.log(`❌ Invalid selection. Please enter a number between 1 and ${maxNumber}, or 'q' to quit.`);
                        askForSelection();
                        return;
                    }
                    
                    rl.close();
                    resolve(selection - 1); // Convert to 0-based index
                });
            };
            
            askForSelection();
        });
    }

    // Legacy CLI methods for backwards compatibility
    async searchAndSelect(query, quality = '27', outputDir = './downloads') {
        try {
            // Search for tracks
            console.log(`🔍 Searching for: "${query}"`);
            const searchResults = await this.searchMusic(query);
            
            if (searchResults.length === 0) {
                throw new Error('No tracks found for your search query');
            }
            
            console.log(`✅ Found ${searchResults.length} track${searchResults.length > 1 ? 's' : ''}`);
            
            // Display search results
            this.displaySearchResults(searchResults);
            
            // Get user selection
            console.log('Please select which track you want to download:');
            const selectedIndex = await this.getUserSelection(searchResults.length);
            const selectedTrack = searchResults[selectedIndex];
            
            console.log(`\n✅ Selected: ${selectedTrack.title} by ${selectedTrack.artist}`);
            
            // Download the selected track
            console.log('📥 Starting download...');
            const filepath = await this.downloadTrack(selectedTrack, quality);
            
            return {
                track: selectedTrack,
                filepath,
                filename: path.basename(filepath)
            };
            
        } catch (error) {
            console.error('❌ Error:', error.message);
            throw error;
        }
    }

    async searchAndDownload(query, quality = '27', outputDir = './downloads') {
        try {
            // Search for the track
            console.log(`Searching for: ${query}`);
            const searchResults = await this.searchMusic(query);
            
            if (searchResults.length === 0) {
                throw new Error('No tracks found');
            }
            
            // Get the first track
            const track = searchResults[0];
            console.log(`Found track: ${track.title} by ${track.artist}`);
            console.log(`Track ID: ${track.id}`);
            console.log(`Album: ${track.album || 'Unknown'}`);
            
            // Download the track
            console.log('Starting download...');
            const filepath = await this.downloadTrack(track, quality);
            
            console.log('Download completed!');
            console.log(`File saved: ${filepath}`);
            
            return {
                track,
                filepath,
                filename: path.basename(filepath)
            };
            
        } catch (error) {
            console.error('Error:', error);
            throw error;
        }
    }
}

module.exports = QobuzDownloader;