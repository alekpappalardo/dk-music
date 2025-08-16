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
        
        // WhatsApp-style scrubbing
        waveform.addEventListener('mousedown', (e) => this.startScrub(e));
        waveform.addEventListener('touchstart', (e) => this.startScrub(e));
        
        document.addEventListener('mousemove', (e) => this.handleScrub(e));
        document.addEventListener('touchmove', (e) => this.handleScrub(e));
        
        document.addEventListener('mouseup', () => this.endScrub());
        document.addEventListener('touchend', () => this.endScrub());
    }
    
    setupGestures() {
        // Use Hammer.js for smooth touch interactions
        this.hammer = new Hammer(this.element);
        
        // Enable pan and rotate
        this.hammer.get('pan').set({ direction: Hammer.DIRECTION_ALL });
        this.hammer.get('rotate').set({ enable: true });
        
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
    
    // Audio scrubbing like WhatsApp
    startScrub(e) {
        e.preventDefault();
        e.stopPropagation();
        this.isScrubbing = true;
        this.handleScrub(e);
    }
    
    handleScrub(e) {
        if (!this.isScrubbing) return;
        
        const waveform = this.element.querySelector('.waveform-container');
        const rect = waveform.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const x = clientX - rect.left;
        const progress = Math.max(0, Math.min(1, x / rect.width));
        
        if (this.audio.duration) {
            this.audio.currentTime = progress * this.audio.duration;
            this.updateProgress();
        }
    }
    
    endScrub() {
        this.isScrubbing = false;
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
    
    toggleEffect(effect) {
        const btn = this.element.querySelector(`[data-effect="${effect}"]`);
        const allBtns = this.element.querySelectorAll('.effect-btn');
        
        if (this.currentEffect === effect) {
            // Turn off effect
            this.currentEffect = 'normal';
            btn.classList.remove('active');
            this.audio.playbackRate = 1;
            this.removeAudioFilter();
        } else {
            // Turn on new effect
            allBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            this.currentEffect = effect;
            this.applyEffect(effect);
        }
        
        if (navigator.vibrate) navigator.vibrate(8);
    }
    
    applyEffect(effect) {
        switch (effect) {
            case 'fast':
                this.audio.playbackRate = 1.5;
                this.removeAudioFilter();
                break;
            case 'slow':
                this.audio.playbackRate = 0.75;
                this.removeAudioFilter();
                break;
            case 'bass':
                this.audio.playbackRate = 1;
                this.applyBassFilter();
                break;
            default:
                this.audio.playbackRate = 1;
                this.removeAudioFilter();
        }
    }
    
    applyBassFilter() {
        // Simple bass boost using CSS filter as fallback
        // For better bass, we'd need Web Audio API, but keeping it simple
        this.element.style.filter = 'contrast(1.2) saturate(1.3)';
    }
    
    removeAudioFilter() {
        this.element.style.filter = '';
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
        
        this.element.querySelector('.progress-bar').style.width = `${progress}%`;
        this.element.querySelector('.duration').textContent = this.formatTime(remaining);
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