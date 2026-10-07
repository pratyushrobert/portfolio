import { useEffect, useRef, useState, useCallback } from 'react';
import { unlockDiscovery } from '../../lib/discovery';
import './SnakeGame.css';

const GRID_SIZE = 18;
const CELL_SIZE = 20; // 18 * 20 = 360px
const INITIAL_SPEED = 120; // ms per tick

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
interface Point {
  x: number;
  y: number;
}

export function SnakeGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem('mimios_snake_highscore') || '0', 10) || 0;
    } catch {
      return 0;
    }
  });
  const [gameOver, setGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const snakeRef = useRef<Point[]>([
    { x: 9, y: 9 },
    { x: 9, y: 10 },
    { x: 9, y: 11 },
  ]);
  const directionRef = useRef<Direction>('UP');
  const nextDirectionRef = useRef<Direction>('UP');
  const foodRef = useRef<Point>({ x: 5, y: 5 });
  const gameLoopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spawnFood = useCallback((currentSnake: Point[]): Point => {
    const occupied = new Set(currentSnake.map(p => `${p.x},${p.y}`));
    const emptyCells: Point[] = [];
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x},${y}`)) {
          emptyCells.push({ x, y });
        }
      }
    }
    if (emptyCells.length === 0) return { x: 0, y: 0 };
    return emptyCells[Math.floor(Math.random() * emptyCells.length)];
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = '#181825';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw Food (Cyber Neon Orb / Cat Treat)
    const food = foodRef.current;
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(
      food.x * CELL_SIZE + CELL_SIZE / 2,
      food.y * CELL_SIZE + CELL_SIZE / 2,
      CELL_SIZE / 2.5,
      0,
      Math.PI * 2
    );
    ctx.fill();
    ctx.shadowBlur = 0; // reset blur

    // Draw Snake
    const snake = snakeRef.current;
    snake.forEach((part, index) => {
      if (index === 0) {
        // Head
        ctx.fillStyle = '#f1f5f9';
        ctx.shadowColor = '#cbd5e1';
        ctx.shadowBlur = 6;
      } else {
        // Body gradient
        ctx.fillStyle = index % 2 === 0 ? '#94a3b8' : '#64748b';
        ctx.shadowBlur = 0;
      }

      ctx.beginPath();
      ctx.roundRect(
        part.x * CELL_SIZE + 1.5,
        part.y * CELL_SIZE + 1.5,
        CELL_SIZE - 3,
        CELL_SIZE - 3,
        index === 0 ? 5 : 3
      );
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }, []);

  const resetGame = useCallback(() => {
    snakeRef.current = [
      { x: 9, y: 9 },
      { x: 9, y: 10 },
      { x: 9, y: 11 },
    ];
    directionRef.current = 'UP';
    nextDirectionRef.current = 'UP';
    foodRef.current = spawnFood(snakeRef.current);
    setScore(0);
    setGameOver(false);
    setIsPaused(false);
    setHasStarted(true);
    unlockDiscovery('retro_gamer');
  }, [spawnFood]);

  const tick = useCallback(() => {
    if (gameOver || isPaused || !hasStarted) return;

    directionRef.current = nextDirectionRef.current;
    const dir = directionRef.current;
    const snake = [...snakeRef.current];
    const head = { ...snake[0] };

    switch (dir) {
      case 'UP':
        head.y -= 1;
        break;
      case 'DOWN':
        head.y += 1;
        break;
      case 'LEFT':
        head.x -= 1;
        break;
      case 'RIGHT':
        head.x += 1;
        break;
    }

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      setGameOver(true);
      return;
    }

    // Self collision
    if (snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      setGameOver(true);
      return;
    }

    snake.unshift(head);

    // Food collision
    if (head.x === foodRef.current.x && head.y === foodRef.current.y) {
      const newScore = score + 10;
      setScore(newScore);
      if (newScore > highScore) {
        setHighScore(newScore);
        try {
          localStorage.setItem('mimios_snake_highscore', String(newScore));
        } catch {
          // ignore
        }
      }
      foodRef.current = spawnFood(snake);
    } else {
      snake.pop();
    }

    snakeRef.current = snake;
    draw();

    // Speed calculation
    const currentSpeed = Math.max(70, INITIAL_SPEED - Math.floor(score / 50) * 8);
    gameLoopTimerRef.current = setTimeout(tick, currentSpeed);
  }, [gameOver, isPaused, hasStarted, score, highScore, spawnFood, draw]);

  useEffect(() => {
    if (hasStarted && !gameOver && !isPaused) {
      gameLoopTimerRef.current = setTimeout(tick, INITIAL_SPEED);
    }
    return () => {
      if (gameLoopTimerRef.current) clearTimeout(gameLoopTimerRef.current);
    };
  }, [hasStarted, gameOver, isPaused, tick]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (!hasStarted) {
        if (e.key === ' ' || e.key === 'Enter') {
          resetGame();
        }
        return;
      }

      if (gameOver) {
        if (e.key === 'r' || e.key === 'R' || e.key === 'Enter' || e.key === ' ') {
          resetGame();
        }
        return;
      }

      if (e.key === ' ') {
        setIsPaused(prev => !prev);
        return;
      }

      const cur = directionRef.current;
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          if (cur !== 'DOWN') nextDirectionRef.current = 'UP';
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          if (cur !== 'UP') nextDirectionRef.current = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          if (cur !== 'RIGHT') nextDirectionRef.current = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          if (cur !== 'LEFT') nextDirectionRef.current = 'RIGHT';
          break;
        case 'r':
        case 'R':
          resetGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasStarted, gameOver, resetGame]);

  return (
    <div className="snake-game-container">
      <div className="snake-header">
        <span className="snake-score-badge">SCORE: {score}</span>
        <span className="snake-highscore-badge">HIGH: {highScore}</span>
      </div>

      <div className="snake-canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={GRID_SIZE * CELL_SIZE}
          height={GRID_SIZE * CELL_SIZE}
          className="snake-canvas"
        />

        {!hasStarted && (
          <div className="snake-overlay">
            <h3 style={{ color: '#f8fafc' }}>Mimi Snake</h3>
            <p>Control the neural snake, harvest data packets, and avoid wall collision.</p>
            <button className="snake-btn" onClick={resetGame}>
              START GAME (SPACE)
            </button>
          </div>
        )}

        {gameOver && (
          <div className="snake-overlay">
            <h3>SIGNAL TERMINATED</h3>
            <p>Final Score: {score}</p>
            <button className="snake-btn" onClick={resetGame}>
              PLAY AGAIN (R)
            </button>
          </div>
        )}

        {isPaused && hasStarted && !gameOver && (
          <div className="snake-overlay">
            <h3 style={{ color: '#feca57' }}>PAUSED</h3>
            <p>Press Space to resume transmission</p>
            <button className="snake-btn" onClick={() => setIsPaused(false)}>
              RESUME
            </button>
          </div>
        )}
      </div>

      <div className="snake-footer">
        <div className="snake-controls-hint">
          <span><span className="snake-key">W/A/S/D</span> or <span className="snake-key">ARROWS</span>: Move</span>
        </div>
        <div className="snake-controls-hint">
          <span><span className="snake-key">SPACE</span>: Pause</span>
          <span><span className="snake-key">R</span>: Restart</span>
        </div>
      </div>
    </div>
  );
}
