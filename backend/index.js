const express = require('express');
const cors = require('cors');
const ping = require('ping');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = 3001;

const corsOptions = {
    origin: ['http://localhost:5173', 'https://ping-test-two.vercel.app'], // Güvenlik için sadece frontend'e izin ver
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

const pingLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 dakika
    max: 100, // Her IP için 1 dakikada en fazla 100 istek
    message: { error: 'Çok fazla istek attınız, lütfen bekleyin.' }
});

// Targets mapping
const targets = {
    'lol-tr': '104.160.143.212',
    'lol-euw': '104.160.141.3',
    'valorant-tr': '162.249.79.1', 
    'valorant-eu': '162.249.72.1', 
    'cs2-eu': '146.66.152.1',      
    'google': '8.8.8.8',
    'cloudflare': '1.1.1.1'
};

app.get('/api/ping', pingLimiter, async (req, res) => {
    const { target } = req.query;
    
    if (!target || !targets[target]) {
        return res.status(400).json({ error: 'Geçersiz hedef.' });
    }

    const host = targets[target];
    
    try {
        let pingRes = await ping.promise.probe(host, {
            timeout: 2,
        });

        res.json({
            target: target,
            host: host,
            alive: pingRes.alive,
            time: pingRes.time === 'unknown' ? -1 : parseFloat(pingRes.time), // Time in ms
            packetLoss: pingRes.packetLoss
        });
    } catch (err) {
        res.status(500).json({ error: 'Ping işlemi başarısız.', details: err.message });
    }
});

// Download endpoint: Generates random data chunk
app.get('/api/download', (req, res) => {
    // Generate a 10MB chunk of data
    const size = 10 * 1024 * 1024; 
    const buffer = Buffer.alloc(size, '0');
    
    res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Length': size,
        'Cache-Control': 'no-store'
    });
    
    res.send(buffer);
});

// Upload endpoint: Receives data and discards it
app.post('/api/upload', (req, res) => {
    let received = 0;
    
    req.on('data', chunk => {
        received += chunk.length;
    });
    
    req.on('end', () => {
        res.json({ success: true, receivedBytes: received });
    });
});

app.listen(PORT, () => {
    console.log(`Ping test backend çalışıyor: http://localhost:${PORT}`);
});
