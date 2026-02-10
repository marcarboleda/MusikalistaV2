const _supabase = supabase.createClient(
    'https://ucuclytygpclwlsuqpck.supabase.co', 
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVjdWNseXR5Z3BjbHdsc3VxcGNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2NDI5NDUsImV4cCI6MjA4NjIxODk0NX0.qu9LXBWC6VXSYsx5Y-CWxydxHIquA7TkLN2yMA0trTc');

   const NOTES = [
    { name: "C4", freq: 261.63 }, { name: "C#4", freq: 277.18 }, { name: "D4", freq: 293.66 },
    { name: "D#4", freq: 311.13 }, { name: "E4", freq: 329.63 }, { name: "F4", freq: 349.23 },
    { name: "F#4", freq: 369.99 }, { name: "G4", freq: 392.00 }, { name: "G#4", freq: 415.30 },
    { name: "A4", freq: 440.00 }, { name: "A#4", freq: 466.16 }, { name: "B4", freq: 493.88 }, { name: "C5", freq: 523.25 }
];

const game = {
    audioCtx: null, targetSequence: [], playerSequence: [0, 0, 0],
    timeLeft: 30.00, timerInt: null, playerName: "", lastUpdate: 0, memoRunning: false,

    init() { this.updateLeaderboard(); },

    showNamePrompt() { document.getElementById('name-prompt-overlay').style.display = 'flex'; },

    confirmName() {
        const val = document.getElementById('start-player-name').value.trim();
        if(!val) return;
        this.playerName = val;
        document.getElementById('name-prompt-overlay').style.display = 'none';
        this.startMemorization();
    },

    async startMemorization() {
        if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.targetSequence = Array.from({length: 3}, () => Math.floor(Math.random() * NOTES.length));
        
        document.getElementById('menu-screen').classList.remove('active');
        document.getElementById('memorize-screen').classList.add('active');
        this.memoRunning = true;

        await new Promise(r => setTimeout(r, 2000));

        for (let loop = 0; loop < 3; loop++) {
            if (!this.memoRunning) break;
            for (let i = 0; i < 3; i++) {
                if (!this.memoRunning) break;
                this.setDot(i);
                this.playTone(NOTES[this.targetSequence[i]].freq, 0.6);
                await new Promise(r => setTimeout(r, 900));
            }
            this.setDot(-1);
            if (loop < 2 && this.memoRunning) await new Promise(r => setTimeout(r, 2000));
        }
        if (this.memoRunning) this.startCountdown();
    },

    setDot(idx) { document.querySelectorAll('.note-dot-massive').forEach((d, i) => d.classList.toggle('active', i === idx)); },

    startCountdown() {
        this.memoRunning = false;
        document.getElementById('memorize-screen').classList.remove('active');
        const overlay = document.getElementById('countdown-overlay');
        const text = document.getElementById('countdown-text');
        overlay.style.display = 'flex';
        let count = 3;
        text.innerText = count;
        const cd = setInterval(() => {
            count--;
            if (count > 0) text.innerText = count;
            else if (count === 0) text.innerText = "START!";
            else { clearInterval(cd); overlay.style.display = 'none'; this.startGame(); }
        }, 1000);
    },

    startGame() {
        document.getElementById('game-screen').classList.add('active');
        this.playerSequence = [0, 0, 0];
        this.updateCards();
        this.timeLeft = 30.00;
        this.lastUpdate = Date.now();
        if(this.timerInt) clearInterval(this.timerInt);
        this.timerInt = setInterval(() => {
            const delta = (Date.now() - this.lastUpdate) / 1000;
            this.lastUpdate = Date.now();
            this.timeLeft -= delta;
            document.getElementById('countdown').innerText = Math.ceil(Math.max(0, this.timeLeft));
            if (this.timeLeft <= 0) this.gameOver();
        }, 50);
    },

    adjust(slot, amt) {
        this.playerSequence[slot] = Math.min(NOTES.length - 1, Math.max(0, this.playerSequence[slot] + amt));
        this.updateCards();
        this.playTone(NOTES[this.playerSequence[slot]].freq, 0.4);
    },

    updateCards() {
        this.playerSequence.forEach((idx, i) => {
            document.getElementById(`note-${i}-name`).innerText = NOTES[idx].name;
        });
    },

    async checkSequence() {
        const isWin = this.playerSequence.every((v, i) => v === this.targetSequence[i]);
        if (isWin) {
            clearInterval(this.timerInt);
            const score = (30 - this.timeLeft).toFixed(2);
            await _supabase.from('sequence_leaderboard').insert([{ name: this.playerName, score: parseFloat(score) }]);
            this.showResultModal("MATCH!", score, true);
        } else {
            this.timeLeft -= 1.5;
            this.triggerPenalty();
        }
    },

    triggerPenalty() {
        const screen = document.getElementById('game-screen');
        screen.classList.add('shake');
        setTimeout(() => screen.classList.remove('shake'), 400);
        this.playTone(100, 0.2);
        const btn = document.getElementById('match-trigger');
        btn.innerText = "WRONG!"; btn.style.background = "var(--sonic-red)";
        setTimeout(() => { btn.innerText = "MATCH SEQUENCE"; btn.style.background = "var(--sonic-yellow)"; }, 800);
    },

    playTone(f, dur) {
        if (!this.audioCtx) return;
        const o = this.audioCtx.createOscillator();
        const g = this.audioCtx.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        g.gain.setValueAtTime(0.5, this.audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + dur);
        o.connect(g); g.connect(this.audioCtx.destination);
        o.start(); o.stop(this.audioCtx.currentTime + dur);
    },

    playNote(slot) { this.playTone(NOTES[this.playerSequence[slot]].freq, 0.6); },
    gameOver() { clearInterval(this.timerInt); this.showResultModal("GAME OVER", "TRY AGAIN", false); },

    showResultModal(title, val, isWin) {
        const modal = document.getElementById('overlay-layer');
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-msg-value').innerText = val;
        const box = document.querySelector('.hero-box');
        if(isWin) {
            box.classList.remove('fail-state');
            document.getElementById('modal-msg-unit').style.display = "inline";
        } else {
            box.classList.add('fail-state');
            document.getElementById('modal-msg-unit').style.display = "none";
        }
        modal.style.display = 'flex';
    },

    backToMenu() { location.reload(); },
    exit() { location.reload(); },

    async updateLeaderboard() {
        try {
            const { data } = await _supabase.from('sequence_leaderboard').select('name, score').order('score', { ascending: true }).limit(3);
            if (data) {
                let html = "";
                data.forEach((e, i) => {
                    html += `<div class="rank-item" style="font-family: 'Luckiest Guy'; font-size: 1.8rem; display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.1);"><span>#${i+1} ${e.name}</span><span>${e.score.toFixed(2)}s</span></div>`;
                });
                document.getElementById('menu-best').innerHTML = html || "NO SCORES YET";
            }
        } catch(e) { console.log(e); }
    }
};

window.onload = () => game.init();