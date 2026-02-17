
// ═══ CONFIG ═══
const WORLD_SIZE = 2000; // Total map size
const VIEWPORT_SCALE = 1.0; // Zoom level
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
        this.worms = []; // AI Works
        this.foods = [];
        this.mobs = []; // Beetles

        this.camera = { x: 0, y: 0, zoom: 1 };
        this.mouse = { x: 0, y: 0, down: false };

        this.isRunning = false;
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

        window.addEventListener('mousemove', e => {
            // Mouse pos relative to center
            this.mouse.x = e.clientX - this.canvas.width / 2;
            this.mouse.y = e.clientY - this.canvas.height / 2;
        });

        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);

        window.addEventListener('keydown', e => {
            if (e.code === 'Space') this.mouse.down = true;
        });
        window.addEventListener('keyup', e => {
            if (e.code === 'Space') this.mouse.down = false;
        });

        document.getElementById('btn-start').addEventListener('click', () => {
            const name = document.getElementById('player-name').value || 'Unknown';
            const color = document.querySelector('.color-option.selected').dataset.color;
            this.startGame(name, color);
        });

        document.getElementById('btn-hunt').addEventListener('click', () => {
            location.reload(); // Simple reload for menu
        });

        document.getElementById('btn-continue').addEventListener('click', () => {
            document.getElementById('game-over-screen').style.display = 'none';
            document.getElementById('hud').style.display = 'block';
            this.respawnPlayer();
        });

        document.getElementById('btn-bgm').addEventListener('click', () => this.toggleBGM());

        // Color Picker Logic
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.addEventListener('click', () => {
                document.querySelectorAll('.color-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
            });
        });
    }

    startGame(name, color) {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('hud').style.display = 'block';

        this.playerName = name;
        this.playerColor = color;
        this.isRunning = true;

        // Init World
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
        // Safe spawn
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
        const ai = new Worm(this, false, name, color);
        ai.x = rand(-WORLD_SIZE, WORLD_SIZE);
        ai.y = rand(-WORLD_SIZE, WORLD_SIZE);
        this.worms.push(ai);
    }

    spawnMob() {
        this.mobs.push(new Mob(this));
    }

    loop() {
        requestAnimationFrame(() => this.loop());
        if (!this.isRunning) return;

        this.update();
        this.draw();
    }

    update() {
        // Update Worms
        this.worms.forEach(w => w.update());

        // Remove dead worms
        this.worms = this.worms.filter(w => w.alive);

        // Respawn AI if low
        if (this.worms.filter(w => !w.isPlayer).length < 10) this.spawnAI();

        // Update Mobs
        this.mobs.forEach(m => m.update());

        // Update Food (Pulse)
        this.foods.forEach(f => f.pulse += 0.1);
        if (this.foods.length < FOOD_COUNT) this.spawnFood();

        // Update HUD (Leaderboard)
        if (Math.random() < 0.05) this.updateHUD();
    }

    draw() {
        const ctx = this.ctx;

        // Clear
        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Camera Transform
        ctx.save();

        if (this.player && this.player.alive) {
            // Smooth Camera Follow
            const targetX = -this.player.x + this.canvas.width / 2;
            const targetY = -this.player.y + this.canvas.height / 2;
            this.camera.x = lerp(this.camera.x, targetX, 0.1);
            this.camera.y = lerp(this.camera.y, targetY, 0.1);
        }

        ctx.translate(this.camera.x, this.camera.y);

        // Draw World Bounds
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 5;
        ctx.strokeRect(-WORLD_SIZE, -WORLD_SIZE, WORLD_SIZE * 2, WORLD_SIZE * 2);

        // Draw Food
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

        // Draw Mobs
        this.mobs.forEach(m => m.draw(ctx));

        // Draw Worms
        // Sort by y to fake depth? Or length?
        this.worms.sort((a, b) => a.nodes.length - b.nodes.length).forEach(w => w.draw(ctx));

        ctx.restore();

        // Minimap
        this.drawMinimap(ctx);
    }

    drawMinimap(ctx) {
        const size = 150;
        const margin = 20;
        const mapX = this.canvas.width - size - margin;
        const mapY = this.canvas.height - size - margin;

        // Bg
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(mapX, mapY, size, size);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(mapX, mapY, size, size);

        // Scale
        const scale = size / (WORLD_SIZE * 2);

        // Dots
        this.worms.forEach(w => {
            const mx = mapX + (w.x + WORLD_SIZE) * scale;
            const my = mapY + (w.y + WORLD_SIZE) * scale;

            ctx.fillStyle = w.isPlayer ? '#00ff00' : '#ff0000';
            ctx.beginPath();
            ctx.arc(mx, my, w.isPlayer ? 3 : 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    updateHUD() {
        if (!this.player) return;

        document.getElementById('score-length').innerText = Math.floor(this.player.length);
        document.getElementById('score-kill').innerText = this.player.kills;

        // Leaderboard
        const sorted = [...this.worms].sort((a, b) => b.length - a.length);
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        sorted.slice(0, 10).forEach((w, i) => {
            const li = document.createElement('li');
            if (w.isPlayer) li.className = 'me';
            li.innerHTML = `<span>#${i + 1} ${w.name}</span><span>${Math.floor(w.length)}</span>`;
            list.appendChild(li);
        });

        // King Arrow Logic? (TODO)
    }

    playBGM() {
        // Simple oscillator BGM not implemented for brevity, just console log
        // Ideally use AudioContext
    }
    toggleBGM() {
        this.bgmOn = !this.bgmOn;
        document.getElementById('btn-bgm').innerText = this.bgmOn ? "🔊 BGM ON" : "🔇 BGM OFF";
    }

    gameOver() {
        this.isRunning = false;
        document.getElementById('hud').style.display = 'none';
        document.getElementById('game-over-screen').style.display = 'flex';
        document.getElementById('final-length').innerText = Math.floor(this.player.length);
        document.getElementById('final-kill').innerText = this.player.kills;
    }
}

class Worm {
    constructor(game, isPlayer, name, color) {
        this.game = game;
        this.isPlayer = isPlayer;
        this.name = name;
        this.color = color;

        this.x = 0;
        this.y = 0;
        this.angle = rand(0, Math.PI * 2);
        this.targetAngle = this.angle;

        this.speed = BASE_SPEED;
        this.nodes = []; // Body parts
        this.length = 20; // Target length
        this.radius = 10;

        this.alive = true;
        this.kills = 0;

        // Init nodes
        for (let i = 0; i < this.length; i++) {
            this.nodes.push({ x: this.x, y: this.y });
        }
    }

    update() {
        if (!this.alive) return;

        this.handleInput();
        this.move();
        this.checkCollision();
    }

    handleInput() {
        if (this.isPlayer) {
            // Mouse Direction
            const dx = this.game.mouse.x; // relative to center
            const dy = this.game.mouse.y;
            this.targetAngle = Math.atan2(dy, dx);

            // Boost
            if (this.game.mouse.down && this.length > 20) {
                this.speed = BOOST_SPEED;
                // Drop mass
                if (Math.random() < 0.2) {
                    this.length -= 0.5;
                    // Spawn poop at tail
                    const tail = this.nodes[this.nodes.length - 1];
                    this.game.spawnFood({ x: tail.x, y: tail.y }, 1);
                }
            } else {
                this.speed = BASE_SPEED;
            }
        } else {
            // AI Logic
            // Wander
            if (Math.random() < 0.05) this.targetAngle += rand(-1, 1);

            // Avoid Walls
            if (this.x < -WORLD_SIZE + 100) this.targetAngle = 0;
            if (this.x > WORLD_SIZE - 100) this.targetAngle = Math.PI;
            if (this.y < -WORLD_SIZE + 100) this.targetAngle = Math.PI / 2;
            if (this.y > WORLD_SIZE - 100) this.targetAngle = -Math.PI / 2;

            this.speed = BASE_SPEED;
        }
    }

    move() {
        // Smooth Turn
        let diff = this.targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        this.angle += diff * TURN_SPEED;

        // Velocity
        const vx = Math.cos(this.angle) * this.speed;
        const vy = Math.sin(this.angle) * this.speed;

        this.x += vx;
        this.y += vy;

        // Bounds
        if (this.x < -WORLD_SIZE) this.x = -WORLD_SIZE;
        if (this.x > WORLD_SIZE) this.x = WORLD_SIZE;
        if (this.y < -WORLD_SIZE) this.y = -WORLD_SIZE;
        if (this.y > WORLD_SIZE) this.y = WORLD_SIZE;

        // Head Node logic:
        // Unlike grid snake, we update head, and body follows.
        // We push new head pos, and pop tail if length exceeds target.

        // Actually for smooth worms, we usually store history of positions
        // and render nodes at fixed distances.
        // Simple approach: unshift head.

        this.nodes.unshift({ x: this.x, y: this.y });

        while (this.nodes.length > this.length) {
            this.nodes.pop();
        }

        // Adjust radius based on length
        this.radius = 10 + Math.floor(this.length / 20);
    }

    checkCollision() {
        // Food
        for (let i = this.game.foods.length - 1; i >= 0; i--) {
            const f = this.game.foods[i];
            if (dist(this.x, this.y, f.x, f.y) < this.radius + f.radius) {
                this.length += f.val * 0.5;
                this.game.foods.splice(i, 1);
            }
        }

        // Other Snakes Body
        for (const other of this.game.worms) {
            if (other === this) continue; // No self collision check for now (safe mode)
            if (!other.alive) continue;

            // Check all nodes of other snake
            // Optimization: check bounding box first or distance to head
            if (dist(this.x, this.y, other.x, other.y) > other.length * 10) continue; // rough cull

            // Skip other's head (head-to-head collision is a draw or both die? Let's say both die)
            // Colliding with body:
            let hit = false;
            // Iterate with step to save perf
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

        // Drop food
        // Convert nodes to food
        for (let i = 0; i < this.nodes.length; i += 2) {
            this.game.spawnFood(this.nodes[i], 2); // Value 2
        }

        if (this.isPlayer) this.game.gameOver();
    }

    draw(ctx) {
        if (this.nodes.length === 0) return;

        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Body (Stroke method)
        ctx.beginPath();
        ctx.lineWidth = this.radius * 2;
        ctx.strokeStyle = this.color;

        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
        // Quadratic curves for smoothness?
        // Simple lineTo for now (nodes are close)
        for (let i = 1; i < this.nodes.length; i++) {
            ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
            // Optimize rendering? 
        }
        ctx.stroke();

        // Pattern overlays (Stripes)
        // Draw dashed white line over
        ctx.beginPath();
        ctx.lineWidth = this.radius * 2 - 4;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.setLineDash([10, 15]);
        ctx.moveTo(this.nodes[0].x, this.nodes[0].y);
        for (let i = 1; i < this.nodes.length; i++) ctx.lineTo(this.nodes[i].x, this.nodes[i].y);
        ctx.stroke();
        ctx.setLineDash([]); // Reset

        // Eyes
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

        // Name Tag
        ctx.fillStyle = 'white';
        ctx.font = '12px Fredoka';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, head.x, head.y - this.radius - 10);
    }
}

class Mob { // Beetle
    constructor(game) {
        this.game = game;
        this.x = rand(-WORLD_SIZE, WORLD_SIZE);
        this.y = rand(-WORLD_SIZE, WORLD_SIZE);
        this.angle = rand(0, Math.PI * 2);
        this.speed = 4; // Fast
        this.alive = true;
    }

    update() {
        // Run away from player
        if (this.game.player && this.game.player.alive) {
            const d = dist(this.x, this.y, this.game.player.x, this.game.player.y);
            if (d < 300) {
                const angleToPlayer = Math.atan2(this.game.player.y - this.y, this.game.player.x - this.x);
                this.angle = angleToPlayer + Math.PI; // Run away
            } else {
                if (Math.random() < 0.05) this.angle += rand(-1, 1);
            }
        }

        this.x += Math.cos(this.angle) * this.speed;
        this.y += Math.sin(this.angle) * this.speed;

        // Bounds bounce
        if (this.x < -WORLD_SIZE || this.x > WORLD_SIZE) this.angle = Math.PI - this.angle;
        if (this.y < -WORLD_SIZE || this.y > WORLD_SIZE) this.angle = -this.angle;

        // Collision with snake head -> snake eats mob
        for (const w of this.game.worms) {
            if (w.alive && dist(this.x, this.y, w.x, w.y) < w.radius + 10) {
                w.length += 10; // Big bonus
                this.alive = false;
                break;
            }
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Beetle Body
        ctx.fillStyle = '#ffcc00';
        ctx.beginPath();
        ctx.ellipse(0, 0, 15, 10, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'black';
        ctx.beginPath();
        ctx.arc(10, -5, 2, 0, Math.PI * 2); // Eye
        ctx.arc(10, 5, 2, 0, Math.PI * 2);
        ctx.fill();

        // Legs (simple lines)
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

// Start
window.onload = () => new Game();
