/**
 * Pixel Flow Prototype Demo
 * 核心逻辑：
 * 1. 关卡数据（定义矩阵和可用颜色）
 * 2. 入场逻辑（deck -> queue slot）
 * 3. 战斗逻辑 (queue 发射子弹 -> 击中消除像素块)
 */

// 预设颜色
const COLORS = {
    R: '#e74c3c', // 红色
    G: '#2ecc71', // 绿色
    B: '#3498db', // 蓝色
    Y: '#f1c40f', // 黄色
    P: '#9b59b6', // 紫色
    0: 'transparent' // 空白
};

// 预设关卡数据
const LEVEL_1 = {
    map: [
        ['R', 'R', 'R', '0', 'B', 'B', 'B'],
        ['R', 'Y', 'R', '0', 'B', 'Y', 'B'],
        ['R', 'R', 'R', '0', 'B', 'B', 'B'],
        ['0', '0', '0', '0', '0', '0', '0'],
        ['G', 'G', 'G', '0', 'P', 'P', 'P'],
        ['G', 'Y', 'G', '0', 'P', 'Y', 'P'],
        ['G', 'G', 'G', '0', 'P', 'P', 'P']
    ],
    // 玩家能够使用的可部署单元 [颜色, 弹药量]
    deck: [
        ['R', 8], ['B', 8], ['G', 8], ['P', 8], ['Y', 4]
    ]
};

// 游戏状态
let gameState = {
    board: [], // 包含中心方块和外围轨道的节点状态
    deck: [],
    activeShooters: [], // 正在跑道上的单位 { color, ammo, pathIndex, el }
    trackPath: [], // 预计算的外围环形跑道坐标系列 [{r, c}, {r, c}...]
    blocksLeft: 0,
    isProcessingTick: false, 
    tickInterval: null,
    audioCtx: null, // Web Audio Context
    musicPlayed: false // 标记是否播放过开场曲
};

// DOM 元素 references
const boardEl = document.getElementById('pixel-board');
const deckEl = document.getElementById('deck-container');
const blocksLeftEl = document.getElementById('blocks-left');

// 初始化游戏
function initGame(level) {
    if (gameState.tickInterval) clearInterval(gameState.tickInterval);
    
    boardEl.innerHTML = '';
    deckEl.innerHTML = '';
    
    gameState.activeShooters = [];
    gameState.trackPath = [];
    gameState.blocksLeft = 0;
    gameState.isProcessingTick = false;

    // 解析地图，加上周围一圈轨道，所以宽高各+2
    const innerRows = level.map.length;
    const innerCols = level.map[0].length;
    const rows = innerRows + 2;
    const cols = innerCols + 2;
    
    boardEl.style.gridTemplateRows = `repeat(${rows}, var(--cell-size))`;
    boardEl.style.gridTemplateColumns = `repeat(${cols}, var(--cell-size))`;

    gameState.board = [];
    
    for (let r = 0; r < rows; r++) {
        const rowArr = [];
        for (let c = 0; c < cols; c++) {
            const isTrack = (r === 0 || r === rows - 1 || c === 0 || c === cols - 1);
            
            if (isTrack) {
                // 绘制跑道格子
                const trackCell = document.createElement('div');
                trackCell.className = 'track-cell';
                trackCell.dataset.r = r;
                trackCell.dataset.c = c;
                boardEl.appendChild(trackCell);
                // 保存到状态中供后续查找
                rowArr.push({ type: 'track', el: trackCell });
            } else {
                // 中心游戏区域
                const innerR = r - 1;
                const innerC = c - 1;
                const colorKey = level.map[innerR][innerC];
                
                if (colorKey !== '0') {
                    const pixel = document.createElement('div');
                    pixel.className = 'pixel';
                    pixel.style.backgroundColor = COLORS[colorKey];
                    pixel.dataset.r = r;
                    pixel.dataset.c = c;
                    pixel.dataset.color = colorKey;
                    
                    boardEl.appendChild(pixel);
                    rowArr.push({ type: 'block', el: pixel, color: colorKey, active: true });
                    gameState.blocksLeft++;
                } else {
                    const empty = document.createElement('div');
                    empty.className = 'pixel destroyed';
                    boardEl.appendChild(empty);
                    rowArr.push(null); // empty center cell
                }
            }
        }
        gameState.board.push(rowArr);
    }
    
    blocksLeftEl.textContent = gameState.blocksLeft;
    
    // 生成顺时针的跑道坐标序列
    buildTrackPath(rows, cols);

    // 解析手牌(Deck) - 把数组转换成对象格式方便追踪 used 状态
    gameState.deck = level.deck.map(d => ({ color: d[0], ammo: d[1], used: false }));
    renderDeck();
    
    document.getElementById('game-over-panel').classList.add('hidden');
    
    // 启动跑道游戏循环 (每125ms Tick一次，再次提速2倍)
    gameState.tickInterval = setInterval(gameTick, 125);
}

// 构建顺时针环形轨道坐标数列
function buildTrackPath(rows, cols) {
    // 顶边 (左到右)
    for (let c = 0; c < cols - 1; c++) gameState.trackPath.push({ r: 0, c: c });
    // 右边 (上到下)
    for (let r = 0; r < rows - 1; r++) gameState.trackPath.push({ r: r, c: cols - 1 });
    // 底边 (右到左)
    for (let c = cols - 1; c > 0; c--) gameState.trackPath.push({ r: rows - 1, c: c });
    // 左边 (下到上)
    for (let r = rows - 1; r > 0; r--) gameState.trackPath.push({ r: r, c: 0 });
}

// 渲染可选射手牌组
function renderDeck() {
    deckEl.innerHTML = '';
    gameState.deck.forEach((card, index) => {
        if (!card) return;
        
        const colorKey = card.color;
        const ammo = card.ammo;
        
        const cardEl = document.createElement('div');
        cardEl.className = 'deck-card';
        cardEl.style.setProperty('--tank-color', COLORS[colorKey]);
        cardEl.dataset.index = index;
        
        if (card.used) {
            cardEl.classList.add('used');
        } else {
            const ammoBadge = document.createElement('div');
            ammoBadge.className = 'ammo-badge';
            ammoBadge.textContent = ammo;
            
            cardEl.appendChild(ammoBadge);
            
            // 点击部署事件
            cardEl.addEventListener('click', () => deployShooter(index));
        }
        
        deckEl.appendChild(cardEl);
    });
}

// 部署到跑道
function deployShooter(deckIndex) {
    const card = gameState.deck[deckIndex];
    if (!card || card.used) return;
    
    const entryIndex = 0; // 入口点默认在跑道序列的第0格 (左上角)
    
    // 检查入口点是否被占用，否则无法下牌
    const isOccupied = gameState.activeShooters.some(s => s.pathIndex === entryIndex);
    if (isOccupied) return;
    
    card.used = true;
    renderDeck();
    
    const shooterEl = document.createElement('div');
    shooterEl.className = 'shooter';
    // 用 css variable 传递颜色，避免影响履带等阴影
    shooterEl.style.setProperty('--tank-color', COLORS[card.color]);
    shooterEl.style.backgroundColor = COLORS[card.color];
    
    const ammoBadge = document.createElement('div');
    ammoBadge.className = 'ammo-badge';
    ammoBadge.textContent = card.ammo;
    shooterEl.appendChild(ammoBadge);
    
    // 放到对应跑道格子的DOM中
    const trackPoint = gameState.trackPath[entryIndex];
    const trackCellNode = gameState.board[trackPoint.r][trackPoint.c];
    trackCellNode.el.appendChild(shooterEl);
    
    const shooterObj = {
        color: card.color,
        ammo: card.ammo,
        pathIndex: entryIndex,
        stepsTaken: 0,
        deckIndex: deckIndex,
        el: shooterEl,
        ammoBadgeEl: ammoBadge
    };
    gameState.activeShooters.push(shooterObj);
    
    // 初始化时更新坦克的朝向
    updateTankRotation(shooterObj);
}

// 动态计算坦克应该朝向哪个方向（面向棋盘内部）
function updateTankRotation(shooter) {
    const pos = gameState.trackPath[shooter.pathIndex];
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    // 移除旧的方向 class
    shooter.el.classList.remove('tank-up', 'tank-down', 'tank-left', 'tank-right');
    
    let rotationDeg = 0;
    
    if (pos.r === 0) {
        // 在最上面跑道，炮管应朝下
        shooter.el.classList.add('tank-down');
        rotationDeg = -180;
    } else if (pos.r === rows - 1) {
        // 在最底边，朝上
        shooter.el.classList.add('tank-up');
        rotationDeg = 0;
    } else if (pos.c === 0) {
        // 在最左边，朝右
        shooter.el.classList.add('tank-right');
        rotationDeg = -90;
    } else if (pos.c === cols - 1) {
        // 在最右侧，朝左
        shooter.el.classList.add('tank-left');
        rotationDeg = 90;
    }
    
    // 将相反的旋转角度应用给弹药提示，保证数字永远正立
    shooter.ammoBadgeEl.style.transform = `rotate(${rotationDeg}deg)`;
}

// 全局Tick驱动所有单位行走和射击
async function gameTick() {
    if (gameState.isProcessingTick) return;
    gameState.isProcessingTick = true;
    
    // 反向遍历或排序可以避免因为数组改动导致的跳跃，这里我们按位置把跑在前面的单位优先处理
    gameState.activeShooters.sort((a,b) => b.pathIndex - a.pathIndex);
    
    let needsToRemove = [];
    
    for (let i = 0; i < gameState.activeShooters.length; i++) {
        const shooter = gameState.activeShooters[i];
        
        // 1. 直线探测并攻击
        const target = raycastFindTarget(shooter);
        if (target) {
            // FIRE AND FORGET (不要await阻塞整盘循环)
            fireBullet(shooter, target);
            shooter.ammo--;
            shooter.ammoBadgeEl.textContent = shooter.ammo;
            target.active = false;
            destroyBlock(target);
            
            if (gameState.blocksLeft <= 0) {
                showGameOver(true);
                return; 
            }
            
            if (shooter.ammo <= 0) {
                needsToRemove.push(shooter);
            }
        }
        
        // 如果它已经被标记移除（弹药打光），就不需要再走动
        if (needsToRemove.includes(shooter)) continue;
        
        // 2. 向前移动一格
        const nextIndex = (shooter.pathIndex + 1) % gameState.trackPath.length;
        // 检查下一个位置是否被占（简单的碰撞体积）
        const isBlockedByOther = gameState.activeShooters.some(s => s.pathIndex === nextIndex && s !== shooter);
        
        if (!isBlockedByOther) {
            shooter.pathIndex = nextIndex;
            shooter.stepsTaken++;
            
            // 如果它已经走满了一整圈 (步数 >= 跑道总长度)，则退回底部被收回
            if (shooter.stepsTaken >= gameState.trackPath.length) {
                const card = gameState.deck[shooter.deckIndex];
                if (card) {
                    card.used = false;
                    card.ammo = shooter.ammo; // 同步剩余弹药
                }
                renderDeck();
                needsToRemove.push(shooter);
                continue;
            }
            
            const trackPoint = gameState.trackPath[nextIndex];
            const trackCellNode = gameState.board[trackPoint.r][trackPoint.c];
            trackCellNode.el.appendChild(shooter.el); // 移动DOM节点
            
            // 每次移动后更新可能转弯带来的方向变化
            updateTankRotation(shooter);
        }
    }
    
    // 移除弹药打光的单位
    needsToRemove.forEach(s => {
        if (s.el.parentNode) s.el.parentNode.removeChild(s.el);
        const idx = gameState.activeShooters.indexOf(s);
        if (idx > -1) gameState.activeShooters.splice(idx, 1);
    });
    
    gameState.isProcessingTick = false;
    
    checkDeadlock();
}

// 射线寻敌 (水平或垂直探视)
function raycastFindTarget(shooter) {
    const pos = gameState.trackPath[shooter.pathIndex];
    const rows = gameState.board.length;
    const cols = gameState.board[0].length;
    
    // 决定视线方向：
    // 如果在顶边 (r=0)，往下看 (+1, 0)
    // 如果在底边 (r=rows-1)，往上看 (-1, 0)
    // 如果在左边 (c=0)，往右看 (0, +1)
    // 如果在右边 (c=cols-1)，往左看 (0, -1)
    let dr = 0, dc = 0;
    if (pos.r === 0) dr = 1;
    else if (pos.r === rows - 1) dr = -1;
    else if (pos.c === 0) dc = 1;
    else if (pos.c === cols - 1) dc = -1;
    
    if (dr === 0 && dc === 0) return null; // 异常情况
    
    let r = pos.r + dr;
    let c = pos.c + dc;
    
    while (r > 0 && r < rows - 1 && c > 0 && c < cols - 1) {
        const block = gameState.board[r][c];
        if (block && block.type === 'block' && block.active) {
            // 碰到了第一个方块
            if (block.color === shooter.color) {
                return block; // 颜色匹配，可以攻击
            } else {
                return null; // 被异色方块阻挡视线
            }
        }
        r += dr;
        c += dc;
    }
    
    return null; // 直线上全空
}

// 射击动画
function fireBullet(shooter, targetBlock) {
    // 播放音效
    playShootSound();

    return new Promise(resolve => {
        // shooter 起点在它所处的 track-cell
        const cellNode = shooter.el.parentNode;
        const targetEl = targetBlock.el;
        
        const bullet = document.createElement('div');
        bullet.className = 'bullet';
        bullet.style.backgroundColor = COLORS[shooter.color];
        
        const gameContainer = document.getElementById('game-container');
        gameContainer.appendChild(bullet);
        
        // 计算起始位置 (槽位中心)
        const slotRect = cellNode.getBoundingClientRect();
        const containerRect = gameContainer.getBoundingClientRect();
        const startX = slotRect.left - containerRect.left + slotRect.width / 2 - 6;
        const startY = slotRect.top - containerRect.top + slotRect.height / 2 - 6;
        
        // 计算目标位置 (方块中心)
        const targetRect = targetEl.getBoundingClientRect();
        const endX = targetRect.left - containerRect.left + targetRect.width / 2 - 6;
        const endY = targetRect.top - containerRect.top + targetRect.height / 2 - 6;
        
        // 初始位置固定在起跑线
        bullet.style.left = startX + 'px';
        bullet.style.top = startY + 'px';
        // 激活动画
        setTimeout(() => {
            bullet.style.left = endX + 'px';
            bullet.style.top = endY + 'px';
        }, 10); // 小延时触发 transition
        
        // 动画结束移除子弹 (弹道速度稍微加快一点匹配 Tick)
        setTimeout(() => {
            bullet.remove();
            resolve();
        }, 150); 
    });
}

function destroyBlock(target) {
    target.el.classList.add('destroyed');
    gameState.blocksLeft--;
    blocksLeftEl.textContent = gameState.blocksLeft;
}

function checkDeadlock() {
    if (gameState.blocksLeft <= 0) return;
    
    // 判断是否有卡牌还能发出
    const availableCards = gameState.deck.some(c => !c.used);
    
    // 如果没有卡牌了，且场上的游走单位全部消耗光，就算没过关（可能设计上有遗漏的过关条件，姑且视为失败）
    if (!availableCards && gameState.activeShooters.length === 0) {
        showGameOver(false);
        return;
    }
    
    // 如果赛道全满 (单位排满) 且没有单位可以攻击，则为僵死
    if (gameState.activeShooters.length >= gameState.trackPath.length) {
        // 二次校验：确保现在真的没有单位面向目标
        const canAnyoneShoot = gameState.activeShooters.some(s => raycastFindTarget(s) !== null);
        if (!canAnyoneShoot) {
            showGameOver(false);
        }
    }
}

function showGameOver(isWin) {
    if (gameState.tickInterval) clearInterval(gameState.tickInterval);
    const panel = document.getElementById('game-over-panel');
    const title = document.getElementById('game-result-title');
    
    title.textContent = isWin ? 'Victory!' : 'Track Blocked / Out of Moves';
    title.style.color = isWin ? '#f1c40f' : '#e74c3c';
    panel.classList.remove('hidden');
}

// --- 音效处理 (Web Audio API) ---

function initAudio() {
    if (!gameState.audioCtx) {
        gameState.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}

function playShootSound() {
    initAudio();
    if (!gameState.audioCtx) return;

    const ctx = gameState.audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square'; 
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}

// --- 背景音乐: 坦克大战开场旋律 ---
function playStartMusic() {
    initAudio();
    const ctx = gameState.audioCtx;
    if (!ctx) return;

    // 经典开场曲旋律数据 (音高, 持续时间)
    const melody = [
        [392, 0.15], [523, 0.15], [392, 0.15], [261, 0.15], 
        [392, 0.15], [523, 0.15], [392, 0.15], [261, 0.15],
        [440, 0.15], [587, 0.15], [440, 0.15], [293, 0.15],
        [440, 0.15], [587, 0.15], [440, 0.15], [293, 0.15],
        [493, 0.15], [659, 0.15], [493, 0.15], [329, 0.15],
        [523, 0.3],  [392, 0.15], [261, 0.15], [523, 0.6]
    ];

    let startTime = ctx.currentTime + 0.1;

    melody.forEach(([freq, duration]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0.05, startTime);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration - 0.05);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + duration);

        startTime += duration;
    });
}

// 绑定重启按钮，顺便激活 AudioContext (浏览器安全策略要求)
document.getElementById('restart-btn').addEventListener('click', () => {
    initAudio();
    initGame(LEVEL_1);
});

// 在页面任何地方首次点击也激活一次 AudioContext 并播放启动音乐
document.addEventListener('mousedown', () => {
    initAudio();
    if (gameState.audioCtx && !gameState.musicPlayed) {
        gameState.musicPlayed = true;
        playStartMusic();
    }
}, { once: true });

// 启动
initGame(LEVEL_1);
