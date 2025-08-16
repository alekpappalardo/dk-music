let audioFiles = [];
let currentlyPlaying = null;

class WhatsAppVoiceMessage {
    constructor(audioFile, index) {
        this.audioFile = audioFile;
        this.index = index;
        this.audio = new Audio(audioFile);
        this.audio.preload = 'metadata';
        this.isPlaying = false;
        this.currentEffect = 'normal';
        this.element = null;
        
        // Web Audio for bass effect
        this.audioContext = null;
        this.source = null;
        this.bassChain = null;
        this.isWebAudioSetup = false;
        
        // Scrubbing state
        this.waveformHammer = null;
        this.isScrubbing = false;
        
        this.setupAudioEvents();
        this.createMessage();
        this.setupControls();
    }
    
    setupAudioEvents() {
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });
        
        this.audio.addEventListener('timeupdate', () => {
            if (!this.isScrubbing) {
                this.updateProgress();
            }
        });
        
        this.audio.addEventListener('ended', () => {
            this.stop();
        });
        
        this.audio.addEventListener('error', (e) => {
            console.error('Audio error:', e);
        });
    }
    
    createMessage() {
        const container = document.getElementById('messages-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = 'voice-message';
        messageDiv.id = `voice-message-${this.index}`;
        
        // Extract title from filename
        let fileName = this.audioFile.split('/').pop().replace(/\.[^/.]+$/, '');
        fileName = fileName.split('_')[0];
        const title = fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        messageDiv.innerHTML = `
            <div class="message-meta">
                <div class="message-title">${title}</div>
            </div>
            
            <div class="voice-controls">
                <div class="play-button">
                    <div class="play-icon"></div>
                    <div class="pause-icon"></div>
                </div>
                
                <div class="waveform-container">
                    <div class="waveform-progress">
                        ${this.createWaveformBars()}
                    </div>
                    ${this.createWaveformBars()}
                </div>
                
                <div class="voice-duration">0:00</div>
            </div>
            
            <div class="effect-buttons">
                <button class="effect-btn" data-effect="bass">bass</button>
                <button class="effect-btn" data-effect="fast">fast</button>
                <button class="effect-btn" data-effect="slow">slow</button>
            </div>
        `;
        
        this.element = messageDiv;
        container.appendChild(messageDiv);
    }
    
    createWaveformBars() {
        let bars = '';
        for (let i = 0; i < 30; i++) {
            bars += '<div class="waveform-bar"></div>';
        }
        return bars;
    }
    
    setupControls() {
        const playButton = this.element.querySelector('.play-button');
        const effectButtons = this.element.querySelectorAll('.effect-btn');
        const waveformContainer = this.element.querySelector('.waveform-container');
        
        // Play/pause button
        playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay();
        });
        
        // Effect buttons
        effectButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleEffect(btn.dataset.effect);
            });
        });
        
        // WhatsApp-style waveform scrubbing
        this.setupWaveformScrubbing(waveformContainer);
    }
    
    setupWaveformScrubbing(waveform) {
        // Use simpler touch events for better WhatsApp-like experience
        let isDragging = false;
        
        // Mouse events
        waveform.addEventListener('mousedown', (e) => {
            isDragging = true;
            this.isScrubbing = true;
            this.updateScrubPosition(e);
            if (navigator.vibrate) navigator.vibrate(3);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (isDragging && this.isScrubbing) {
                this.updateScrubPosition(e);
            }
        });
        
        document.addEventListener('mouseup', () => {
            isDragging = false;
            this.isScrubbing = false;
        });
        
        // Touch events  
        waveform.addEventListener('touchstart', (e) => {
            e.preventDefault();
            isDragging = true;
            this.isScrubbing = true;
            this.updateScrubPosition(e.touches[0]);
            if (navigator.vibrate) navigator.vibrate(3);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (isDragging && this.isScrubbing) {
                e.preventDefault();
                this.updateScrubPosition(e.touches[0]);
            }
        });
        
        document.addEventListener('touchend', () => {
            isDragging = false;
            this.isScrubbing = false;
        });
    }
    
    updateScrubPosition(e) {
        const waveform = this.element.querySelector('.waveform-container');
        const rect = waveform.getBoundingClientRect();
        
        // Get x position from mouse or touch event
        const clientX = e.clientX || e.pageX;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const progress = x / rect.width;
        
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            // Seek to position
            this.audio.currentTime = progress * this.audio.duration;
            
            // Update visual progress immediately
            this.updateProgressVisual(progress);
            
            // Update timer to show current position (counting up from 0)
            const currentTime = this.audio.currentTime;
            this.element.querySelector('.voice-duration').textContent = this.formatTime(currentTime);
        }
    }
    
    updateProgressVisual(progress) {
        const progressDiv = this.element.querySelector('.waveform-progress');
        progressDiv.style.width = `${progress * 100}%`;
    }
    
    async togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            await this.play();
        }
    }
    
    async play() {
        // Stop any other playing audio
        if (currentlyPlaying && currentlyPlaying !== this) {
            currentlyPlaying.stop();
        }
        
        try {
            await this.audio.play();
            this.isPlaying = true;
            this.element.classList.add('playing');
            currentlyPlaying = this;
            
            if (navigator.vibrate) navigator.vibrate(10);
        } catch (error) {
            console.error('Play failed:', error);
        }
    }
    
    pause() {
        this.audio.pause();
        this.isPlaying = false;
        this.element.classList.remove('playing');
        if (currentlyPlaying === this) currentlyPlaying = null;
    }
    
    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.isPlaying = false;
        this.element.classList.remove('playing');
        if (currentlyPlaying === this) currentlyPlaying = null;
        this.updateProgress();
    }
    
    async toggleEffect(effect) {
        const btn = this.element.querySelector(`[data-effect="${effect}"]`);
        const allBtns = this.element.querySelectorAll('.effect-btn');
        
        if (this.currentEffect === effect) {
            // Turn off effect
            this.currentEffect = 'normal';
            btn.classList.remove('active');
            await this.applyEffect('normal');
        } else {
            // Turn on new effect
            allBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentEffect = effect;
            await this.applyEffect(effect);
        }
        
        if (navigator.vibrate) navigator.vibrate(5);
    }
    
    async applyEffect(effect) {
        switch (effect) {
            case 'fast':
                this.audio.playbackRate = 1.5;
                this.disconnectWebAudio();
                break;
            case 'slow':
                this.audio.playbackRate = 0.75;
                this.disconnectWebAudio();
                break;
            case 'bass':
                this.audio.playbackRate = 1;
                await this.setupBassEffect();
                break;
            default:
                this.audio.playbackRate = 1;
                this.disconnectWebAudio();
        }
    }
    
    async setupBassEffect() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                
                // Resume audio context if needed (required for some browsers)
                if (this.audioContext.state === 'suspended') {
                    await this.audioContext.resume();
                }
            }
            
            if (!this.isWebAudioSetup) {
                // Create source from HTML5 audio element
                this.source = this.audioContext.createMediaElementSource(this.audio);
                
                // Create powerful bass boost chain
                const lowShelf = this.audioContext.createBiquadFilter();
                lowShelf.type = 'lowshelf';
                lowShelf.frequency.value = 180;
                lowShelf.gain.value = 20; // Heavy bass boost
                
                const peaking = this.audioContext.createBiquadFilter();
                peaking.type = 'peaking';
                peaking.frequency.value = 50;
                peaking.Q.value = 2;
                peaking.gain.value = 18; // Deep sub-bass
                
                const gain = this.audioContext.createGain();
                gain.gain.value = 1.5; // Volume boost
                
                // Connect the chain: source -> lowShelf -> peaking -> gain -> destination
                this.source.connect(lowShelf);
                lowShelf.connect(peaking);
                peaking.connect(gain);
                gain.connect(this.audioContext.destination);
                
                this.bassChain = { lowShelf, peaking, gain };
                this.isWebAudioSetup = true;
                
                console.log('Bass effect setup complete - should hear heavy bass now');
            }
        } catch (error) {
            console.error('Bass effect setup failed:', error);
            // Continue without bass effect
        }
    }
    
    disconnectWebAudio() {
        // Web Audio chain stays connected for seamless switching back to bass
        // Only visual cleanup needed
    }
    
    updateDuration() {
        const duration = this.audio.duration;
        if (duration && !isNaN(duration)) {
            // Start with 0:00 like WhatsApp
            this.element.querySelector('.voice-duration').textContent = '0:00';
        }
    }
    
    updateProgress() {
        if (!this.audio.duration) return;
        
        const progress = this.audio.currentTime / this.audio.duration;
        const currentTime = this.audio.currentTime; // Count up from 0 like WhatsApp
        
        // Update visual progress
        this.updateProgressVisual(progress);
        
        // Update timer (counting up from 0, not down from total)
        this.element.querySelector('.voice-duration').textContent = this.formatTime(currentTime);
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Load and create voice messages
async function loadVoiceMessages() {
    audioFiles = [
        'https://res.cloudinary.com/dprjkfgqf/video/upload/f_mp3,br_128k/v1755302946/megl-accussi_km8uea.wav'
    ];
    
    if (audioFiles.length > 0) {
        audioFiles.forEach((file, index) => {
            // Stagger creation slightly for smooth loading
            setTimeout(() => {
                new WhatsAppVoiceMessage(file, index);
            }, index * 50);
        });
    } else {
        console.log('No audio files found');
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    loadVoiceMessages();
});

// Auto-scroll to bottom like WhatsApp
function scrollToBottom() {
    const container = document.querySelector('.chat-container');
    container.scrollTop = container.scrollHeight;
}

// Scroll to bottom when new messages are added
const observer = new MutationObserver(() => {
    scrollToBottom();
});

observer.observe(document.getElementById('messages-container'), {
    childList: true
});