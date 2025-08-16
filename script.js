let audioFiles = [];
let currentlyPlaying = null;

async function loadAudioFiles() {
    // For now, manually specify your audio file
    // Replace this with your actual audio filename
    // Use Cloudinary URL for reliable hosting
    audioFiles = [
        'https://res.cloudinary.com/dprjkfgqf/video/upload/v1755302946/megl-accussi_km8uea.wav'
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

function createVoiceNote(audioFile, index) {
    const container = document.getElementById('voice-notes-container');
    const voiceNote = document.createElement('div');
    voiceNote.className = 'voice-note';
    voiceNote.id = `voice-note-${index}`;
    
    const position = getRandomPosition();
    const rotation = getRandomRotation();
    
    voiceNote.style.left = `${position.x}px`;
    voiceNote.style.top = `${position.y}px`;
    voiceNote.style.transform = `rotate(${rotation}deg)`;
    
    // Extract title from filename (remove path and extension)
    const fileName = audioFile.split('/').pop().replace(/\.[^/.]+$/, '');
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
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    let audioBuffer = null;
    let source = null;
    let isPlaying = false;
    let startTime = 0;
    let pauseTime = 0;
    let currentEffect = 'normal';
    let chopInterval = null;
    
    fetch(audioFile)
        .then(response => {
            console.log('Audio fetch response:', response.status, response.statusText);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.arrayBuffer();
        })
        .then(data => {
            console.log('Audio data loaded, size:', data.byteLength);
            return audioContext.decodeAudioData(data);
        })
        .then(buffer => {
            audioBuffer = buffer;
            const duration = buffer.duration;
            voiceNote.querySelector('.duration').textContent = formatDuration(duration);
            console.log('Audio loaded successfully, duration:', duration);
        })
        .catch(error => {
            console.error('Error loading audio:', error);
            voiceNote.style.opacity = '0.5';
            voiceNote.querySelector('.duration').textContent = 'LFS Error';
            
            // Show error details in console
            console.log('File URL:', audioFile);
            console.log('Error details:', error.message);
        });
    
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
        voiceNote.classList.remove('playing');
        voiceNote.querySelector('.progress-bar').style.width = '0%';
        pauseTime = 0;
        
        if (currentlyPlaying && currentlyPlaying.element === voiceNote) {
            currentlyPlaying = null;
        }
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
    playButton.addEventListener('click', (e) => {
        e.stopPropagation();
        
        if (isPlaying) {
            pauseAudio();
        } else {
            if (currentlyPlaying && currentlyPlaying.element !== voiceNote) {
                currentlyPlaying.stop();
            }
            
            if (currentEffect === 'bass') {
                playAudioWithEffect(1, true);
            } else if (currentEffect === 'fast') {
                playAudioWithEffect(1.5, false);
            } else if (currentEffect === 'slow') {
                playAudioWithEffect(0.75, false);
            } else {
                playAudioWithEffect(1, false);
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
        
        if (!audioBuffer) return;
        
        const rect = waveformContainer.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clickX = clientX - rect.left;
        const progress = Math.max(0, Math.min(1, clickX / rect.width));
        const newTime = progress * audioBuffer.duration;
        
        pauseTime = Math.max(0, Math.min(newTime, audioBuffer.duration));
        
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
        
        // Get current rotation (preserve it during drag for smoother feel)
        const currentRotation = parseFloat(voiceNote.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
        
        // Use transform for better performance on mobile - no random rotation during drag
        voiceNote.style.transform = `translate3d(${newX - elementStartX}px, ${newY - elementStartY}px, 0) rotate(${currentRotation}deg)`;
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
        voiceNote.style.transform = voiceNote.style.transform.replace('translate3d(0px, 0px, 0)', '');
        
        // Calculate average velocity from recent history for smoother throws
        if (voiceNote.velocityHistory && voiceNote.velocityHistory.length > 0) {
            const recentHistory = voiceNote.velocityHistory.slice(-3);
            const avgVelocityX = recentHistory.reduce((sum, v) => sum + v.x, 0) / recentHistory.length;
            const avgVelocityY = recentHistory.reduce((sum, v) => sum + v.y, 0) / recentHistory.length;
            
            velocityX = avgVelocityX * 2; // Amplify for better throw feel
            velocityY = avgVelocityY * 2;
            
            // Only animate if thrown with significant force (increase threshold)
            if (Math.abs(velocityX) > 3 || Math.abs(velocityY) > 3) {
                animateThrow();
            }
        }
    }
    
    function animateThrow() {
        const friction = 0.95;
        const gravity = 0.3;
        const bounceDamping = 0.6;
        const minVelocity = 0.5;
        const maxVelocity = 15; // Reduced max velocity for gentler throws
        
        // Cap velocity for smoother experience
        velocityX = Math.max(-maxVelocity, Math.min(maxVelocity, velocityX));
        velocityY = Math.max(-maxVelocity, Math.min(maxVelocity, velocityY));
        
        let rotationVelocity = velocityX * 0.1; // Much less rotation
        let currentRotation = parseFloat(voiceNote.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
        
        function animate() {
            velocityX *= friction;
            velocityY *= friction;
            velocityY += gravity;
            rotationVelocity *= friction;
            
            let x = parseFloat(voiceNote.style.left);
            let y = parseFloat(voiceNote.style.top);
            
            x += velocityX;
            y += velocityY;
            currentRotation += rotationVelocity;
            
            const noteWidth = voiceNote.offsetWidth;
            const noteHeight = voiceNote.offsetHeight;
            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            
            // Bounce off edges with more realistic physics
            if (x < 0) {
                x = 0;
                velocityX = -velocityX * bounceDamping;
                rotationVelocity *= -0.8;
            } else if (x + noteWidth > screenWidth) {
                x = screenWidth - noteWidth;
                velocityX = -velocityX * bounceDamping;
                rotationVelocity *= -0.8;
            }
            
            if (y < 0) {
                y = 0;
                velocityY = -velocityY * bounceDamping;
                rotationVelocity *= 0.8;
            } else if (y + noteHeight > screenHeight) {
                y = screenHeight - noteHeight;
                velocityY = -velocityY * bounceDamping;
                rotationVelocity *= 0.8;
                
                // Settle on ground
                if (Math.abs(velocityY) < 1.5) {
                    velocityY = 0;
                    y = screenHeight - noteHeight;
                }
            }
            
            // Use transform for better performance
            voiceNote.style.transform = `translate3d(${x - parseFloat(voiceNote.style.left)}px, ${y - parseFloat(voiceNote.style.top)}px, 0) rotate(${currentRotation}deg)`;
            voiceNote.style.left = `${x}px`;
            voiceNote.style.top = `${y}px`;
            
            // Continue animation while there's significant movement
            if (Math.abs(velocityX) > minVelocity || Math.abs(velocityY) > minVelocity || Math.abs(rotationVelocity) > 0.5) {
                animationId = requestAnimationFrame(animate);
            } else {
                // Final position cleanup
                voiceNote.style.transform = `rotate(${currentRotation}deg)`;
                animationId = null;
            }
        }
        
        animate();
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