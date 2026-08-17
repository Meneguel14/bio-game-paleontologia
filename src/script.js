if (typeof window.electronAPI === 'undefined') {
    window.electronAPI = { savePlayer: () => {}, saveGameResult: () => {} };
}

class ExplorerGame {
    constructor() {
        this.gameStarted = false;
        this.gameEnded = false;
        this.startTime = null;
        this.score = 1000;
        this.attempts = 0;
        this.timerInterval = null;
        this.timePenaltyInterval = null;
        this.hintCount = 0;
        this.foundTargets = new Set();
        this.correctAttempts = 0;
        this.wrongAttempts = 0;
        this.timeLeft = 120;
        this.playerData = { nome: 'Explorador', idade: '-', escola: '-', etapa: '-' };
        this.leaderboardKey = 'fosseis_leaderboard_v1';
        this.leaderboard = this.loadLeaderboard();

        this.allTargets = [
            { id: 'target1',  name: 'Crânio de Dente-de-Sabre',          x: 8.0,  y: 20.0, width: 12.0, height: 12.0 },
            { id: 'target2',  name: 'Crânio de Crocodilo',                x: 38.0, y: 17.0, width: 12.0, height: 7.0  },
            { id: 'target3',  name: 'Pegada de Dinossauro',               x: 58.0, y: 15.0, width: 8.2,  height: 8.0  },
            { id: 'target4',  name: 'Pegada Erodida',                     x: 77.0, y: 45.0, width: 10.0, height: 15.0 },
            { id: 'target5',  name: 'Fêmur de Titanossauro',              x: 60.0, y: 38.0, width: 15.0, height: 13.0 },
            { id: 'target6',  name: 'Costela de Tricerátops',             x: 46.5, y: 33.0, width: 9.0,  height: 15.0 },
            { id: 'target7',  name: 'Peixe Fossilizado',                  x: 5.0,  y: 70.0, width: 12.0, height: 5.0  },
            { id: 'target8',  name: 'Casco Rachado',                      x: 38.0, y: 54.0, width: 7.0,  height: 7.0  },
            { id: 'target9',  name: 'Moldagem na Rocha',                  x: 78.0, y: 20.0, width: 10.0, height: 5.0  },
            { id: 'target10', name: 'Garra de Dinossauro Carnívoro',      x: 40.5, y: 80.0, width: 6.2,  height: 10.5 },
            { id: 'target11', name: 'Dente de Irritator',                 x: 20.0, y: 42.0, width: 5.0,  height: 6.0  },
            { id: 'target12', name: 'Ovo Fossilizado',                    x: 49.6, y: 65.5, width: 6.8,  height: 7.0  },
            { id: 'target13', name: 'Tronco Fossilizado',                 x: 66.0, y: 68.5, width: 15.0, height: 10.0 },
            { id: 'target14', name: 'Vértebra de Cobra Pré-histórica',    x: 86.0, y: 85.0, width: 8.0,  height: 8.0  },
            { id: 'target15', name: 'Folha Fossilizada',                  x: 73.5, y: 86.5, width: 5.0,  height: 4.5  }
        ];

        this.initElements();
        this.initRegistrationForm();
        this.initGameEvents();
        this.initLeaderboardUI();
        this.renderLeaderboard();
    }

    _el(id) { return document.getElementById(id); }

    _fmtTime(totalSeconds) {
        const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const s = String(totalSeconds % 60).padStart(2, '0');
        return `${m}:${s}`;
    }

    _resetTargetStates() {
        this.allTargets.forEach(({ id }) => {
            const el = this._el(`dom-${id}`);
            if (el) el.className = 'target-area target-state-hidden';
        });
    }

    loadLeaderboard() {
        try { return JSON.parse(localStorage.getItem(this.leaderboardKey)) || []; }
        catch { return []; }
    }

    saveLeaderboardToStorage() {
        localStorage.setItem(this.leaderboardKey, JSON.stringify(this.leaderboard));
    }

    initElements() {
        this.container  = this._el('gameContainer');
        this.timerEl    = this._el('timer');
        this.scoreEl    = this._el('score');
        this.attemptsEl = this._el('attempts');
        this.startBtn   = this._el('startBtn');
        this.hintBtn    = this._el('hintBtn');
        this.resetBtn   = this._el('resetBtn');

        this.container.innerHTML = '';

        this.imageWrapper = Object.assign(document.createElement('div'), { className: 'image-wrapper' });
        this.bgImg        = Object.assign(document.createElement('img'),  { src: '../public/escavacao.png', className: 'game-image', alt: 'Cena de escavação paleontológica' });
        this.clickOverlay = Object.assign(document.createElement('div'), { className: 'click-overlay' });

        this.imageWrapper.append(this.bgImg, this.clickOverlay);
        this.container.appendChild(this.imageWrapper);

        const loading = this._el('loading');
        if (loading) loading.style.display = 'none';

        this.createTargetElements();
        this.setupDebugMode();
    }

    createTargetElements() {
        this.allTargets.forEach(target => {
            const el = Object.assign(document.createElement('div'), {
                className: `target-area target-state-hidden${this.debugMode ? ' debug-target' : ''}`,
                id: `dom-${target.id}`
            });
            Object.assign(el.style, { left: `${target.x}%`, top: `${target.y}%`, width: `${target.width}%`, height: `${target.height}%` });
            el.addEventListener('click', e => { e.stopPropagation(); this.handleTargetClick(target, el); });
            this.clickOverlay.appendChild(el);
        });
    }

    setupDebugMode() {
        this.debugMode = false;
        if (!this.debugMode) return;

        document.querySelectorAll('.target-area').forEach(t => t.classList.add('debug-target'));
        this.clickOverlay.addEventListener('click', e => {
            const rect = this.clickOverlay.getBoundingClientRect();
            const percentX = (((e.clientX - rect.left) / rect.width)  * 100).toFixed(2);
            const percentY = (((e.clientY - rect.top)  / rect.height) * 100).toFixed(2);
            console.log(`%c[DEBUG] Fóssil: x: ${percentX}%, y: ${percentY}%`, 'background: #222; color: #bada55; font-size: 16px; padding: 4px;');
            this.showDebugTooltip(e.clientX, e.clientY, `${percentX}%, ${percentY}%`);
        });
    }

    showDebugTooltip(clientX, clientY, text) {
        let tooltip = this._el('debugTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'debugTooltip';
            Object.assign(tooltip.style, {
                position: 'fixed', background: 'rgba(255, 0, 0, 0.9)', color: '#fff',
                padding: '6px 12px', borderRadius: '4px', pointerEvents: 'none',
                zIndex: '9999', fontWeight: 'bold', fontSize: '14px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            });
            document.body.appendChild(tooltip);
        }
        tooltip.textContent = `Copie: ${text}`;
        Object.assign(tooltip.style, { left: `${clientX + 15}px`, top: `${clientY + 15}px`, display: 'block' });

        if (this.tooltipTimeout) clearTimeout(this.tooltipTimeout);
        this.tooltipTimeout = setTimeout(() => { tooltip.style.display = 'none'; }, 3500);
    }

    initRegistrationForm() {
        const form    = this._el('registrationForm');
        const overlay = this._el('registerOverlay');
        const errorDiv = this._el('registerError');
        if (!form || !overlay) { console.error('Elementos do formulário de cadastro não encontrados!'); return; }

        const fields = [
            ['name',        'Por favor, informe o seu nome.'],
            ['age',         'Por favor, informe a sua idade.'],
            ['school',      'Por favor, informe a instituição de ensino.'],
            ['schoolStage', 'Por favor, selecione a etapa escolar.']
        ];

        form.addEventListener('submit', e => {
            e.preventDefault();
            const [nome, idade, escola, etapa] = fields.map(([id]) => this._el(id).value.trim());
            const values = [nome, idade, escola, etapa];

            for (const [i, [id, msg]] of fields.entries()) {
                if (!values[i]) { this._showFormError(errorDiv, msg); this._el(id).focus(); return; }
            }

            this.playerData = { nome, idade, escola, etapa };
            this._saveRegistrationCSV(this.playerData);
            overlay.style.display = 'none';
            this.startBtn.disabled = false;
            errorDiv.style.display = 'none';
        });
    }

    _showFormError(container, message) {
        if (!container) return;
        container.textContent = message;
        container.style.display = 'block';
    }

    _saveRegistrationCSV(data) {
        try { window.electronAPI?.savePlayer?.(data); }
        catch (err) { console.warn('electronAPI não disponível (modo navegador):', err); }
    }

    initGameEvents() {
        this.startBtn.addEventListener('click', () => this.startGame());
        this.hintBtn.addEventListener('click',  () => this.useHint());
        this.resetBtn.addEventListener('click', () => this.resetGame());
        this.clickOverlay.addEventListener('click', () => this.handleMiss());

        const playAgainBtn = this._el('playAgainBtn');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                this._el('gameOver').style.display = 'none';
                this.resetGame();
            });
        }
    }

    startGame() {
        if (this.gameStarted) return;

        Object.assign(this, {
            gameStarted: true, gameEnded: false, startTime: Date.now(),
            score: 1000, attempts: 0, correctAttempts: 0, wrongAttempts: 0, hintCount: 0
        });
        this.foundTargets.clear();

        this.scoreEl.textContent    = this.score;
        this.attemptsEl.textContent = this.attempts;
        this.hintBtn.disabled       = false;
        this.hintBtn.textContent    = '💡 Dica (0/3)';

        this.startTimer();
        this._resetTargetStates();

        clearInterval(this.timePenaltyInterval);
        this.timePenaltyInterval = setInterval(() => {
            if (this.gameStarted && !this.gameEnded) {
                this.score = Math.max(0, this.score - 5);
                this.scoreEl.textContent = this.score;
            }
        }, 2000);

        this.startBtn.disabled = true;
    }

    updateTimer() {
        if (!this.startTime) return;
        this.timerEl.textContent = this._fmtTime(Math.floor((Date.now() - this.startTime) / 1000));
    }

    handleTargetClick(target, element) {
        if (!this.gameStarted || this.gameEnded || this.foundTargets.has(target.id)) return;

        this.foundTargets.add(target.id);
        this.attemptsEl.textContent = ++this.attempts;
        this.correctAttempts++;
        element.className = 'target-area target-state-found';
        this.scoreEl.textContent = (this.score += 200);

        this.showFossilToast(target);
        if (this.foundTargets.size === this.allTargets.length) setTimeout(() => this.endGame(true), 600);
    }

    handleMiss() {
        if (!this.gameStarted || this.gameEnded) return;
        this.attemptsEl.textContent = ++this.attempts;
        this.wrongAttempts++;
        this.scoreEl.textContent = (this.score = Math.max(0, this.score - 50));
    }

    useHint() {
        if (!this.gameStarted || this.gameEnded || this.hintCount >= 3) return;

        const remaining = this.allTargets.filter(t => !this.foundTargets.has(t.id));
        if (!remaining.length) return;

        const el = this._el(`dom-${remaining[Math.floor(Math.random() * remaining.length)].id}`);
        if (el) {
            el.classList.add('target-state-hint');
            setTimeout(() => el.classList.remove('target-state-hint'), 4000);
        }

        this.hintBtn.textContent = `💡 Dica (${++this.hintCount}/3)`;
        if (this.hintCount >= 3) this.hintBtn.disabled = true;
    }

    showFossilToast(target) {
        const container = this._el('toastContainer');
        if (!container) return;

        const toast = Object.assign(document.createElement('div'), {
            className: 'toast',
            innerHTML: `
                <div class="toast-icon">&#x1F9B4;</div>
                <div class="toast-content">
                    <div class="toast-title">Fóssil Encontrado!</div>
                    <div class="toast-name">${target.name}</div>
                    <div class="toast-progress">${this.foundTargets.size} de ${this.allTargets.length} fósseis encontrados</div>
                </div>`
        });

        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.add('removing');
                setTimeout(() => toast.parentNode && toast.remove(), 400);
            }
        }, 4000);
    }

    startTimer() {
        this.timeLeft = 120;
        this.timerEl.textContent = '02:00';
        this.timerEl.style.color = 'var(--paleo-text-dark)';

        this.timerInterval = setInterval(() => {
            this.timerEl.textContent = this._fmtTime(--this.timeLeft);
            this.timerEl.style.color = this.timeLeft <= 10 ? '#D32F2F' : 'var(--paleo-text-dark)';
            if (this.timeLeft <= 0) { clearInterval(this.timerInterval); this.endGame(false); }
        }, 1000);
    }

    endGame(playerWon = true) {
        this.gameEnded = true;
        clearInterval(this.timerInterval);
        clearInterval(this.timePenaltyInterval);

        const finalTime = this._fmtTime(Math.floor((Date.now() - this.startTime) / 1000));
        this.saveScore(this.score, finalTime);

        try {
            window.electronAPI?.saveGameResult?.({
                ...this.playerData,
                dataHora: new Date().toLocaleString('pt-BR'),
                pontuacao: this.score,
                tempo: finalTime
            });
        } catch (err) { console.warn('Falha ao gravar resultado no CSV:', err); }

        const title    = this._el('gameOverTitle');
        const subtitle = this._el('gameOverSubtitle');
        const stats    = this._el('finalStats');

        if (title)    title.textContent    = playerWon ? '🎉 Escavação Concluída!' : '⏰ Tempo Esgotado!';
        if (subtitle) subtitle.textContent = playerWon
            ? 'Você encontrou todos os fósseis!'
            : `Você encontrou ${this.foundTargets.size} de ${this.allTargets.length} fósseis.`;

        if (stats) stats.innerHTML = `
            <p>👤 Explorador: <strong>${this.playerData.nome}</strong></p>
            <p>🦴 Fósseis: <strong>${this.foundTargets.size} / ${this.allTargets.length}</strong></p>
            <p>🎖 Pontuação Final: <strong>${this.score}</strong></p>
            <p>⏱ Tempo utilizado: <strong>${finalTime}</strong></p>
            <p>🎯 Acertos: <strong>${this.correctAttempts}</strong> | Erros: <strong>${this.wrongAttempts}</strong></p>`;

        const gameOver = this._el('gameOver');
        if (gameOver) gameOver.style.display = 'flex';
        this.startBtn.disabled = false;

        if (this.autoResetTimeout) clearTimeout(this.autoResetTimeout);
        this.autoResetTimeout = setTimeout(() => this.resetGame(), 8000);
    }

    saveScore(score, timeStr) {
        this.leaderboard.push({ ...this.playerData, pontos: score, tempo: timeStr, data: new Date().toLocaleString('pt-BR') });
        this.leaderboard = this.leaderboard.sort((a, b) => b.pontos - a.pontos).slice(0, 10);
        this.saveLeaderboardToStorage();
        this.renderLeaderboard();
    }

    initLeaderboardUI() {
        const modal = this._el('leaderboardModal');
        const btn   = this._el('leaderboardBtn');
        const close = this._el('closeLeaderboardBtn');
        if (btn   && modal) btn.addEventListener('click',   () => { modal.style.display = 'flex'; });
        if (close && modal) close.addEventListener('click', () => { modal.style.display = 'none'; });
    }

    renderLeaderboard() {
        const tbody    = document.querySelector('#leaderboardTable tbody');
        const emptyMsg = this._el('leaderboardEmpty');
        if (!tbody) return;

        const isEmpty = this.leaderboard.length === 0;
        if (emptyMsg) emptyMsg.style.display = isEmpty ? 'block' : 'none';
        tbody.innerHTML = this.leaderboard.map((entry, i) =>
            `<tr><td>${i + 1}º</td><td>${entry.nome}</td><td>${entry.pontos}</td><td>${entry.tempo}</td></tr>`
        ).join('');
    }

    resetGame() {
        clearInterval(this.timerInterval);
        clearInterval(this.timePenaltyInterval);

        Object.assign(this, {
            gameStarted: false, gameEnded: false, startTime: null,
            score: 1000, attempts: 0, correctAttempts: 0, wrongAttempts: 0, hintCount: 0,
            playerData: { nome: 'Explorador', idade: '-', escola: '-', etapa: '-' }
        });
        this.foundTargets.clear();

        const form = this._el('registrationForm');
        if (form) form.reset();

        this.timerEl.textContent    = '02:00';
        this.timerEl.style.color    = 'var(--paleo-text-dark)';
        this.timeLeft               = 120;
        this.scoreEl.textContent    = '0';
        this.attemptsEl.textContent = '0';
        this.startBtn.disabled      = false;
        this.hintBtn.disabled       = true;
        this.hintBtn.textContent    = '💡 Dica (0/3)';

        this._resetTargetStates();

        const toastContainer  = this._el('toastContainer');
        const gameOver        = this._el('gameOver');
        const registerOverlay = this._el('registerOverlay');
        if (toastContainer)  toastContainer.innerHTML      = '';
        if (gameOver)        gameOver.style.display        = 'none';
        if (registerOverlay) registerOverlay.style.display = 'flex';

        if (this.autoResetTimeout) { clearTimeout(this.autoResetTimeout); this.autoResetTimeout = null; }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new ExplorerGame();

    fetch('DicSchool.json')
        .then(r => { if (!r.ok) throw new Error('Arquivo não encontrado'); return r.json(); })
        .then(data => {
            const schoolList = document.getElementById('schoolList');
            if (schoolList && Array.isArray(data)) {
                data.forEach(item => {
                    schoolList.appendChild(Object.assign(document.createElement('option'), { value: item.nome || item }));
                });
            }
        })
        .catch(() => {});
});
