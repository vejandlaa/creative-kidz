/* --- CONFIG DATA --- */
const AVATAR_DATA = {
    green: { html: `<div class="mon-green"></div>`, cost: 0, name: "Slimey" },
    blue: { html: `<div class="mon-blue"><div class="eye l"></div><div class="eye r"></div></div>`, cost: 0, name: "Derpy" },
    orange: { html: `<div class="mon-orange"></div>`, cost: 50, name: "Cyclops" },
    purple: { html: `<div class="mon-purple"><div class="eye l"></div><div class="eye r"></div></div>`, cost: 50, name: "Spikey" },
    pink: { html: `<div class="mon-pink"><div class="eye l"></div><div class="eye r"></div></div>`, cost: 100, name: "Piggy" },
    red: { html: `<div class="mon-red"><div class="eye l"></div><div class="eye r"></div></div>`, cost: 150, name: "Boxy" }
};

/* --- GAME STATE --- */
const game = {
    mode: 'pvc',
    starter: 'p1',
    turn: 'p1',
    active: true,
    board: Array(9).fill(''),
    scores: { p1: 0, p2: 0 },
    coins: { p1: 0, p2: 0 }, // Separate wallets
    toys: { p1: {}, p2: {} },
    inventory: ['green', 'blue'], // Unlocked avatars
    p1Avatar: 'green',
    p2Avatar: 'blue',
    p1Custom: null,
    p2Custom: null,

    init: function() {
        // Load from local storage if available
        const saved = localStorage.getItem('monsterToeData');
        if (saved) {
            const data = JSON.parse(saved);
            this.coins.p1 = data.coins || 0;
            this.inventory = data.inventory || ['green', 'blue'];
        }

        if(this.p1Avatar === this.p2Avatar) this.randomizeBot();
        ui.renderSelectors();
        ui.renderBoard();
        ui.updateShelves();
        ui.updateCoins();
    },

    save: function() {
        localStorage.setItem('monsterToeData', JSON.stringify({
            coins: this.coins.p1,
            inventory: this.inventory
        }));
    },

    setMode: function(m) {
        this.mode = m;
        document.getElementById('mode-pvc').className = m === 'pvc' ? 'btn-toggle active' : 'btn-toggle';
        document.getElementById('mode-pvp').className = m === 'pvp' ? 'btn-toggle active' : 'btn-toggle';
        document.getElementById('p2-label').innerText = m === 'pvc' ? "Computer" : "Player 2";

        const p2Paint = document.getElementById('p2-paint-btn');
        if(m === 'pvc') p2Paint.classList.add('hidden');
        else p2Paint.classList.remove('hidden');

        if(m === 'pvc') {
            if(this.p1Avatar === this.p2Avatar) this.randomizeBot();
        }

        ui.renderSelectors();
        this.reset();
    },

    setStarter: function(p) {
        this.starter = p;
        document.querySelectorAll('#start-p1, #start-p2').forEach(b => b.classList.remove('active'));
        document.getElementById(`start-${p}`).classList.add('active');
        this.reset();
    },

    setAvatar: function(player, type) {
        if(this.mode === 'pvc' && player === 'p2') return;

        // Check if unlocked
        if(!this.inventory.includes(type)) {
            if(player === 'p1') shop.open(); // Prompt to buy
            return;
        }

        if(player === 'p1') {
            this.p1Avatar = type;
            this.p1Custom = null;
            if(this.mode === 'pvc' && this.p2Avatar === type) this.randomizeBot();
        } else {
            this.p2Avatar = type;
            this.p2Custom = null;
        }
        ui.renderSelectors();
        ui.renderBoard();
    },

    randomizeBot: function() {
        const keys = Object.keys(AVATAR_DATA);
        // Bot can use ANY avatar, even locked ones (it cheats!)
        const available = keys.filter(k => k !== this.p1Avatar);
        this.p2Avatar = available[Math.floor(Math.random() * available.length)];
        this.p2Custom = null;
    },

    reset: function() {
        this.board.fill('');
        this.active = true;
        this.turn = this.starter;
        ui.renderBoard();
        ui.updateStatus();
        if(this.mode === 'pvc' && this.turn === 'p2') setTimeout(() => ai.move(), 600);
    },

    clickCell: function(i) {
        if(!this.active || this.board[i]) return;
        if(this.mode === 'pvc' && this.turn === 'p2') return;
        this.executeMove(i);
    },

    executeMove: function(i) {
        this.board[i] = this.turn;
        ui.renderBoard();

        if(this.checkWin()) { this.endGame(this.turn); return; }
        if(!this.board.includes('')) { this.endGame('draw'); return; }

        this.turn = this.turn === 'p1' ? 'p2' : 'p1';
        ui.updateStatus();

        if(this.mode === 'pvc' && this.turn === 'p2') setTimeout(() => ai.move(), 600);
    },

    checkWin: function() {
        const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        return wins.some(w => this.board[w[0]] === this.turn && this.board[w[1]] === this.turn && this.board[w[2]] === this.turn);
    },

    endGame: function(winner) {
        this.active = false;
        const txt = document.getElementById('status-text');

        if(winner === 'draw') {
            txt.innerText = "Draw!";
            ui.triggerRain(null);
        } else {
            txt.innerText = (winner === 'p1' ? "P1" : "P2") + " Wins!";
            this.scores[winner]++;
            document.getElementById(`score-${winner}`).innerText = this.scores[winner];

            // --- COIN LOGIC ---
            // P1 earns coins if they win. P2 earns coins if they win.
            // In PvC, P2 earning coins doesn't matter much, but we show it.
            this.coins[winner] += 10;
            this.save();

            // Visuals
            const cells = document.getElementById('board').children;
            let centerIndex = 4; // default center
            // Find a winning cell to spawn coin from
            for(let i=0; i<9; i++) { if(this.board[i] === winner) { centerIndex = i; break; } }

            const originCell = cells[centerIndex];
            const targetBank = document.getElementById(`bank-${winner}`);

            ui.flyCoin(originCell, targetBank, () => {
                ui.updateCoins(winner);
            });

            // --- TOY LOGIC ---
            const toysList = ['🧸','🦖','🦄','🤖','🦆','🏎️','🚀','🍕'];
            const prize = toysList[Math.floor(Math.random() * toysList.length)];

            if(!this.toys[winner][prize]) this.toys[winner][prize] = 0;
            this.toys[winner][prize]++;
            ui.updateShelves();

            ui.triggerWin(winner, prize);
        }
    }
};

/* --- UI RENDERER --- */
const ui = {
    renderSelectors: function() {
        ['p1', 'p2'].forEach(p => {
            const el = document.getElementById(`${p}-grid`);
            el.innerHTML = '';
            const isLocked = (p === 'p2' && game.mode === 'pvc');

            Object.keys(AVATAR_DATA).forEach(key => {
                const div = document.createElement('div');
                const isOwned = game.inventory.includes(key);
                // Bot ignores ownership logic for visuals, but human sees locks
                const showLock = (p === 'p1' && !isOwned);

                let classes = 'mini-avatar';
                if(game[`${p}Avatar`] === key && !game[`${p}Custom`]) classes += ' active';
                if(isLocked || showLock) classes += ' locked';

                div.className = classes;
                div.innerHTML = `<div class="avatar-wrapper" style="transform:scale(0.6)">${AVATAR_DATA[key].html}</div>`;

                if(!isLocked) div.onclick = () => game.setAvatar(p, key);

                el.appendChild(div);
            });

            if(game[`${p}Custom`]) {
                const div = document.createElement('div');
                div.className = 'mini-avatar active';
                div.innerHTML = '🎨';
                el.appendChild(div);
            }
        });
    },

    renderBoard: function() {
        const el = document.getElementById('board');
        el.innerHTML = '';
        game.board.forEach((val, i) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.onclick = () => game.clickCell(i);
            if(val) {
                let html = '';
                if(game[`${val}Custom`]) html = `<img src="${game[`${val}Custom`]}" class="custom-img">`;
                else html = AVATAR_DATA[game[`${val}Avatar`]].html;
                cell.innerHTML = `<div class="avatar-wrapper">${html}</div>`;
            }
            el.appendChild(cell);
        });
    },

    updateStatus: function() {
        const txt = document.getElementById('status-text');
        if(!game.active) return;
        const name = game.turn === 'p1' ? "P1 Turn" : (game.mode === 'pvc' ? "Bot Turn" : "P2 Turn");
        txt.innerText = name;
        txt.style.color = game.turn === 'p1' ? '#e57373' : '#64b5f6';
    },

    updateCoins: function(player) {
        document.getElementById('coin-p1').innerText = game.coins.p1;
        document.getElementById('coin-p2').innerText = game.coins.p2;

        if(player) {
            const bank = document.getElementById(`bank-${player}`);
            bank.classList.remove('coin-pulse');
            void bank.offsetWidth;
            bank.classList.add('coin-pulse');
        }
    },

    flyCoin: function(startEl, endEl, callback) {
        const coin = document.createElement('div');
        coin.className = 'flying-coin';
        coin.innerText = '💰';
        document.body.appendChild(coin);

        const startRect = startEl.getBoundingClientRect();
        const endRect = endEl.getBoundingClientRect();

        coin.style.top = (startRect.top + startRect.height/2) + 'px';
        coin.style.left = (startRect.left + startRect.width/2) + 'px';

        // Trigger animation next frame
        requestAnimationFrame(() => {
            coin.style.top = (endRect.top + 10) + 'px';
            coin.style.left = (endRect.left + 10) + 'px';
            coin.style.opacity = 0;
        });

        setTimeout(() => {
            coin.remove();
            if(callback) callback();
        }, 800);
    },

    updateShelves: function() {
        ['p1', 'p2'].forEach(p => {
            const el = document.getElementById(`shelf-${p}`);
            el.innerHTML = '';
            for(let t in game.toys[p]) {
                const d = document.createElement('div');
                d.className = 'mini-toy';
                d.innerHTML = `${t}<div class="mini-toy-count">${game.toys[p][t]}</div>`;
                el.appendChild(d);
            }
        });
    },

    triggerWin: function(winner, prize) {
        const cells = document.getElementById('board').children;
        game.board.forEach((val, i) => {
            if(val === winner) {
                const w = cells[i].querySelector('.avatar-wrapper');
                if(w) w.classList.add('winner-anim');
                const p = document.createElement('div');
                p.className = 'prize-drop'; p.innerText = prize;
                cells[i].appendChild(p);
            } else if(val) {
                this.addRain(cells[i]);
            }
        });
    },

    triggerRain: function(target) {
        const cells = document.getElementById('board').children;
        game.board.forEach((val, i) => {
            if(val) this.addRain(cells[i]);
        });
    },

    addRain: function(cell) {
        const w = cell.querySelector('.avatar-wrapper');
        if(w) w.classList.add('sinking-anim');
        const c = document.createElement('div'); c.className = 'rain-cloud'; c.innerText = '🌧️';
        cell.appendChild(c);
        for(let k=0; k<3; k++){
            const d = document.createElement('div'); d.className='rain-drop';
            d.style.left = (20+k*30)+'%'; d.style.animationDelay=(k*0.2)+'s';
            cell.appendChild(d);
        }
    }
};

/* --- SHOP --- */
const shop = {
    open: function() {
        document.getElementById('shop-balance').innerText = game.coins.p1;
        const grid = document.getElementById('shop-grid');
        grid.innerHTML = '';

        Object.keys(AVATAR_DATA).forEach(key => {
            if(AVATAR_DATA[key].cost === 0) return; // Skip free items

            const item = AVATAR_DATA[key];
            const isOwned = game.inventory.includes(key);

            const card = document.createElement('div');
            card.className = `shop-item ${isOwned ? 'owned' : ''}`;

            card.innerHTML = `
                <div class="shop-preview" style="transform:scale(0.8)">
                    <div class="avatar-wrapper">${item.html}</div>
                </div>
                <div class="shop-cost">${isOwned ? 'Owned' : '💰 ' + item.cost}</div>
                <button class="btn-buy" ${isOwned ? 'disabled' : ''} onclick="shop.buy('${key}')">
                    ${isOwned ? 'Equip' : 'Buy'}
                </button>
            `;
            grid.appendChild(card);
        });

        document.getElementById('shop-overlay').classList.remove('hidden');
    },

    buy: function(key) {
        if(game.inventory.includes(key)) {
            // Equip logic
            game.setAvatar('p1', key);
            this.close();
            return;
        }

        const cost = AVATAR_DATA[key].cost;
        if(game.coins.p1 >= cost) {
            game.coins.p1 -= cost;
            game.inventory.push(key);
            game.save();
            game.setAvatar('p1', key); // Auto equip
            this.close();
        } else {
            alert("Not enough coins! Win more games.");
        }
    },

    unlockAll: function() {
        // Simulated Purchase
        if(confirm("Simulate paying $0.99 to unlock everything?")) {
            game.inventory = Object.keys(AVATAR_DATA);
            game.coins.p1 += 500; // Bonus coins
            game.save();
            this.open(); // Refresh UI
        }
    },

    close: function() {
        document.getElementById('shop-overlay').classList.add('hidden');
        ui.renderSelectors(); // Update locks on main screen
        ui.updateCoins();
    }
};

/* --- AI & PAINTING (Standard) --- */
const ai = {
    move: function() {
        const empty = game.board.map((v, i) => v === '' ? i : null).filter(v => v !== null);
        if(empty.length === 0) return;
        let move = this.findWin('p2') || this.findWin('p1') || empty[Math.floor(Math.random() * empty.length)];
        game.executeMove(move);
    },
    findWin: function(player) {
        const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
        for(let w of wins) {
            const [a,b,c] = w;
            const l = [game.board[a], game.board[b], game.board[c]];
            if(l.filter(x => x === player).length === 2 && l.includes('')) {
                if(game.board[a] === '') return a;
                if(game.board[b] === '') return b;
                if(game.board[c] === '') return c;
            }
        }
        return null;
    }
};

const painter = {
    target: 'p1',
    canvas: document.getElementById('canvas'),
    ctx: document.getElementById('canvas').getContext('2d'),
    color: 'black',
    isDrawing: false,
    open: function(p) { this.target = p; document.getElementById('draw-overlay').classList.remove('hidden'); this.clear(); },
    close: function() { document.getElementById('draw-overlay').classList.add('hidden'); },
    clear: function() { this.ctx.clearRect(0,0,280,280); },
    setColor: function(c, el) { this.color = c; document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active')); el.classList.add('active'); },
    save: function() { game[`${this.target}Custom`] = this.canvas.toDataURL(); ui.renderSelectors(); game.reset(); this.close(); },
    init: function() {
        const c = this.canvas;
        c.addEventListener('mousedown', e => this.start(e.offsetX, e.offsetY));
        c.addEventListener('mousemove', e => this.move(e.offsetX, e.offsetY));
        c.addEventListener('mouseup', () => this.stop());
        c.addEventListener('touchstart', e => { e.preventDefault(); const r = c.getBoundingClientRect(); this.start(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); });
        c.addEventListener('touchmove', e => { e.preventDefault(); const r = c.getBoundingClientRect(); this.move(e.touches[0].clientX - r.left, e.touches[0].clientY - r.top); });
        c.addEventListener('touchend', () => this.stop());
    },
    start: function(x, y) { this.isDrawing = true; this.ctx.beginPath(); this.ctx.moveTo(x, y); this.ctx.lineWidth = 8; this.ctx.lineCap = 'round'; this.ctx.strokeStyle = this.color; },
    move: function(x, y) { if(this.isDrawing) { this.ctx.lineTo(x, y); this.ctx.stroke(); } },
    stop: function() { this.isDrawing = false; this.ctx.beginPath(); }
};

window.addEventListener('DOMContentLoaded', () => { painter.init(); game.init(); });