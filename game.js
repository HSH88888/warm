
// ═══ CONFIG ═══
const WORLD_SIZE = 2000;
const VIEWPORT_SCALE = 1.0;
const BASE_SPEED = 3;
const BOOST_SPEED = 6;
const TURN_SPEED = 0.08;
const FOOD_COUNT = 300;
const MOB_COUNT = 10;

// ═══ UTILS ═══
const rand = (min, max) => Math.random() * (max - min) + min;
const randInt = (min, max) => Math.floor(rand(min, max));
const dist = (x1, y1, x2, y2) => Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
const lerp = (start, end, amt) => (1 - amt) * start + amt * end;

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resize();

        this.player = null;
        this.worms = [];
        this.foods = [];
        this.mobs = [];

        this.camera = { x: 0, y: 0, zoom: 1 };
        this.mouse = { x: 0, y: 0, down: false };

        // Joystick State
        this.joystick = {
            active: false,
            angle: 0,
            baseX: 0,
            baseY: 0,
            stickX: 0,
            stickY: 0,
            radius: 50 // Handle move radius
        };

        this.isRunning = false;
        this.isPaused = false;
        this.bgmOn = false;

        this.initInput();
        this.loop();
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    initInput() {
        window.addEventListener('resize', () => this.resize());

        // Mouse Input
        window.addEventListener('mousemove', e => {
            if (!this.joystick.active) {
                this.mouse.x = e.clientX - this.canvas.width / 2;
                this.mouse.y = e.clientY - this.canvas.height / 2;
            }
        });

        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);

        window.addEventListener('keydown', e => {
            if (e.code === 'Space') this.mouse.down = true;
            if (e.code === 'Escape') this.togglePause();
        });
        window.addEventListener('keyup', e => {
            if (e.code === 'Space') this.mouse.down = false;
        });

        // ═══ Mobile Input ═══
        const joystickZone = document.getElementById('joystick-container');
        const joystickHandle = document.getElementById('joystick-handle');
        const boostBtn = document.getElementById('mobile-boost-btn');

        if (joystickZone) {
            joystickZone.addEventListener('touchstart', e => {
                e.preventDefault();
                const touch = e.changedTouches[0];
                const rect = joystickZone.getBoundingClientRect();
                this.joystick.baseX = rect.left + rect.width / 2;
                this.joystick.baseY = rect.top + rect.height / 2;
                this.joystick.active = true;
                this.updateJoystick(touch.clientX, touch.clientY);
            }, { passive: false });

            joystickZone.addEventListener('touchmove', e => {
                e.preventDefault();
                if (this.joystick.active) {
                    const touch = e.changedTouches[0];
                    this.updateJoystick(touch.clientX, touch.clientY);
                }
            }, { passive: false });

            joystickZone.addEventListener('touchend', e => {
                e.preventDefault();
                this.joystick.active = false;
                joystickHandle.style.transform = `translate(-50%, -50%)`;
            });
        }

        if (boostBtn) {
            boostBtn.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.mouse.down = true; // Use same flag as mouse
            }, { passive: false });
            boostBtn.addEventListener('touchend', (e) => {
                e.preventDefault();
                this.mouse.down = false;
            });
        }

        // UI Buttons
        document.getElementById('btn-start').addEventListener('click', () => {
            const name = document.getElementById('player-name').value || 'Unknown';
            const color = document.querySelector('.color-option.selected').dataset.color;
            this.startGame(name, color);

            // Check for touch device (simple check)
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                document.getElementById('mobile-controls').style.display = 'block';
            }
        });

        document.getElementById('btn-hunt').addEventListener('click', () => location.reload());

        document.getElementById('btn-continue').addEventListener('click', () => {
            document.getElementById('game-over-screen').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
            this.respawnPlayer();
        });

        document.getElementById('btn-bgm').addEventListener('click', () => this.toggleBGM());
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());

        // Pause Menu Buttons
        document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-quit').addEventListener('click', () => location.reload());

        // Color Picker Logic
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });

        // Difficulty Selector
        document.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        });
    }

    updateJoystick(touchX, touchY) {
        const dx = touchX - this.joystick.baseX;
        const dy = touchY - this.joystick.baseY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDist = this.joystick.radius; // Handle movement radius

        this.joystick.angle = Math.atan2(dy, dx);

        const clampDist = Math.min(distance, maxDist);
        const moveX = Math.cos(this.joystick.angle) * clampDist;
        const moveY = Math.sin(this.joystick.angle) * clampDist;

        // Visual update
        const handle = document.getElementById('joystick-handle');
        handle.style.transform = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
    }

    startGame(name, color) {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        this.playerName = name;
        this.playerColor = color;
        const diffBtn = document.querySelector('.diff-btn.selected');
        this.difficulty = diffBtn ? diffBtn.dataset.diff : 'normal';

        this.isRunning = true;

        this.foods = [];
        for (let i = 0; i < FOOD_COUNT; i++) this.spawnFood();

        this.worms = [];
        for (let i = 0; i < 10; i++) this.spawnAI();

        this.mobs = [];
        for (let i = 0; i < MOB_COUNT; i++) this.spawnMob();

        this.respawnPlayer();
        if (this.bgmOn) this.playBGM();
    }

    respawnPlayer() {
        this.player = new Worm(this, true, this.playerName, this.playerColor);
        this.player.x = rand(-WORLD_SIZE / 2, WORLD_SIZE / 2);
        this.player.y = rand(-WORLD_SIZE / 2, WORLD_SIZE / 2);
        this.worms.push(this.player);
        this.isRunning = true;
    }

    spawnFood(pos = null, val = 1) {
        this.foods.push({
            x: pos ? pos.x : rand(-WORLD_SIZE, WORLD_SIZE),
            y: pos ? pos.y : rand(-WORLD_SIZE, WORLD_SIZE),
            radius: val > 5 ? 8 : rand(2, 5),
            val: val,
            color: `hsl(${rand(0, 360)}, 100%, 60%)`,
            pulse: rand(0, Math.PI)
        });
    }

    spawnAI() {
        const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Snakey', 'Crawler', 'NopeRope', 'Snek', 'Boss', 'Eater'];
        const name = names[randInt(0, names.length)];
        const color = `hsl(${rand(0, 360)}, 70%, 50%)`;
        const ai = new Worm(this, false, name, color, this.difficulty);
        ai.x = rand(-WORLD_SIZE, WORLD_SIZE);
        ai.y = rand(-WORLD_SIZE, WORLD_SIZE);
        this.worms.push(ai);
    }

    spawnMob() {
        this.mobs.push(new Mob(this));
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        if (!this.isRunning || this.isPaused) return;

        this.update();
        this.draw();
    }

    update() {
        this.worms.forEach(w => w.update());
        this.worms = this.worms.filter(w => w.alive);
        if (this.worms.filter(w => !w.isPlayer).length < 10) this.spawnAI();
        this.mobs.forEach(m => m.update());
        this.foods.forEach(f => f.pulse += 0.1);
        if (this.foods.length < FOOD_COUNT) this.spawnFood();
        if (Math.random() < 0.05) this.updateHUD();
    }

    draw() {
        const ctx = this.ctx;
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.save();
        if (this.player && this.player.alive) {
            const targetX = -this.player.x + this.canvas.width / 2;
            const targetY = -this.player.y + this.canvas.height / 2;
            this.camera.x = lerp(this.camera.x, targetX, 0.1);
            this.camera.y = lerp(this.camera.y, targetY, 0.1);
        }
        ctx.translate(this.camera.x, this.camera.y);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 5;
        ctx.strokeRect(-WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE * 2, WORLD_SIZE * 2);

        this.foods.forEach(f => {
            const r = f.radius + Math.sin(f.pulse) * 1;
            ctx.fillStyle = f.color;
            ctx.shadowBlur = 10;
            ctx.shadowColor = f.color;
            ctx.beginPath();
            ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
        });

        this.mobs.forEach(m => m.draw(ctx));
        this.worms.sort((a, b) => a.nodes.length - b.nodes.length).forEach(w => w.draw(ctx));
        ctx.restore();
        this.drawMinimap(ctx);
    }

    drawMinimap(ctx) {
        const size = 150;
        const margin = 20;
        const mapX = this.canvas.width - size - margin;
        const mapY = this.canvas.height - size - margin;

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(mapX, mapY, size, size);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(mapX, mapY, size, size);

        const scale = size / (WORLD_SIZE * 2);

        this.worms.forEach(w => {
            const mx = mapX + (w.x + WORLD_SIZE) * scale;
            const my = mapY + (w.y + WORLD_SIZE) * scale;

            ctx.fillStyle = w.isPlayer ? '#00ff00' : '#ff0000';
            ctx.beginPath();
            ctx.arc(mx, my, w.isPlayer ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    togglePause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        const menu = document.getElementById('pause-menu');
        const mobile = document.getElementById('mobile-controls');

        if (this.isPaused) {
            menu.style.display = 'flex';
            if (mobile) mobile.style.display = 'none';
        } else {
            menu.style.display = 'none';
            if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
                if (mobile) mobile.style.display = 'block';
            }
        }
    }

    updateHUD() {
        if (!this.player) return;
        document.getElementById('score-length').innerText = Math.floor(this.player.length);
        document.getElementById('score-kill').innerText = this.player.kills;

        const sorted = [...this.worms].sort((a, b) => b.length - a.length);
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        sorted.slice(0, 10).forEach((w, i) => {
            const li = document.createElement('li');
            if (w.isPlayer) li.className = 'me';
            li.innerHTML = `<span>#${i + 1} ${w.name}</span><span>${Math.floor(w.length)}</span>`;
            list.appendChild(li);
        });
    }

    playBGM() { }
    toggleBGM() {
        this.bgmOn = !this.bgmOn;
        document.getElementById('btn-bgm').innerText = this.bgmOn ? "🔊 BGM ON" : "🔇 BGM OFF";
    }

    gameOver() {
        this.isRunning = false;
        document.getElementById('hud').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'flex';
        document.getElementById('mobile-controls').style.display = 'none'; // Hide controls
        document.getElementById('final-length').innerText = Math.floor(this.player.length);
        document.getElementById('final-kill').innerText = this.player.kills;
    }
}

class Worm {
    constructor(game, isPlayer, name, color, difficulty = 'normal') {
        this.game = game;
        this.isPlayer = isPlayer;
        this.name = name;
        this.color = color;
        this.difficulty = difficulty;

        this.x = 0;
        this.y = 0;
        this.angle = rand(0, Math.PI * 2);
        this.targetAngle = this.angle;

        // Difficulty Stats
        this.baseSpeed = BASE_SPEED;
        this.turnSpeed = TURN_SPEED;
        this.reactionDist = 100;
        this.aggression = 0; // 0 to 1

        if (!isPlayer) {
            switch (difficulty) {
                case 'easy':
                    this.baseSpeed = 2.5;
                    this.turnSpeed = 0.04;
                    this.reactionDist = 50;
                    break;
                case 'hard':
                    this.baseSpeed = 3.5;
                    this.turnSpeed = 0.12;
                    this.reactionDist = 150;
                    this.aggression = 0.5;
                    break;
                case 'veryhard':
                    this.baseSpeed = 4.0;
                    this.turnSpeed = 0.2;
                    this.reactionDist = 300;
                    this.aggression = 0.2; // Smart: Focus on food, attack only if easy
                    break;
                case 'normal':
                default:
                    this.baseSpeed = 3.0;
                    this.turnSpeed = 0.08;
                    this.reactionDist = 100;
                    break;
            }
        }

        this.speed = this.baseSpeed;
        this.nodes = [];
        this.length = 20;
        this.radius = 10;

        this.alive = true;
        this.kills = 0;

        for (let i = 0; i < this.length; i++) this.nodes.push({ x: this.x, y: this.y });
    }

    update() {
        if (!this.alive) return;
        this.handleInput();
        this.move();
        this.checkCollision();
    }

    handleInput() {
        if (this.isPlayer) {
            if (this.game.joystick.active) {
                // Use Joystick Angle
                this.targetAngle = this.game.joystick.angle;
            } else {
                // Mouse Direction
                const dx = this.game.mouse.x;
                const dy = this.game.mouse.y;
                this.targetAngle = Math.atan2(dy, dx);
            }

            if (this.game.mouse.down && this.length > 20) {
                this.speed = BOOST_SPEED;
                // Bigger worms drop more/bigger poop
                if (Math.random() < 0.2) {
                    const dropVal = Math.max(1, Math.floor(this.length / 50));
                    this.length -= dropVal * 0.5;
                    const tail = this.nodes[this.nodes.length - 1];
                    this.game.spawnFood({ x: tail.x, y: tail.y }, dropVal);
                }
            } else {
                this.speed = this.baseSpeed;
            }
        } else {
            // AI Behavior
            // 1. Check bounds
            let avoidBounds = false;
            if (this.x < -WORLD_SIZE + 200) { this.targetAngle = 0; avoidBounds = true; }
            else if (this.x > WORLD_SIZE - 200) { this.targetAngle = Math.PI; avoidBounds = true; }
            else if (this.y < -WORLD_SIZE + 200) { this.targetAngle = Math.PI / 2; avoidBounds = true; }
            else if (this.y > WORLD_SIZE - 200) { this.targetAngle = -Math.PI / 2; avoidBounds = true; }

            if (!avoidBounds) {
                // 2. Seek Food or Chase Player
                let bestTarget = null;
                let minDist = 1000;

                // Aggressive AI targets player
                if (this.aggression > 0 && this.game.player && this.game.player.alive) {
                    const d = dist(this.x, this.y, this.game.player.x, this.game.player.y);
                    if (d < 500 * this.aggression) {
                        bestTarget = this.game.player;
                    }
                }

                // Otherwise seek food
                if (!bestTarget) {
                    // Optimization: check more foods based on difficulty
                    const checkCount = (this.difficulty === 'veryhard' || this.difficulty === 'hard') ? 50 : 10;

                    for (let i = 0; i < checkCount; i++) {
                        const f = this.game.foods[randInt(0, this.game.foods.length)];
                        if (!f) continue;
                        const d = dist(this.x, this.y, f.x, f.y);

                        // Hell/Hard logic: Value matters more
                        let score = d;
                        if (this.difficulty === 'veryhard') score /= (f.val * 2); // Prefer high value
                        else if (this.difficulty === 'hard') score /= f.val;

                        if (score < minDist) {
                            minDist = score;
                            bestTarget = f;
                        }
                    }
                }

                if (bestTarget) {
                    this.targetAngle = Math.atan2(bestTarget.y - this.y, bestTarget.x - this.x);

                    // Hell AI Boosts for big food
                    if (this.difficulty === 'veryhard' && bestTarget.val > 5 && this.length > 30) {
                        this.speed = BOOST_SPEED;
                    }
                } else {
                    if (Math.random() < 0.05) this.targetAngle += rand(-1, 1);
                }

                // 3. Avoid Collisions (Simple Raycast feeler)
                // Look ahead
                /* Complex avoidance omitted for brevity, keeping simple wander/seek */
            }

            this.speed = this.baseSpeed;

            // Very Hard AI boosts occasionally
            if (this.difficulty === 'veryhard' && this.length > 50 && Math.random() < 0.01) {
                this.speed = BOOST_SPEED;
            }
        }
    }

    move() {
        let diff = this.targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * this.turnSpeed;

        const vx = Math.cos(this.angle) * this.speed;
        const vy = Math.sin(this.angle) * this.speed;

        this.x += vx;
        this.y += vy;

        if (this.x < -WORLD_SIZE) this.x = -WORLD_SIZE;
        if (this.x > WORLD_SIZE) this.x = WORLD_SIZE;
        if (this.y < -WORLD_SIZE) this.y = -WORLD_SIZE;
        if (this.y > WORLD_SIZE) this.y = WORLD_SIZE;

        this.nodes.unshift({ x: this.x, y: this.y });
        while (this.nodes.length > this.length) this.nodes.pop();
        this.radius = 10 + Math.floor(this.length / 20);
    }

    checkCollision() {
        for (let i = this.game.foods.length - 1; i >= 0; i--) {
            const f = this.game.foods[i];
            if (dist(this.x, this.y, f.x, f.y) < this.radius + f.radius) {
                this.length += f.val * 0.5;
                this.game.foods.splice(i, 1);
            }
        }

        for (const other of this.game.worms) {
            if (other === this) continue;
            if (!other.alive) continue;
            if (dist(this.x, this.y, other.x, other.y) > other.length * 10) continue;

            let hit = false;
            for (let i = 0; i < other.nodes.length; i += 2) {
                const node = other.nodes[i];
                if (dist(this.x, this.y, node.x, node.y) < this.radius + other.radius - 2) {
                    hit = true;
                    break;
                }
            }
            if (hit) {
                this.die(other);
                return;
            }
        }
    }

    die(killer) {
        this.alive = false;
        if (killer) killer.kills++;
        for (let i = 0; i < this.nodes.length; i += 2) {
            this.game.spawnFood(this.nodes[i], 2);
        }
        if (this.isPlayer) this.game.gameOver();
    }

    draw(ctx) {
        if (this.nodes.length === 0) return;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.lineWidth = this.radius * 2;
        ctx.strokeStyle = this.color;
        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
        for (let i = 1; i < this.nodes.length; i++) ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
        ctx.stroke();

        ctx.beginPath();
        ctx.lineWidth = this.radius * 2 - 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([10, 15]);
        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
        for (let i = 1; i < this.nodes.length; i++) ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
        ctx.stroke();
        ctx.setLineDash([]);

        const head = this.nodes[0];
        const eyeOff = this.radius * 0.6;
        const eyeX = Math.cos(this.angle + Math.PI / 2) * eyeOff;
        const eyeY = Math.sin(this.angle + Math.PI / 2) * eyeOff;

        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(head.x + eyeX, head.y + eyeY, this.radius * 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(head.x - eyeX, head.y - eyeY, this.radius * 0.4, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'black';
        const pupX = Math.cos(this.angle) * (this.radius * 0.2);
        const pupY = Math.sin(this.angle) * (this.radius * 0.2);
        ctx.beginPath(); ctx.arc(head.x + eyeX + pupX, head.y + eyeY + pupY, this.radius * 0.15, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(head.x - eyeX + pupX, head.y - eyeY + pupY, this.radius * 0.15, 0, Math.PI * 2); ctx.fill();

        ctx.fillStyle = 'white';
        ctx.font = '12px Fredoka';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, head.x, head.y - this.radius - 10);
    }
}

class Mob {
    constructor(game) {
        this.game = game;
        this.x = rand(-WORLD_SIZE, WORLD_SIZE);
        this.y = rand(-WORLD_SIZE, WORLD_SIZE);
        this.angle = rand(0, Math.PI * 2);
        this.speed = 4;
        this.alive = true;
    }

    update() {
        if (this.game.player && this.game.player.alive) {
            const d = dist(this.x, this.y, this.game.player.x, this.game.player.y);
            if (d < 300) {
                const angleToPlayer = Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
                this.angle = angleToPlayer + Math.PI;
            } else {
                if (Math.random() < 0.05) this.angle += rand(-1, 1);
            }
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        if (this.x < -WORLD_SIZE || this.x > WORLD_SIZE) this.angle = Math.PI - this.angle;
        if (this.y < -WORLD_SIZE || this.y > WORLD_SIZE) this.angle = -this.angle;

        for (const w of this.game.worms) {
            if (w.alive && dist(this.x, this.y, w.x, w.y) < w.radius + 10) {
                w.length += 10;
                this.alive = false;
                break;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(10, -5, 2, 0, Math.PI * 2);
        ctx.arc(10, 5, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(-5, -10); ctx.lineTo(-5, -15);
        ctx.moveTo(5, -10); ctx.lineTo(5, -15);
        ctx.moveTo(-5, 10); ctx.lineTo(-5, 15);
        ctx.moveTo(5, 10); ctx.lineTo(5, 15);
        ctx.stroke();
        ctx.restore();
    }
}

window.onload = () => new Game();
