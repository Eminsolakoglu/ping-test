import React, { useState, useRef } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Activity, Repeat, Globe } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import confetti from 'canvas-confetti';
import './App.css';

const LolLogo = () => (
  <svg width="18" height="18" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 2L36 9V31L20 38L4 31V9L20 2Z" fill="#0a1428" stroke="#c89b3c" strokeWidth="2"/>
    <path d="M15 10L14 30L27 30L28 27L18 27L18 10L15 10Z" fill="#c89b3c"/>
  </svg>
);

const SERVERS = [
  { id: 'lol-tr', name: 'League of Legends (TR)', icon: <LolLogo /> },
  { id: 'google', name: 'Genel', icon: <Globe size={18} /> }
];

function App() {
  const [selectedServer, setSelectedServer] = useState(SERVERS[0].id);

  const [testState, setTestState] = useState('IDLE'); // IDLE, PINGING, DOWNLOADING, UPLOADING, DONE
  const [errorMsg, setErrorMsg] = useState(null);

  const [ping, setPing] = useState(null);
  const [jitter, setJitter] = useState(null);
  const [download, setDownload] = useState(null);
  const [upload, setUpload] = useState(null);

  const [progress, setProgress] = useState(0); // Actual target progress
  const [displayProgress, setDisplayProgress] = useState(0); // Smooth visual progress

  const progressRef = useRef(0);
  const displayRef = useRef(0);

  // Sync state to ref for the animation loop
  React.useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // 60FPS Animation Loop for smooth running
  React.useEffect(() => {
    let animationFrameId;

    const animate = () => {
      const target = progressRef.current;
      const current = displayRef.current;

      if (target === 0 && current !== 0) {
        displayRef.current = 0;
        setDisplayProgress(0);
      } else if (current < target) {
        const diff = target - current;
        // Move faster if far behind, but always maintain a minimum speed (gıdım gıdım)
        let speed = diff * 0.04;
        if (speed < 0.15) speed = 0.15; // Minimum 0.15% per frame (~9% per sec)

        let next = current + speed;
        if (next > target) next = target;

        displayRef.current = next;
        setDisplayProgress(next);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const runTest = async () => {
    if (isRunning) return;

    setTestState('PINGING');
    setErrorMsg(null);
    setProgress(0);
    setPing(null); setJitter(null); setDownload(null); setUpload(null);

    try {
      let finalPing = null;
      let finalJitter = null;
      let finalDownload = null;
      let finalUpload = null;

      // 1. PING & JITTER
      let pings = [];
      for (let i = 0; i < 5; i++) {
        try {
          const pRes = await fetch(`https://ping-test-ikgp.onrender.com/api/ping?target=${selectedServer}`);
          const pData = await pRes.json();
          if (pData.time && pData.time !== -1) {
            pings.push(pData.time);
          }
        } catch (e) {
          console.error('Ping request failed');
        }
        setProgress((i + 1) * 4);
        await new Promise(r => setTimeout(r, 100));
      }

      if (pings.length > 0) {
        const avgPing = pings.reduce((a, b) => a + b, 0) / pings.length;
        finalPing = Math.round(avgPing);
        finalJitter = pings.length > 1 ? Math.round(Math.abs(pings[pings.length-1] - pings[0]) / 2) : 0;
      }

      // 2. DOWNLOAD
      setTestState('DOWNLOADING');
      const dlStart = performance.now();
      const dlRes = await fetch('https://speed.cloudflare.com/__down?bytes=25000000');
      const reader = dlRes.body.getReader();
      let received = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        received += value.length;
        setProgress(20 + (received / 25000000) * 40);
      }
      const dlDuration = (performance.now() - dlStart) / 1000;
      finalDownload = ((received * 8) / dlDuration / 1000000).toFixed(1);

      // 3. UPLOAD
      setTestState('UPLOADING');
      const ulTotalBytes = 10000000;
      const ulChunks = 10;
      const ulChunkSize = ulTotalBytes / ulChunks;
      const ulBuffer = new Uint8Array(ulChunkSize);
      let ulSent = 0;
      let ulTotalTime = 0;

      for (let i = 0; i < ulChunks; i++) {
        const ulStart = performance.now();
        await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: ulBuffer });
        ulTotalTime += (performance.now() - ulStart);
        ulSent += ulChunkSize;
        setProgress(60 + (ulSent / ulTotalBytes) * 40);
      }
      finalUpload = ((ulSent * 8) / (ulTotalTime / 1000) / 1000000).toFixed(1);

      setProgress(100);
      setPing(finalPing);
      setJitter(finalJitter);
      setDownload(finalDownload);
      setUpload(finalUpload);

      confetti({ particleCount: 150, spread: 80, origin: { x: 0.5, y: 0.7 }, colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c'] });
    } catch (err) {
      console.error(err);
      setErrorMsg("Bağlantı hatası oluştu. Sunucu veya internet bağlantınızı kontrol edin.");
      setTestState('IDLE');
      return;
    }
    setTestState('DONE');
  };

  const isRunning = testState !== 'IDLE' && testState !== 'DONE';
  const focusClass = testState === 'TESTING' ? 'focus-track' : (testState === 'DONE' ? 'focus-scoreboard' : '');

  const getTrackPosition = (pct) => {
    const totalLength = 1428;
    const distance = (pct / 100) * totalLength;
    if (distance <= 200) return { x: 400 - distance, y: 100 };
    else if (distance <= 514) {
      const angle = ((distance - 200) / 314) * Math.PI;
      return { x: 200 - Math.sin(angle) * 100, y: 200 - Math.cos(angle) * 100 };
    } else if (distance <= 914) return { x: 200 + (distance - 514), y: 300 };
    else if (distance <= 1228) {
      const angle = ((distance - 914) / 314) * Math.PI;
      return { x: 600 + Math.sin(angle) * 100, y: 200 + Math.cos(angle) * 100 };
    } else return { x: 600 - (distance - 1228), y: 100 };
  };

  return (
    <div className={`stadium-container ${focusClass}`}>

      <div className="jumbotron-scoreboard">
        <div className="scoreboard-top-modern">
          <div className="server-selector">
            {SERVERS.map(s => (
              <div
                key={s.id}
                className={`server-option ${selectedServer === s.id ? 'active' : ''} ${s.id} ${isRunning ? 'disabled' : ''}`}
                onClick={() => !isRunning && setSelectedServer(s.id)}
              >
                {s.icon}
                {s.name}
              </div>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="error-message" style={{ color: '#ff4d4d', marginTop: '1rem', textAlign: 'center', background: 'rgba(255, 77, 77, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid #ff4d4d' }}>
            {errorMsg}
          </div>
        )}

        <div className="scoreboard-metrics">
          {/* PING */}
          <div className="metric-col">
            <div className="metric-title">
              <Repeat size={16} /> PING
            </div>
            <div className="metric-box">
              <div className="val-container">
                <span className={`metric-value ${ping === null ? 'empty-value' : ''}`}>
                  {ping !== null ? ping : ''}
                </span>
                <span className="metric-unit">ms</span>
              </div>
            </div>
          </div>

          {/* DOWNLOAD */}
          <div className="metric-col">
            <div className="metric-title">
              <ArrowDownCircle size={16} /> DOWNLOAD
            </div>
            <div className="metric-box">
              <div className="val-container">
                <span className={`metric-value ${download === null ? 'empty-value' : ''}`}>
                  {download !== null ? download : ''}
                </span>
                <span className="metric-unit">Mbps</span>
              </div>
            </div>
          </div>

          {/* JITTER */}
          <div className="metric-col">
            <div className="metric-title">
              <Activity size={16} /> JITTER
            </div>
            <div className="metric-box">
              <div className="val-container">
                <span className={`metric-value ${jitter === null ? 'empty-value' : ''}`}>
                  {jitter !== null ? jitter : ''}
                </span>
                <span className="metric-unit">ms</span>
              </div>
            </div>
          </div>

          {/* UPLOAD */}
          <div className="metric-col">
            <div className="metric-title">
              <ArrowUpCircle size={16} /> UPLOAD
            </div>
            <div className="metric-box">
              <div className="val-container">
                <span className={`metric-value ${upload === null ? 'empty-value' : ''}`}>
                  {upload !== null ? upload : ''}
                </span>
                <span className="metric-unit">Mbps</span>
              </div>
            </div>
          </div>
        </div>

        <div className="scoreboard-actions">
          <button
            className="go-btn"
            onClick={runTest}
            disabled={isRunning}
          >
            {isRunning ? 'TESTING...' : 'GO'}
          </button>
        </div>
      </div>

      <div className="oval-track-container">
        <svg viewBox="0 0 800 400" width="100%" height="100%">
          {selectedServer.includes('lol') ? (
            <g>
              {/* Outer Deep Forest */}
              <rect x="30" y="30" width="740" height="340" rx="170" ry="170" fill="#2d4221" />

              {/* The Dirt Path (Muddy Brown) */}
              <rect x="50" y="50" width="700" height="300" rx="150" ry="150" fill="#60432c" />

              {/* Inner Jungle */}
              <rect x="150" y="150" width="500" height="100" rx="50" ry="50" fill="#2d4221" />

              {/* Subtle Dirt Edges */}
              <rect x="50" y="50" width="700" height="300" rx="150" ry="150" fill="none" stroke="#3e2a1b" strokeWidth="8" />
              <rect x="150" y="150" width="500" height="100" rx="50" ry="50" fill="none" stroke="#3e2a1b" strokeWidth="8" />

              {/* Jungle Bushes / Trees (Inner) */}
              <circle cx="300" cy="180" r="18" fill="#192612" />
              <circle cx="325" cy="190" r="22" fill="#223318" />
              <circle cx="275" cy="210" r="15" fill="#192612" />

              <circle cx="520" cy="210" r="24" fill="#192612" />
              <circle cx="490" cy="175" r="16" fill="#223318" />

              {/* Jungle Bushes / Trees (Outer) */}
              <circle cx="350" cy="45" r="20" fill="#192612" />
              <circle cx="385" cy="35" r="25" fill="#223318" />
              <circle cx="450" cy="45" r="18" fill="#192612" />

              <circle cx="350" cy="355" r="22" fill="#192612" />
              <circle cx="420" cy="360" r="20" fill="#223318" />

              {/* Scattered Pebbles on the dirt path */}
              <circle cx="200" cy="75" r="2" fill="#422f1f" />
              <circle cx="620" cy="320" r="3" fill="#422f1f" />
              <circle cx="380" cy="335" r="2.5" fill="#422f1f" />
              <circle cx="510" cy="85" r="4" fill="#422f1f" />
              <circle cx="230" cy="315" r="2" fill="#422f1f" />
              <circle cx="680" cy="120" r="3" fill="#422f1f" />

              {/* Magical Glowing Waypoints (Instead of dashed highway line) */}
              <rect x="100" y="100" width="600" height="200" rx="100" ry="100" fill="none" stroke="#00ffff" strokeWidth="3" strokeDasharray="5 30" strokeLinecap="round" opacity="0.5" />

              {/* Blue Nexus (Left) */}
              <g transform="translate(60, 200)">
                <circle cx="0" cy="0" r="30" fill="#1a252c" />
                <circle cx="0" cy="0" r="25" fill="#2c3e50" />
                <polygon points="0,-25 15,0 0,25 -15,0" fill="#3498db" />
                <polygon points="0,-25 10,0 0,25 -10,0" fill="#2980b9" />
                <polygon points="0,-25 0,25 -15,0" fill="#85c1e9" opacity="0.6" />
              </g>

              {/* Red Nexus (Right) */}
              <g transform="translate(740, 200)">
                <circle cx="0" cy="0" r="30" fill="#1a252c" />
                <circle cx="0" cy="0" r="25" fill="#2c3e50" />
                <polygon points="0,-25 15,0 0,25 -15,0" fill="#e74c3c" />
                <polygon points="0,-25 10,0 0,25 -10,0" fill="#c0392b" />
                <polygon points="0,-25 0,25 -15,0" fill="#f5b7b1" opacity="0.6" />
              </g>
            </g>
          ) : (
            <g>
              {/* Outer Orange Track */}
              <rect x="50" y="50" width="700" height="300" rx="150" ry="150" fill="#d35400" />
              {/* Inner Field */}
              <rect x="150" y="150" width="500" height="100" rx="50" ry="50" fill="#fff" />
              {/* Dashed Line */}
              <rect x="100" y="100" width="600" height="200" rx="100" ry="100" fill="none" stroke="#fff" strokeWidth="6" strokeDasharray="20 15" />
            </g>
          )}

          {/* Start/Finish Line */}
          <g transform="translate(400, 50)">
            <rect x="-5" y="0" width="10" height="100" fill="#fff" />
            <rect x="-5" y="0" width="5" height="10" fill="#333" />
            <rect x="0" y="10" width="5" height="10" fill="#333" />
            <rect x="-5" y="20" width="5" height="10" fill="#333" />
            <rect x="0" y="30" width="5" height="10" fill="#333" />
            <rect x="-5" y="40" width="5" height="10" fill="#333" />
            <rect x="0" y="50" width="5" height="10" fill="#333" />
            <rect x="-5" y="60" width="5" height="10" fill="#333" />
            <rect x="0" y="70" width="5" height="10" fill="#333" />
            <rect x="-5" y="80" width="5" height="10" fill="#333" />
            <rect x="0" y="90" width="5" height="10" fill="#333" />
          </g>

          {/* Character Runner */}
          <g>
            <g transform={`translate(${getTrackPosition(displayProgress).x}, ${getTrackPosition(displayProgress).y})`}>
              <g transform="translate(-20, -20)">
                {selectedServer.includes('lol') ? (
                  /* TEEMO CHARACTER */
                  <g>
                    {/* Backpack */}
                    <rect x="2" y="22" width="10" height="14" rx="3" fill="#654321" />

                    {/* Ears */}
                    <polygon points="4,10 -4,2 8,4" fill="#f5deb3" />
                    <polygon points="36,10 44,2 32,4" fill="#f5deb3" />

                    {/* Hat Brim */}
                    <ellipse cx="20" cy="5" rx="24" ry="8" fill="#556b2f" />
                    {/* Hat Top */}
                    <rect x="4" y="-2" width="32" height="12" rx="6" fill="#6b8e23" />

                    {/* Hat Fluff (Blue) */}
                    <path d="M 16 -2 Q 10 -15 24 -12 Q 30 -5 24 -2 Z" fill="#0055ff" />

                    {/* Goggles (Red/Orange with Blue Glass) */}
                    <circle cx="12" cy="2" r="5" fill="#87ceeb" stroke="#b22222" strokeWidth="2.5" />
                    <circle cx="28" cy="2" r="5" fill="#87ceeb" stroke="#b22222" strokeWidth="2.5" />
                    <line x1="17" y1="2" x2="23" y2="2" stroke="#b22222" strokeWidth="2.5" />

                    {/* Head / Face */}
                    <rect x="6" y="8" width="28" height="18" rx="8" fill="#f5deb3" />

                    {/* Eyes & Nose */}
                    <circle cx="13" cy="16" r="2" fill="#000" />
                    <circle cx="27" cy="16" r="2" fill="#000" />
                    <circle cx="20" cy="20" r="1.5" fill="#000" />

                    {/* Red Scarf */}
                    <path d="M 6 24 Q 20 28 34 24 L 34 28 Q 20 32 6 28 Z" fill="#dc143c" />
                    <path d="M 10 26 L 4 36 L 14 34 Z" fill="#dc143c" />

                    {/* Body */}
                    <rect x="10" y="26" width="20" height="12" rx="4" fill="#cd853f" />

                    {/* Arms & Blowdart */}
                    <line x1="12" y1="28" x2="2" y2="34" stroke="#cd853f" strokeWidth="4" strokeLinecap="round" />
                    <line x1="28" y1="28" x2="38" y2="34" stroke="#cd853f" strokeWidth="4" strokeLinecap="round" />
                    {/* Blowdart Gun */}
                    <line x1="34" y1="34" x2="50" y2="28" stroke="#556b2f" strokeWidth="3" strokeLinecap="round" />

                    {/* Legs */}
                    <g>
                      <line x1="14" y1="36" x2="14" y2="48" stroke="#8b4513" strokeWidth="4" strokeLinecap="round" />
                      <line x1="12" y1="48" x2="16" y2="48" stroke="#333" strokeWidth="3" strokeLinecap="round" />
                      {isRunning && (
                        <animateTransform attributeName="transform" type="rotate" values="25 14 36; -25 14 36; 25 14 36" dur="0.2s" repeatCount="indefinite" />
                      )}
                    </g>
                    <g>
                      <line x1="26" y1="36" x2="26" y2="48" stroke="#8b4513" strokeWidth="4" strokeLinecap="round" />
                      <line x1="24" y1="48" x2="28" y2="48" stroke="#333" strokeWidth="3" strokeLinecap="round" />
                      {isRunning && (
                        <animateTransform attributeName="transform" type="rotate" values="-25 26 36; 25 26 36; -25 26 36" dur="0.2s" repeatCount="indefinite" />
                      )}
                    </g>
                  </g>
                ) : (
                  /* ORIGINAL BLUE CHARACTER */
                  <g>
                    {/* Body */}
                    <rect x="0" y="0" width="40" height="40" rx="6" fill="#3498db" />
                    {/* Eyes */}
                    <circle cx="12" cy="12" r="4" fill="#fff" />
                    <circle cx="28" cy="12" r="4" fill="#fff" />
                    <circle cx="12" cy="12" r="1.5" fill="#000" />
                    <circle cx="28" cy="12" r="1.5" fill="#000" />
                    {/* Mouth */}
                    <path d="M 12 28 Q 20 35 28 28" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                    {/* Arms */}
                    <line x1="0" y1="20" x2="-12" y2="28" stroke="#3498db" strokeWidth="5" strokeLinecap="round" />
                    <line x1="40" y1="20" x2="52" y2="12" stroke="#3498db" strokeWidth="5" strokeLinecap="round" />
                    {/* Legs */}
                    <g>
                      <line x1="8" y1="40" x2="8" y2="55" stroke="#3498db" strokeWidth="6" strokeLinecap="round" />
                      {isRunning && (
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          values="20 8 40; -20 8 40; 20 8 40"
                          dur="0.2s"
                          repeatCount="indefinite"
                        />
                      )}
                    </g>
                    <g>
                      <line x1="32" y1="40" x2="32" y2="55" stroke="#3498db" strokeWidth="6" strokeLinecap="round" />
                      {isRunning && (
                        <animateTransform
                          attributeName="transform"
                          type="rotate"
                          values="-20 32 40; 20 32 40; -20 32 40"
                          dur="0.2s"
                          repeatCount="indefinite"
                        />
                      )}
                    </g>
                  </g>
                )}
              </g>
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}

export default App;
