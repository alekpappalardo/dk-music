let audioFiles = [];
let currentlyPlaying = null;

// Simple audio architecture - just use HTML5 Audio for everything
class VoiceNote {
    constructor(audioFile, index) {
        this.audioFile = audioFile;
        this.index = index;
        this.audio = new Audio(audioFile);
        this.audio.preload = 'metadata';
        this.isPlaying = false;
        this.currentEffect = 'normal';
        this.element = null;
        this.hammer = null;
        
        // Web Audio for bass effect
        this.audioContext = null;
        this.source = null;
        this.bassFilter = null;
        this.gainNode = null;
        this.usingWebAudio = false;
        
        this.audio.addEventListener('loadedmetadata', () => {
            this.updateDuration();
        });
        
        this.audio.addEventListener('timeupdate', () => {
            this.updateProgress();
        });
        
        this.audio.addEventListener('ended', () => {
            this.stop();
        });
        
        this.createElements();
        this.setupGestures();
    }
    
    createElements() {
        const container = document.getElementById('voice-notes-container');
        const voiceNote = document.createElement('div');
        voiceNote.className = 'voice-note';
        voiceNote.id = `voice-note-${this.index}`;
        
        const position = this.getRandomPosition();
        const rotation = Math.random() * 360;
        const randomColor = this.getRandomColor();
        
        voiceNote.style.left = `${position.x}px`;
        voiceNote.style.top = `${position.y}px`;
        voiceNote.style.transform = `rotate(${rotation}deg)`;
        voiceNote.style.background = randomColor;
        
        // Extract title from filename
        let fileName = this.audioFile.split('/').pop().replace(/\.[^/.]+$/, '');
        fileName = fileName.split('_')[0];
        const title = fileName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        
        voiceNote.innerHTML = `
            <div class="voice-note-title">${title}</div>
            <div class="audio-controls">
                <div class="play-button">
                    <div class="play-icon"></div>
                    <div class="pause-icon"></div>
                </div>
                <div class="waveform-container">
                    <div class="waveform-highlight"></div>
                    ${this.createWaveformBars()}
                </div>
                <span class="duration">0:00</span>
            </div>
            <div class="effect-buttons">
                <button class="effect-btn" data-effect="bass">bass</button>
                <button class="effect-btn" data-effect="fast">fast</button>
                <button class="effect-btn" data-effect="slow">slow</button>
            </div>
            <div class="progress-bar"></div>
        `;
        
        this.element = voiceNote;
        container.appendChild(voiceNote);
        
        // Setup simple click handlers
        this.setupAudioControls();
    }
    
    setupAudioControls() {
        const playButton = this.element.querySelector('.play-button');
        const effectButtons = this.element.querySelectorAll('.effect-btn');
        const waveform = this.element.querySelector('.waveform-container');
        
        playButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePlay();
        });
        
        effectButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleEffect(btn.dataset.effect);
            });
        });
        
        // WhatsApp-style scrubbing with Hammer.js to avoid conflicts
        this.setupWaveformScrubbing(waveform);
    }
    
    setupWaveformScrubbing(waveform) {
        // Create separate Hammer instance for waveform only
        this.waveformHammer = new Hammer(waveform);
        this.waveformHammer.get('pan').set({ 
            direction: Hammer.DIRECTION_HORIZONTAL,
            threshold: 8,   // Slightly higher threshold for more deliberate scrubbing
            pointers: 1
        });
        
        // Disable rotation and vertical pan on waveform
        this.waveformHammer.get('rotate').set({ enable: false });
        this.waveformHammer.get('pinch').set({ enable: false });
        
        let scrubStarted = false;
        
        this.waveformHammer.on('panstart', (e) => {
            e.srcEvent.stopPropagation(); // Prevent main element dragging
            scrubStarted = true;
            waveform.classList.add('scrubbing');
            this.updateScrubPosition(e);
            if (navigator.vibrate) navigator.vibrate(5);
        });
        
        this.waveformHammer.on('panmove', (e) => {
            if (scrubStarted) {
                e.srcEvent.stopPropagation();
                this.updateScrubPosition(e);
            }
        });
        
        this.waveformHammer.on('panend', (e) => {
            scrubStarted = false;
            waveform.classList.remove('scrubbing');
            
            // Fade out the highlight after scrubbing like WhatsApp
            const highlight = this.element.querySelector('.waveform-highlight');
            setTimeout(() => {
                if (!this.isPlaying) {
                    highlight.style.opacity = '0.3';
                }
            }, 300);
            
            e.srcEvent.stopPropagation();
        });
        
        // Also handle simple taps for seeking
        this.waveformHammer.on('tap', (e) => {
            e.srcEvent.stopPropagation();
            this.updateScrubPosition(e);
            if (navigator.vibrate) navigator.vibrate(5);
        });
    }
    
    setupGestures() {
        // Use Hammer.js for smooth touch interactions
        this.hammer = new Hammer(this.element);
        
        // Enable pan and rotate with higher thresholds to prevent twitchy behavior
        this.hammer.get('pan').set({ 
            direction: Hammer.DIRECTION_ALL,
            threshold: 15,  // Higher threshold to prevent accidental movement
            pointers: 1     // Only single finger for dragging
        });
        this.hammer.get('rotate').set({ 
            enable: true,
            threshold: 20   // Higher threshold for rotation
        });
        
        // Store initial position and rotation
        this.initialTransform = {
            x: parseFloat(this.element.style.left),
            y: parseFloat(this.element.style.top),
            rotation: 0
        };
        
        this.currentTransform = { ...this.initialTransform };
        
        // Pan (drag) gesture
        this.hammer.on('panstart', (e) => {
            this.element.style.transition = 'none';
            this.element.style.zIndex = '1000';
            if (navigator.vibrate) navigator.vibrate(10);
        });
        
        this.hammer.on('panmove', (e) => {
            const newX = this.initialTransform.x + e.deltaX;
            const newY = this.initialTransform.y + e.deltaY;
            
            // Keep within screen bounds
            const bounds = this.getScreenBounds();
            const clampedX = Math.max(0, Math.min(newX, bounds.maxX));
            const clampedY = Math.max(0, Math.min(newY, bounds.maxY));
            
            this.currentTransform.x = clampedX;
            this.currentTransform.y = clampedY;
            
            this.updateElementTransform();
        });
        
        this.hammer.on('panend', (e) => {
            this.element.style.transition = '';
            this.element.style.zIndex = '';
            this.initialTransform.x = this.currentTransform.x;
            this.initialTransform.y = this.currentTransform.y;
            this.element.style.left = `${this.currentTransform.x}px`;
            this.element.style.top = `${this.currentTransform.y}px`;
        });
        
        // Rotate gesture
        this.hammer.on('rotatestart', (e) => {
            if (navigator.vibrate) navigator.vibrate(8);
        });
        
        this.hammer.on('rotatemove', (e) => {
            this.currentTransform.rotation = this.initialTransform.rotation + e.rotation;
            this.updateElementTransform();
        });
        
        this.hammer.on('rotateend', (e) => {
            this.initialTransform.rotation = this.currentTransform.rotation;
        });
    }
    
    updateElementTransform() {
        const { x, y, rotation } = this.currentTransform;
        this.element.style.transform = `translate(${x - this.initialTransform.x}px, ${y - this.initialTransform.y}px) rotate(${rotation}deg)`;
    }
    
    getScreenBounds() {
        const rect = this.element.getBoundingClientRect();
        return {
            maxX: window.innerWidth - rect.width,
            maxY: window.innerHeight - rect.height
        };
    }
    
    // WhatsApp-style scrubbing with visual feedback
    updateScrubPosition(e) {
        const waveform = this.element.querySelector('.waveform-container');
        const highlight = this.element.querySelector('.waveform-highlight');
        const rect = waveform.getBoundingClientRect();
        
        // Get position from Hammer event
        const clientX = e.center.x;
        const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const progress = Math.max(0, Math.min(1, x / rect.width));
        
        // Update visual highlight smoothly like WhatsApp
        highlight.style.width = `${progress * 100}%`;
        highlight.style.opacity = '1';
        
        // Update audio position if duration is available
        if (this.audio.duration && !isNaN(this.audio.duration)) {
            const newTime = progress * this.audio.duration;
            this.audio.currentTime = newTime;
            
            // Update duration display immediately for responsive feel
            const remaining = this.audio.duration - newTime;
            this.element.querySelector('.duration').textContent = this.formatTime(remaining);
            
            // Update progress bar to match scrub position
            this.element.querySelector('.progress-bar').style.width = `${progress * 100}%`;
        }
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        // Stop any other playing audio
        if (currentlyPlaying && currentlyPlaying !== this) {
            currentlyPlaying.stop();
        }
        
        this.audio.play();
        this.isPlaying = true;
        this.element.classList.add('playing');
        currentlyPlaying = this;
        
        if (navigator.vibrate) navigator.vibrate(15);
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
            this.audio.playbackRate = 1;
            this.disableWebAudio();
        } else {
            // Turn on new effect
            allBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentEffect = effect;
            await this.applyEffect(effect);
        }
        
        if (navigator.vibrate) navigator.vibrate(8);
    }
    
    async applyEffect(effect) {
        switch (effect) {
            case 'fast':
                this.audio.playbackRate = 1.5;
                this.disableWebAudio();
                break;
            case 'slow':
                this.audio.playbackRate = 0.75;
                this.disableWebAudio();
                break;
            case 'bass':
                this.audio.playbackRate = 1;
                await this.enableBassEffect();
                break;
            default:
                this.audio.playbackRate = 1;
                this.disableWebAudio();
        }
    }
    
    async enableBassEffect() {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            // Connect HTML5 audio to Web Audio for processing
            if (!this.source) {
                this.source = this.audioContext.createMediaElementSource(this.audio);
                
                // Create bass boost filter chain
                this.bassFilter = this.audioContext.createBiquadFilter();
                this.bassFilter.type = 'lowshelf';
                this.bassFilter.frequency.value = 150;
                this.bassFilter.gain.value = 15; // Heavy bass boost
                
                // Additional low-end enhancement
                this.subBassFilter = this.audioContext.createBiquadFilter();
                this.subBassFilter.type = 'peaking';
                this.subBassFilter.frequency.value = 60;
                this.subBassFilter.Q.value = 1;
                this.subBassFilter.gain.value = 12;
                
                // Gain control
                this.gainNode = this.audioContext.createGain();
                this.gainNode.gain.value = 1.3;
                
                // Connect the chain
                this.source.connect(this.bassFilter);
                this.bassFilter.connect(this.subBassFilter);
                this.subBassFilter.connect(this.gainNode);
                this.gainNode.connect(this.audioContext.destination);
            }
            
            this.usingWebAudio = true;
        } catch (error) {
            console.error('Web Audio not supported:', error);
            // Fallback to visual effect
            this.element.style.filter = 'contrast(1.3) saturate(1.5) brightness(1.1)';
        }
    }
    
    disableWebAudio() {
        this.usingWebAudio = false;
        this.element.style.filter = '';
        
        // Web Audio chain remains connected for bass effect
        // Only disconnect when stopping completely
    }
    
    updateDuration() {
        const duration = this.audio.duration;
        if (duration && !isNaN(duration)) {
            this.element.querySelector('.duration').textContent = this.formatTime(duration);
        }
    }
    
    updateProgress() {
        if (!this.audio.duration) return;
        
        const progress = (this.audio.currentTime / this.audio.duration) * 100;
        const remaining = this.audio.duration - this.audio.currentTime;
        
        // Update both progress bar and highlight during playback
        this.element.querySelector('.progress-bar').style.width = `${progress}%`;
        this.element.querySelector('.duration').textContent = this.formatTime(remaining);
        
        // Keep highlight synchronized during playback like WhatsApp
        const highlight = this.element.querySelector('.waveform-highlight');
        if (this.isPlaying) {
            highlight.style.width = `${progress}%`;
            highlight.style.opacity = '1';
        }
    }
    
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    createWaveformBars() {
        let bars = '';
        for (let i = 0; i < 20; i++) {
            bars += '<div class="waveform-bar"></div>';
        }
        return bars;
    }
    
    getRandomPosition() {
        const margin = 100;
        const x = margin + Math.random() * (window.innerWidth - margin * 2 - 250);
        const y = margin + Math.random() * (window.innerHeight - margin * 2 - 60);
        return { x, y };
    }
    
    getRandomColor() {
        const colors = [
            '#075e54', '#128c7e', '#25d366', '#34b7f1', '#7b68ee',
            '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

async function loadAudioFiles() {
    audioFiles = [
        'https://res.cloudinary.com/dprjkfgqf/video/upload/f_mp3,br_128k/v1755302946/megl-accussi_km8uea.wav'
    ];
    
    if (audioFiles.length > 0) {
        audioFiles.forEach((file, index) => {
            setTimeout(() => {
                new VoiceNote(file, index);
            }, index * 100);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadAudioFiles();
});

window.addEventListener('resize', () => {
    // Reposition notes on resize if needed
    document.querySelectorAll('.voice-note').forEach((note, index) => {
        const voiceNote = new VoiceNote('', index);
        const position = voiceNote.getRandomPosition();
        note.style.left = `${position.x}px`;
        note.style.top = `${position.y}px`;
    });
});