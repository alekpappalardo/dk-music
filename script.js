let audioFiles = [];
let currentlyPlaying = null;

async function loadAudioFiles() {
    // For now, manually specify your audio file
    // Replace this with your actual audio filename
    // Use Cloudinary URL with optimizations for fast loading
    audioFiles = [
        'https://res.cloudinary.com/dprjkfgqf/video/upload/ac_none,br_128k,f_mp3/v1755302946/megl-accussi_km8uea.wav'
    ];
    
    if (audioFiles.length > 0) {
        audioFiles.forEach((file, index) => {
            setTimeout(() => {
                createVoiceNote(file, index);
            }, index * 100);
        });
    } else {
        console.log('No audio files found. Add files to public/audio/ folder.');
    }
}

function getRandomPosition() {
    const margin = 100;
    const x = margin + Math.random() * (window.innerWidth - margin * 2 - 250);
    const y = margin + Math.random() * (window.innerHeight - margin * 2 - 60);
    return { x, y };
}

function getRandomRotation() {
    return Math.random() * 360;
}

function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function createWaveformBars() {
    let bars = '';
    for (let i = 0; i < 20; i++) {
        bars += '<div class="waveform-bar"></div>';
    }
    return bars;
}

function getRandomColor() {
    const colors = [
        '#075e54', // Original WhatsApp green
        '#128c7e', // Lighter green
        '#25d366', // WhatsApp light green
        '#34b7f1', // Telegram blue
        '#7b68ee', // Medium slate blue
        '#ff6b6b', // Coral red
        '#4ecdc4', // Turquoise
        '#45b7d1', // Sky blue
        '#96ceb4', // Mint green
        '#feca57', // Orange yellow
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

function createVoiceNote(audioFile, index) {
    const container = document.getElementById('voice-notes-container');
    const voiceNote = document.createElement('div');
    voiceNote.className = 'voice-note';
    voiceNote.id = `voice-note-${index}`;
    
    const position = getRandomPosition();
    const rotation = getRandomRotation();
    const randomColor = getRandomColor();
    
    voiceNote.style.left = `${position.x}px`;
    voiceNote.style.top = `${position.y}px`;
    voiceNote.style.transform = `rotate(${rotation}deg)`;
    voiceNote.style.background = randomColor;
    
    // Extract and clean title from filename
    let fileName = audioFile.split('/').pop().replace(/\.[^/.]+$/, '');
    // Remove Cloudinary ID part (everything after underscore)
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
                ${createWaveformBars()}
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
    
    // Use HTML5 Audio for instant loading, Web Audio for effects
    const html5Audio = new Audio();
    html5Audio.preload = 'metadata'; // Load metadata immediately
    html5Audio.src = audioFile;
    
    let audioContext = null;
    let audioBuffer = null;
    let source = null;
    let isPlaying = false;
    let startTime = 0;
    let pauseTime = 0;
    let currentEffect = 'normal';
    let chopInterval = null;
    let useWebAudio = false; // Start with HTML5, switch to Web Audio for effects
    
    // Instant UI feedback - show duration as soon as metadata loads
    html5Audio.addEventListener('loadedmetadata', () => {
        voiceNote.querySelector('.duration').textContent = formatDuration(html5Audio.duration);
        console.log('Audio metadata loaded instantly, duration:', html5Audio.duration);
    });
    
    html5Audio.addEventListener('canplaythrough', () => {
        console.log('Audio can play through without interruption');
    });
    
    html5Audio.addEventListener('error', (e) => {
        console.error('HTML5 Audio error:', e);
        voiceNote.style.opacity = '0.5';
        voiceNote.querySelector('.duration').textContent = 'Error';
    });
    
    // Lazy load Web Audio API only when effects are needed
    async function initWebAudio() {
        if (audioContext && audioBuffer) return;
        
        try {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const response = await fetch(audioFile);
            const data = await response.arrayBuffer();
            audioBuffer = await audioContext.decodeAudioData(data);
            console.log('Web Audio buffer loaded for effects');
        } catch (error) {
            console.error('Error loading Web Audio:', error);
        }
    }
    
    // HTML5 Audio playback for normal/fast/slow (instant)
    function playHTML5Audio(playbackRate = 1) {
        html5Audio.currentTime = pauseTime;
        html5Audio.playbackRate = playbackRate;
        html5Audio.play();
        isPlaying = true;
        voiceNote.classList.add('playing');
        useWebAudio = false;
        
        startTime = Date.now() / 1000 - pauseTime;
        updateProgressHTML5();
    }
    
    function updateProgressHTML5() {
        if (!isPlaying || useWebAudio) return;
        
        const progressInterval = setInterval(() => {
            if (!isPlaying || useWebAudio) {
                clearInterval(progressInterval);
                return;
            }
            
            const currentTime = html5Audio.currentTime;
            const duration = html5Audio.duration;
            const progress = (currentTime / duration) * 100;
            
            voiceNote.querySelector('.progress-bar').style.width = `${progress}%`;
            voiceNote.querySelector('.duration').textContent = formatDuration(duration - currentTime);
            
            if (html5Audio.ended) {
                stopAudio();
                clearInterval(progressInterval);
            }
        }, 100);
    }
    
    function playAudio(playbackRate = 1) {
        if (!audioBuffer) return;
        
        if (source) {
            source.stop();
            source.disconnect();
        }
        
        source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        source.connect(audioContext.destination);
        
        source.onended = () => {
            if (currentEffect !== 'chopped') {
                stopAudio();
            }
        };
        
        const offset = pauseTime;
        source.start(0, offset);
        startTime = audioContext.currentTime - offset;
        isPlaying = true;
        voiceNote.classList.add('playing');
        
        updateProgress();
    }
    
    function playAudioWithEffect(playbackRate = 1, useBass = false) {
        if (!audioBuffer) return;
        
        if (source) {
            source.stop();
            source.disconnect();
        }
        
        source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = playbackRate;
        
        if (useBass) {
            // Create bass boost effect chain
            const gainNode = audioContext.createGain();
            const bassBoost = audioContext.createBiquadFilter();
            const lowShelf = audioContext.createBiquadFilter();
            const compressor = audioContext.createDynamicsCompressor();
            
            // Bass boost - emphasize low frequencies
            bassBoost.type = 'peaking';
            bassBoost.frequency.value = 80;
            bassBoost.Q.value = 2;
            bassBoost.gain.value = 12;
            
            // Low shelf for additional warmth
            lowShelf.type = 'lowshelf';
            lowShelf.frequency.value = 200;
            lowShelf.gain.value = 8;
            
            // Compressor to control the boosted bass
            compressor.threshold.value = -20;
            compressor.knee.value = 5;
            compressor.ratio.value = 4;
            compressor.attack.value = 0.01;
            compressor.release.value = 0.1;
            
            gainNode.gain.value = 1.2;
            
            // Connect the effects chain
            source.connect(bassBoost);
            bassBoost.connect(lowShelf);
            lowShelf.connect(compressor);
            compressor.connect(gainNode);
            gainNode.connect(audioContext.destination);
        } else {
            // Direct connection for normal/fast/slow
            source.connect(audioContext.destination);
        }
        
        const offset = pauseTime;
        source.start(0, offset);
        startTime = audioContext.currentTime - offset;
        isPlaying = true;
        voiceNote.classList.add('playing');
        
        source.onended = () => {
            stopAudio();
        };
        
        updateProgress();
    }
    
    function stopAudio() {
        // Stop HTML5 Audio
        html5Audio.pause();
        html5Audio.currentTime = 0;
        
        // Stop Web Audio
        if (source) {
            source.stop();
            source.disconnect();
            source = null;
        }
        
        if (chopInterval) {
            clearTimeout(chopInterval);
            chopInterval = null;
        }
        
        isPlaying = false;
        useWebAudio = false;
        voiceNote.classList.remove('playing');
        voiceNote.querySelector('.progress-bar').style.width = '0%';
        pauseTime = 0;
        
        if (currentlyPlaying && currentlyPlaying.element === voiceNote) {
            currentlyPlaying = null;
        }
    }
    
    function pauseAudioHybrid() {
        if (!isPlaying) return;
        
        if (useWebAudio) {
            // Web Audio pause logic
            const playbackRate = currentEffect === 'fast' ? 1.5 : currentEffect === 'slow' ? 0.75 : 1;
            pauseTime = ((audioContext.currentTime - startTime) * playbackRate) % audioBuffer.duration;
            
            if (source) {
                source.stop();
                source.disconnect();
                source = null;
            }
        } else {
            // HTML5 Audio pause
            html5Audio.pause();
            pauseTime = html5Audio.currentTime;
        }
        
        isPlaying = false;
        voiceNote.classList.remove('playing');
    }
    
    function pauseAudio() {
        if (!isPlaying) return;
        
        // Always update pause time based on current playback position
        const playbackRate = currentEffect === 'fast' ? 1.5 : currentEffect === 'slow' ? 0.75 : 1;
        pauseTime = ((audioContext.currentTime - startTime) * playbackRate) % audioBuffer.duration;
        
        if (source) {
            source.stop();
            source.disconnect();
            source = null;
        }
        
        isPlaying = false;
        voiceNote.classList.remove('playing');
    }
    
    function switchEffectWhilePlaying(newEffect) {
        if (!isPlaying) return;
        
        // Calculate current position
        const playbackRate = currentEffect === 'fast' ? 1.5 : currentEffect === 'slow' ? 0.75 : 1;
        pauseTime = ((audioContext.currentTime - startTime) * playbackRate) % audioBuffer.duration;
        
        // Stop current source
        if (source) {
            source.stop();
            source.disconnect();
        }
        
        // Update effect
        currentEffect = newEffect;
        
        // Start with new effect immediately
        if (newEffect === 'bass') {
            playAudioWithEffect(1, true);
        } else if (newEffect === 'fast') {
            playAudioWithEffect(1.5, false);
        } else if (newEffect === 'slow') {
            playAudioWithEffect(0.75, false);
        } else {
            playAudioWithEffect(1, false);
        }
    }
    
    function updateProgress() {
        if (!isPlaying) return;
        
        const progressInterval = setInterval(() => {
            if (!isPlaying) {
                clearInterval(progressInterval);
                return;
            }
            
            let currentTime;
            if (currentEffect === 'chopped') {
                currentTime = pauseTime;
            } else {
                const playbackRate = currentEffect === 'fast' ? 1.5 : currentEffect === 'slow' ? 0.75 : 1;
                currentTime = ((audioContext.currentTime - startTime) * playbackRate) % audioBuffer.duration;
            }
            
            const progress = (currentTime / audioBuffer.duration) * 100;
            voiceNote.querySelector('.progress-bar').style.width = `${progress}%`;
            voiceNote.querySelector('.duration').textContent = formatDuration(audioBuffer.duration - currentTime);
        }, 100);
    }
    
    const playButton = voiceNote.querySelector('.play-button');
    playButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        
        if (isPlaying) {
            pauseAudioHybrid();
        } else {
            if (currentlyPlaying && currentlyPlaying.element !== voiceNote) {
                currentlyPlaying.stop();
            }
            
            if (currentEffect === 'bass') {
                // Bass effect requires Web Audio - load it if needed
                await initWebAudio();
                if (audioBuffer) {
                    playAudioWithEffect(1, true);
                } else {
                    // Fallback to HTML5 if Web Audio fails
                    playHTML5Audio(1);
                }
            } else if (currentEffect === 'fast') {
                // Fast can use HTML5 Audio for instant playback
                playHTML5Audio(1.5);
            } else if (currentEffect === 'slow') {
                // Slow can use HTML5 Audio for instant playback
                playHTML5Audio(0.75);
            } else {
                // Normal playback uses HTML5 for instant start
                playHTML5Audio(1);
            }
            
            currentlyPlaying = {
                element: voiceNote,
                stop: stopAudio
            };
        }
    });
    
    const effectButtons = voiceNote.querySelectorAll('.effect-btn');
    effectButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            
            const effect = btn.dataset.effect;
            
            if (currentEffect === effect) {
                // Toggle off - go back to normal
                effectButtons.forEach(b => b.classList.remove('active'));
                if (isPlaying) {
                    switchEffectWhilePlaying('normal');
                } else {
                    currentEffect = 'normal';
                }
            } else {
                // Switch to new effect
                effectButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                if (isPlaying) {
                    switchEffectWhilePlaying(effect);
                } else {
                    currentEffect = effect;
                }
            }
        });
    });
    
    // Add WhatsApp-style scrubbing functionality
    const waveformContainer = voiceNote.querySelector('.waveform-container');
    let isScrubbing = false;
    
    function handleScrub(e) {
        e.stopPropagation();
        e.preventDefault();
        
        if (!html5Audio.duration && !audioBuffer) return;
        
        const rect = waveformContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clickX = clientX - rect.left;
        const progress = Math.max(0, Math.min(1, clickX / rect.width));
        
        // Use HTML5 duration if available, otherwise estimate
        const duration = html5Audio.duration || (audioBuffer ? audioBuffer.duration : 60);
        const newTime = progress * duration;
        
        pauseTime = Math.max(0, Math.min(newTime, duration));
        
        if (isPlaying) {
            // Restart with new position and current effect
            if (currentEffect === 'bass') {
                playAudioWithEffect(1, true);
            } else if (currentEffect === 'fast') {
                playAudioWithEffect(1.5, false);
            } else if (currentEffect === 'slow') {
                playAudioWithEffect(0.75, false);
            } else {
                playAudioWithEffect(1, false);
            }
        } else {
            // Update progress bar to show new position
            const progressPercent = (pauseTime / audioBuffer.duration) * 100;
            voiceNote.querySelector('.progress-bar').style.width = `${progressPercent}%`;
            voiceNote.querySelector('.duration').textContent = formatDuration(audioBuffer.duration - pauseTime);
        }
    }
    
    // Touch events for mobile scrubbing
    waveformContainer.addEventListener('touchstart', (e) => {
        isScrubbing = true;
        handleScrub(e);
    }, { passive: false });
    
    waveformContainer.addEventListener('touchmove', (e) => {
        if (isScrubbing) {
            handleScrub(e);
        }
    }, { passive: false });
    
    waveformContainer.addEventListener('touchend', () => {
        isScrubbing = false;
    });
    
    // Mouse events for desktop
    waveformContainer.addEventListener('mousedown', (e) => {
        isScrubbing = true;
        handleScrub(e);
    });
    
    waveformContainer.addEventListener('mousemove', (e) => {
        if (isScrubbing) {
            handleScrub(e);
        }
    });
    
    document.addEventListener('mouseup', () => {
        isScrubbing = false;
    });
    
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartX = 0;
    let elementStartY = 0;
    let velocityX = 0;
    let velocityY = 0;
    let lastMouseX = 0;
    let lastMouseY = 0;
    let animationId = null;
    
    function startDrag(e) {
        if (e.target.classList.contains('effect-btn') || 
            e.target.closest('.play-button') || 
            e.target.closest('.waveform-container')) return;
        
        isDragging = true;
        voiceNote.style.cursor = 'grabbing';
        voiceNote.style.zIndex = '1000';
        voiceNote.style.transition = 'none';
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        dragStartX = clientX;
        dragStartY = clientY;
        elementStartX = parseFloat(voiceNote.style.left);
        elementStartY = parseFloat(voiceNote.style.top);
        lastMouseX = clientX;
        lastMouseY = clientY;
        
        velocityX = 0;
        velocityY = 0;
        
        // Track velocity history for smoother throws
        const velocityHistory = [];
        const historyLimit = 5;
        
        voiceNote.velocityHistory = velocityHistory;
        voiceNote.historyLimit = historyLimit;
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        e.preventDefault();
        e.stopPropagation();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        const newVelocityX = clientX - lastMouseX;
        const newVelocityY = clientY - lastMouseY;
        
        // Track velocity history for smoother throwing
        voiceNote.velocityHistory.push({ x: newVelocityX, y: newVelocityY, time: Date.now() });
        if (voiceNote.velocityHistory.length > voiceNote.historyLimit) {
            voiceNote.velocityHistory.shift();
        }
        
        lastMouseX = clientX;
        lastMouseY = clientY;
        
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        
        let newX = elementStartX + deltaX;
        let newY = elementStartY + deltaY;
        
        // Add border constraints - prevent going beyond screen edges
        const noteWidth = voiceNote.offsetWidth;
        const noteHeight = voiceNote.offsetHeight;
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        
        newX = Math.max(0, Math.min(newX, screenWidth - noteWidth));
        newY = Math.max(0, Math.min(newY, screenHeight - noteHeight));
        
        // Add smooth rotation during drag based on movement
        const currentRotation = parseFloat(voiceNote.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
        const rotationIncrement = (newVelocityX + newVelocityY) * 0.5; // Smooth rotation based on movement
        const newRotation = currentRotation + rotationIncrement;
        
        // Use transform for better performance on mobile
        voiceNote.style.transform = `translate3d(${newX - elementStartX}px, ${newY - elementStartY}px, 0) rotate(${newRotation}deg)`;
        voiceNote.style.left = `${newX}px`;
        voiceNote.style.top = `${newY}px`;
        
        e.preventDefault();
        e.stopPropagation();
    }
    
    function endDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        voiceNote.style.cursor = 'grab';
        voiceNote.style.zIndex = '';
        
        // Clean up transform - keep only rotation
        const currentRotation = parseFloat(voiceNote.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
        voiceNote.style.transform = `rotate(${currentRotation}deg)`;
    }
    
    
    voiceNote.addEventListener('mousedown', startDrag);
    voiceNote.addEventListener('touchstart', startDrag, { passive: false });
    
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, { passive: false });
    
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
    
    container.appendChild(voiceNote);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAudioFiles();
});

window.addEventListener('resize', () => {
    document.querySelectorAll('.voice-note').forEach((note, index) => {
        const position = getRandomPosition();
        note.style.left = `${position.x}px`;
        note.style.top = `${position.y}px`;
    });
});