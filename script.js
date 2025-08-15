let audioFiles = [];
let currentlyPlaying = null;

async function loadAudioFiles() {
    // For now, manually specify your audio file
    // Replace this with your actual audio filename
    audioFiles = [
        '/audio/maestro paolo con alek - megl accussi.wav'
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
        .then(response => response.arrayBuffer())
        .then(data => audioContext.decodeAudioData(data))
        .then(buffer => {
            audioBuffer = buffer;
            const duration = buffer.duration;
            voiceNote.querySelector('.duration').textContent = formatDuration(duration);
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
        
        const chopDuration = 0.1;
        const gapDuration = 0.05;
        let currentChopTime = pauseTime;
        
        function playChop() {
            if (!isPlaying || currentEffect !== 'chopped') return;
            
            if (source) {
                source.stop();
                source.disconnect();
            }
            
            source = audioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioContext.destination);
            
            const startOffset = currentChopTime % audioBuffer.duration;
            source.start(0, startOffset, chopDuration);
            
            currentChopTime += chopDuration * 2;
            pauseTime = currentChopTime;
            
            if (currentChopTime >= audioBuffer.duration) {
                stopAudio();
                return;
            }
            
            chopInterval = setTimeout(playChop, (chopDuration + gapDuration) * 1000);
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
        
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        
        e.preventDefault();
    }
    
    function drag(e) {
        if (!isDragging) return;
        
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        velocityX = clientX - lastMouseX;
        velocityY = clientY - lastMouseY;
        
        lastMouseX = clientX;
        lastMouseY = clientY;
        
        const deltaX = clientX - dragStartX;
        const deltaY = clientY - dragStartY;
        
        voiceNote.style.left = `${elementStartX + deltaX}px`;
        voiceNote.style.top = `${elementStartY + deltaY}px`;
    }
    
    function endDrag() {
        if (!isDragging) return;
        
        isDragging = false;
        voiceNote.style.cursor = 'pointer';
        voiceNote.style.zIndex = '';
        
        if (Math.abs(velocityX) > 2 || Math.abs(velocityY) > 2) {
            animateThrow();
        }
    }
    
    function animateThrow() {
        const friction = 0.95;
        const gravity = 0.5;
        const bounceDamping = 0.7;
        const minVelocity = 0.5;
        
        function animate() {
            velocityX *= friction;
            velocityY *= friction;
            velocityY += gravity;
            
            let x = parseFloat(voiceNote.style.left);
            let y = parseFloat(voiceNote.style.top);
            
            x += velocityX;
            y += velocityY;
            
            const noteWidth = voiceNote.offsetWidth;
            const noteHeight = voiceNote.offsetHeight;
            
            if (x < 0) {
                x = 0;
                velocityX = -velocityX * bounceDamping;
            } else if (x + noteWidth > window.innerWidth) {
                x = window.innerWidth - noteWidth;
                velocityX = -velocityX * bounceDamping;
            }
            
            if (y < 0) {
                y = 0;
                velocityY = -velocityY * bounceDamping;
            } else if (y + noteHeight > window.innerHeight) {
                y = window.innerHeight - noteHeight;
                velocityY = -velocityY * bounceDamping;
                
                if (Math.abs(velocityY) < 2) {
                    velocityY = 0;
                }
            }
            
            voiceNote.style.left = `${x}px`;
            voiceNote.style.top = `${y}px`;
            
            const currentRotation = parseFloat(voiceNote.style.transform.match(/rotate\(([-\d.]+)deg\)/)?.[1] || 0);
            voiceNote.style.transform = `rotate(${currentRotation + velocityX * 0.5}deg)`;
            
            if (Math.abs(velocityX) > minVelocity || Math.abs(velocityY) > minVelocity) {
                animationId = requestAnimationFrame(animate);
            } else {
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