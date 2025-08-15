let audioFiles = [];
let currentlyPlaying = null;

async function loadAudioFiles() {
    try {
        const response = await fetch('/api/audio-files');
        const data = await response.json();
        audioFiles = data.files;
        
        if (audioFiles.length === 0) {
            audioFiles = [
                '/audio/sample1.mp3',
                '/audio/sample2.mp3',
                '/audio/sample3.mp3'
            ];
        }
        
        audioFiles.forEach((file, index) => {
            setTimeout(() => {
                createVoiceNote(file, index);
            }, index * 100);
        });
    } catch (error) {
        console.error('Error loading audio files:', error);
        audioFiles = [
            '/audio/sample1.mp3',
            '/audio/sample2.mp3',
            '/audio/sample3.mp3'
        ];
        audioFiles.forEach((file, index) => {
            setTimeout(() => {
                createVoiceNote(file, index);
            }, index * 100);
        });
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
        <div class="play-button">
            <div class="play-icon"></div>
            <div class="pause-icon"></div>
        </div>
        <div class="waveform-container">
            ${createWaveformBars()}
        </div>
        <span class="duration">0:00</span>
        <div class="progress-bar"></div>
    `;
    
    const audio = new Audio(audioFile.startsWith('/') ? audioFile : `/audio/${audioFile}`);
    let progressInterval;
    
    audio.addEventListener('loadedmetadata', () => {
        voiceNote.querySelector('.duration').textContent = formatDuration(audio.duration);
    });
    
    audio.addEventListener('ended', () => {
        voiceNote.classList.remove('playing');
        voiceNote.querySelector('.progress-bar').style.width = '0%';
        clearInterval(progressInterval);
        currentlyPlaying = null;
    });
    
    voiceNote.addEventListener('click', () => {
        if (voiceNote.classList.contains('playing')) {
            audio.pause();
            voiceNote.classList.remove('playing');
            clearInterval(progressInterval);
            currentlyPlaying = null;
        } else {
            if (currentlyPlaying && currentlyPlaying.audio !== audio) {
                currentlyPlaying.audio.pause();
                currentlyPlaying.element.classList.remove('playing');
                currentlyPlaying.element.querySelector('.progress-bar').style.width = '0%';
                clearInterval(currentlyPlaying.interval);
            }
            
            audio.play();
            voiceNote.classList.add('playing');
            
            progressInterval = setInterval(() => {
                const progress = (audio.currentTime / audio.duration) * 100;
                voiceNote.querySelector('.progress-bar').style.width = `${progress}%`;
                voiceNote.querySelector('.duration').textContent = formatDuration(audio.duration - audio.currentTime);
            }, 100);
            
            currentlyPlaying = {
                audio: audio,
                element: voiceNote,
                interval: progressInterval
            };
        }
    });
    
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