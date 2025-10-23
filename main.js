// ゲーム設定
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30;
const COLORS = [
    null,
    '#FF0D72', // I
    '#0DC2FF', // J
    '#0DFF72', // L
    '#F538FF', // O
    '#FF8E0D', // S
    '#FFE138', // T
    '#3877FF'  // Z
];

// テトロミノの形状定義
const SHAPES = [
    [[1, 1, 1, 1]], // I
    [[2, 0, 0], [2, 2, 2]], // J
    [[0, 0, 3], [3, 3, 3]], // L
    [[4, 4], [4, 4]], // O
    [[0, 5, 5], [5, 5, 0]], // S
    [[0, 6, 0], [6, 6, 6]], // T
    [[7, 7, 0], [0, 7, 7]]  // Z
];

// ゲーム状態
let board = [];
let currentPiece = null;
let nextPiece = null;
let score = 0;
let lines = 0;
let level = 1;
let gameRunning = false;
let gamePaused = false;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// Canvas要素
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextCanvas');
const nextCtx = nextCanvas.getContext('2d');

// UI要素
const overlay = document.getElementById('gameOverlay');
const overlayTitle = document.getElementById('overlayTitle');
const overlayMessage = document.getElementById('overlayMessage');
const startButton = document.getElementById('startButton');
const retryButton = document.getElementById('retryButton');
const scoreDisplay = document.getElementById('score');
const linesDisplay = document.getElementById('lines');
const levelDisplay = document.getElementById('level');
const bgmToggle = document.getElementById('bgmToggle');
const sfxToggle = document.getElementById('sfxToggle');

// Audio Context
let audioContext = null;
let bgmOscillator = null;
let bgmGain = null;
let bgmTimeout = null;

// 初期化
function init() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    score = 0;
    lines = 0;
    level = 1;
    dropInterval = 1000;
    updateScore();
}

// ボードを描画
function drawBoard() {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            if (board[row][col]) {
                drawBlock(ctx, col, row, board[row][col]);
            }
        }
    }
}

// ブロックを描画
function drawBlock(context, x, y, colorIndex) {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;
    
    context.fillStyle = COLORS[colorIndex];
    context.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    
    // 立体感を出す
    context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    context.lineWidth = 2;
    context.strokeRect(px + 1, py + 1, BLOCK_SIZE - 2, BLOCK_SIZE - 2);
    
    context.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    context.lineWidth = 1;
    context.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
}

// 現在のピースを描画
function drawPiece() {
    if (!currentPiece) return;
    
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(ctx, currentPiece.x + x, currentPiece.y + y, value);
            }
        });
    });
}

// 次のピースを描画
function drawNextPiece() {
    nextCtx.fillStyle = '#000';
    nextCtx.fillRect(0, 0, nextCanvas.width, nextCanvas.height);
    
    if (!nextPiece) return;
    
    const offsetX = (4 - nextPiece.shape[0].length) / 2;
    const offsetY = (4 - nextPiece.shape.length) / 2;
    
    nextPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                drawBlock(nextCtx, offsetX + x, offsetY + y, value);
            }
        });
    });
}

// 新しいピースを生成
function createPiece() {
    const shapeIndex = Math.floor(Math.random() * SHAPES.length);
    return {
        shape: SHAPES[shapeIndex].map(row => [...row]),
        x: Math.floor(COLS / 2) - Math.floor(SHAPES[shapeIndex][0].length / 2),
        y: 0
    };
}

// 衝突判定
function collide() {
    for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
            if (currentPiece.shape[y][x]) {
                const newX = currentPiece.x + x;
                const newY = currentPiece.y + y;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY >= 0 && board[newY][newX]) {
                    return true;
                }
            }
        }
    }
    return false;
}

// ピースを固定
function mergePiece() {
    currentPiece.shape.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value) {
                const boardY = currentPiece.y + y;
                const boardX = currentPiece.x + x;
                if (boardY >= 0 && boardY < ROWS) {
                    board[boardY][boardX] = value;
                }
            }
        });
    });
}

// ラインをクリア
function clearLines() {
    let linesCleared = 0;
    
    // 下から上に向かってチェック
    for (let row = ROWS - 1; row >= 0; row--) {
        // 行が完全に埋まっているかチェック
        if (board[row].every(cell => cell !== 0)) {
            // 行を削除して上に新しい空行を追加
            board.splice(row, 1);
            board.unshift(Array(COLS).fill(0));
            linesCleared++;
            row++; // 同じ行を再チェック（削除後に下がってくるため）
        }
    }
    
    if (linesCleared > 0) {
        lines += linesCleared;
        // スコア計算（1-4ラインに対応）
        const lineScores = [0, 100, 300, 500, 800];
        const scoreValue = linesCleared <= 4 ? lineScores[linesCleared] : 800;
        score += scoreValue * level;
        level = Math.floor(lines / 10) + 1;
        dropInterval = Math.max(100, 1000 - (level - 1) * 100);
        updateScore();
        playSFX('clear');
    }
}

// スコアを更新
function updateScore() {
    scoreDisplay.textContent = score;
    linesDisplay.textContent = lines;
    levelDisplay.textContent = level;
}

// ピースを移動
function move(dir) {
    if (!currentPiece) return false;
    
    currentPiece.x += dir;
    if (collide()) {
        currentPiece.x -= dir;
        return false;
    }
    playSFX('move');
    return true;
}

// ピースを回転
function rotate() {
    if (!currentPiece) return;
    
    const originalShape = currentPiece.shape;
    currentPiece.shape = currentPiece.shape[0].map((_, i) =>
        currentPiece.shape.map(row => row[i]).reverse()
    );
    
    // 壁蹴り処理
    let offset = 0;
    while (collide()) {
        currentPiece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (Math.abs(offset) > currentPiece.shape[0].length) {
            currentPiece.shape = originalShape;
            return;
        }
    }
    playSFX('rotate');
}

// ピースを落下
function drop() {
    if (!currentPiece) return;
    
    currentPiece.y++;
    if (collide()) {
        currentPiece.y--;
        mergePiece();
        clearLines();
        
        // 新しいピースを生成
        currentPiece = nextPiece;
        nextPiece = createPiece();
        
        // ゲームオーバー判定
        if (collide()) {
            gameOver();
            return;
        }
        
        playSFX('drop');
        drawNextPiece();
    }
    dropCounter = 0;
}

// ハードドロップ
function hardDrop() {
    if (!currentPiece) return;
    
    while (!collide()) {
        currentPiece.y++;
    }
    currentPiece.y--;
    drop();
    score += 20;
    updateScore();
}

// ゲームオーバー
function gameOver() {
    gameRunning = false;
    stopBGM();
    playSFX('gameover');
    
    overlayTitle.textContent = 'Game Over';
    overlayMessage.textContent = `スコア: ${score}`;
    startButton.style.display = 'none';
    retryButton.style.display = 'inline-block';
    overlay.classList.remove('hidden');
}

// ゲーム開始
function startGame() {
    // AudioContextを初期化（ユーザーインタラクション後に作成）
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    init();
    currentPiece = createPiece();
    nextPiece = createPiece();
    gameRunning = true;
    gamePaused = false;
    overlay.classList.add('hidden');
    drawNextPiece();
    
    if (bgmToggle.checked) {
        startBGM();
    }
    
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

// ゲームループ
function gameLoop(time = 0) {
    if (!gameRunning) return;
    
    if (!gamePaused) {
        const deltaTime = time - lastTime;
        lastTime = time;
        dropCounter += deltaTime;
        
        if (dropCounter > dropInterval) {
            drop();
        }
        
        drawBoard();
        drawPiece();
    }
    
    requestAnimationFrame(gameLoop);
}

// BGMを開始
function startBGM() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    stopBGM(); // 既存のBGMを停止
    
    bgmGain = audioContext.createGain();
    bgmGain.gain.value = 0.1;
    bgmGain.connect(audioContext.destination);
    
    // シンプルなメロディ
    const notes = [659, 494, 523, 587, 523, 494, 440, 440, 523, 659, 587, 523, 494];
    let noteIndex = 0;
    
    function playNote() {
        if (!bgmToggle.checked || !gameRunning) {
            stopBGM();
            return;
        }
        
        bgmOscillator = audioContext.createOscillator();
        bgmOscillator.type = 'square';
        bgmOscillator.frequency.value = notes[noteIndex];
        bgmOscillator.connect(bgmGain);
        bgmOscillator.start();
        bgmOscillator.stop(audioContext.currentTime + 0.3);
        
        noteIndex = (noteIndex + 1) % notes.length;
        
        bgmTimeout = setTimeout(playNote, 300);
    }
    
    playNote();
}

// BGMを停止
function stopBGM() {
    if (bgmTimeout) {
        clearTimeout(bgmTimeout);
        bgmTimeout = null;
    }
    if (bgmOscillator) {
        try {
            bgmOscillator.stop();
        } catch (e) {
            // Already stopped
        }
        bgmOscillator = null;
    }
}

// 効果音を再生
function playSFX(type) {
    if (!sfxToggle.checked) return;
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    gainNode.gain.value = 0.15;
    
    switch (type) {
        case 'move':
            oscillator.frequency.value = 200;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.05);
            break;
        case 'rotate':
            oscillator.frequency.value = 400;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.08);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.08);
            break;
        case 'drop':
            oscillator.frequency.value = 150;
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'clear':
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'gameover':
            oscillator.frequency.value = 100;
            oscillator.type = 'sawtooth';
            gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
            break;
    }
}

// キーボードイベント
document.addEventListener('keydown', (e) => {
    if (!gameRunning) return;
    
    if (gamePaused) {
        if (e.key === 'p' || e.key === 'P') {
            togglePause();
        }
        return;
    }
    
    switch (e.key) {
        case 'ArrowLeft':
            move(-1);
            break;
        case 'ArrowRight':
            move(1);
            break;
        case 'ArrowDown':
            drop();
            break;
        case 'ArrowUp':
            rotate();
            break;
        case ' ':
            e.preventDefault();
            hardDrop();
            break;
        case 'p':
        case 'P':
            togglePause();
            break;
    }
});

// ポーズ切り替え
function togglePause() {
    if (!gameRunning) return;
    
    gamePaused = !gamePaused;
    
    if (gamePaused) {
        overlayTitle.textContent = 'ポーズ中';
        overlayMessage.textContent = 'Pキーで再開';
        startButton.style.display = 'none';
        retryButton.style.display = 'none';
        overlay.classList.remove('hidden');
        stopBGM();
    } else {
        overlay.classList.add('hidden');
        lastTime = performance.now();
        if (bgmToggle.checked) {
            startBGM();
        }
    }
}

// BGMトグル
bgmToggle.addEventListener('change', () => {
    if (bgmToggle.checked && gameRunning && !gamePaused) {
        startBGM();
    } else {
        stopBGM();
    }
});

// イベントリスナー
startButton.addEventListener('click', startGame);
retryButton.addEventListener('click', startGame);

// 初期描画
init();
drawBoard();

