let audioFiles = [];
let currentlyPlaying = null;

async function loadAudioFiles() {
    // For now, manually specify your audio file
    // Replace this with your actual audio filename
    // Use different path for local vs deployed
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    audioFiles = [
        isLocal ? '/public/audio/maestro-paolo.wav' : '/audio/maestro-paolo.wav'
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
    
    voiceNote.innerHTML = `
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
            <button class="effect-btn" data-effect="chopped">chopped</button>
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
    
    fetch(audioFile.startsWith('/') ? audioFile : `/audio/${audioFile}`)
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
            voiceNote.querySelector('.duration').textContent = 'Error';
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
    
    function playChoppedEffect() {
        if (!audioBuffer) return;
        
        let currentChopTime = pauseTime;
        let repeatCount = 0;
        let currentSegment = null;
        
        function playChop() {
            if (!isPlaying || currentEffect !== 'chopped') return;
            
            if (source) {
                source.stop();
                source.disconnect();
            }
            
            source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            
            // Chopped and screwed signature: slowed down (0.7x speed)
            source.playbackRate.value = 0.7;
            
            // Create effects chain for that thick, syrupy sound
            const gainNode = audioContext.createGain();
            const lowpassFilter = audioContext.createBiquadFilter();
            const delayNode = audioContext.createDelay();
            const feedbackGain = audioContext.createGain();
            
            // Low-pass filter for muffled, underwater effect
            lowpassFilter.type = 'lowpass';
            lowpassFilter.frequency.value = 2000;
            lowpassFilter.Q.value = 3;
            
            // Delay for echo/reverb
            delayNode.delayTime.value = 0.15;
            feedbackGain.gain.value = 0.35;
            gainNode.gain.value = 0.9;
            
            // Connect the chain
            source.connect(lowpassFilter);
            lowpassFilter.connect(gainNode);
            gainNode.connect(delayNode);
            delayNode.connect(feedbackGain);
            feedbackGain.connect(delayNode);
            gainNode.connect(audioContext.destination);
            delayNode.connect(audioContext.destination);
            
            let chopDuration, nextDelay;
            
            // Lighter chopped pattern: longer segments, less repetition
            if (repeatCount === 0) {
                // New segment - favor longer phrases
                currentSegment = Math.random() > 0.3 ? 
                    Math.random() * 1.2 + 0.8 : // Longer phrases (0.8-2.0s)
                    Math.random() * 0.6 + 0.4;   // Medium chops (0.4-1.0s)
                
                repeatCount = Math.random() > 0.7 ? 
                    Math.floor(Math.random() * 2) + 2 : // Repeat 2-3 times (less frequent)
                    1; // More often no repeat
            }
            
            chopDuration = currentSegment;
            const startOffset = currentChopTime % audioBuffer.duration;
            
            // Play the segment
            source.start(0, startOffset, chopDuration);
            
            repeatCount--;
            
            if (repeatCount > 0) {
                // Repeat the same segment
                nextDelay = chopDuration / 0.7; // Account for slower playback
            } else {
                // Move to next part
                const movement = chopDuration + (Math.random() * 0.3); // Some overlap/gap
                currentChopTime += movement;
                pauseTime = currentChopTime;
                
                // Rarely skip to a different part (even less frequent for smoother flow)
                if (Math.random() > 0.95) {
                    currentChopTime = Math.random() * audioBuffer.duration;
                    pauseTime = currentChopTime;
                }
                
                if (currentChopTime >= audioBuffer.duration) {
                    currentChopTime = 0;
                    pauseTime = 0;
                }
                
                nextDelay = (chopDuration / 0.7) + (Math.random() * 0.05); // Even smaller gap for smoother flow
            }
            
            chopInterval = setTimeout(playChop, nextDelay * 1000);
        }
        
        isPlaying = true;
        voiceNote.classList.add('playing');
        playChop();
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
        
        if (currentEffect === 'chopped') {
            if (chopInterval) {
                clearTimeout(chopInterval);
                chopInterval = null;
            }
        } else {
            pauseTime = (audioContext.currentTime - startTime) % audioBuffer.duration;
        }
        
        if (source) {
            source.stop();
            source.disconnect();
            source = null;
        }
        
        isPlaying = false;
        voiceNote.classList.remove('playing');
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
            
            if (currentEffect === 'chopped') {
                playChoppedEffect();
            } else if (currentEffect === 'fast') {
                playAudio(1.5);
            } else if (currentEffect === 'slow') {
                playAudio(0.75);
            } else {
                playAudio(1);
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
            
            effectButtons.forEach(b => b.classList.remove('active'));
            
            if (currentEffect === effect) {
                currentEffect = 'normal';
            } else {
                btn.classList.add('active');
                currentEffect = effect;
                
                if (isPlaying) {
                    pauseAudio();
                    pauseTime = 0;
                    
                    if (effect === 'chopped') {
                        playChoppedEffect();
                    } else if (effect === 'fast') {
                        playAudio(1.5);
                    } else if (effect === 'slow') {
                        playAudio(0.75);
                    }
                }
            }
        });
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
        if (e.target.classList.contains('effect-btn') || e.target.closest('.play-button')) return;
        
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
        
        const newX = elementStartX + deltaX;
        const newY = elementStartY + deltaY;
        
        // Use transform for better performance on mobile
        voiceNote.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0) rotate(${getRandomRotation()}deg)`;
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
            
            if (Math.abs(velocityX) > 1 || Math.abs(velocityY) > 1) {
                animateThrow();
            }
        }
    }
    
    function animateThrow() {
        const friction = 0.98;
        const gravity = 0.4;
        const bounceDamping = 0.75;
        const minVelocity = 0.3;
        const maxVelocity = 25;
        
        // Cap velocity for smoother experience
        velocityX = Math.max(-maxVelocity, Math.min(maxVelocity, velocityX));
        velocityY = Math.max(-maxVelocity, Math.min(maxVelocity, velocityY));
        
        let rotationVelocity = velocityX * 0.3;
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