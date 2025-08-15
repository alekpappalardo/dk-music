import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
    const audioDir = path.join(process.cwd(), 'public', 'audio');
    
    try {
        const files = fs.readdirSync(audioDir)
            .filter(file => file.endsWith('.mp3') || file.endsWith('.wav') || file.endsWith('.m4a'))
            .map(file => `/audio/${file}`);
        
        res.status(200).json({ files });
    } catch (error) {
        res.status(500).json({ error: 'Failed to read audio files' });
    }
}