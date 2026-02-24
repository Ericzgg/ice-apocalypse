import { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from '@/game/GameEngine';
import { MainMenu } from '@/components/MainMenu';
import { SaveLoadMenu } from '@/components/SaveLoadMenu';
import { AssetLoader, setGlobalAssets, getGlobalAssets } from '@/game/AssetLoader';
import { audioManager } from '@/game/AudioManager';
import { UnitType, GameState, type GameConfig } from '@/types/game';
import './App.css';

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameEngine | null>(null);
  const animationRef = useRef<number>(0);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [isMuted, setIsMuted] = useState(audioManager.getIsMuted());
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [gameConfig, setGameConfig] = useState<GameConfig>({
    mapWidth: 3000,
    mapHeight: 3000,
    enemyNationCount: 3,
    selectedBackground: 1, // 默认选择第二个冰原地图
    touchControlsEnabled: true, // 默认开启触屏控制
  });
  const assets = getGlobalAssets();

  // 加载资源
  useEffect(() => {
    const loader = new AssetLoader(
      (progress) => setLoadingProgress(progress),
      undefined
    );
    loader.loadAll().then((loadedAssets) => {
      setGlobalAssets(loadedAssets);
      setIsLoading(false);
    });
  }, []);

  // 初始化游戏引擎（只执行一次）
  useEffect(() => {
    if (!canvasRef.current || isLoading) return;

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const game = new GameEngine(canvas, gameConfig, (state) => {
      setGameState(state);
      if (state === GameState.VICTORY) {
        audioManager.playSound('victory');
      } else if (state === GameState.GAME_OVER) {
        audioManager.playSound('gameover');
      }
    });
    
    gameRef.current = game;

    let lastTime = performance.now();
    const gameLoop = (currentTime: number) => {
      const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;
      
      if (game.getGameState() === GameState.PLAYING) {
        game.update(deltaTime);
      }
      game.render();
      
      animationRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(animationRef.current);
    };
  }, [isLoading]);

  // 窗口大小调整
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStartGame = useCallback((unitType: UnitType, enemyCount: number, backgroundIndex: number, touchEnabled: boolean) => {
    const newConfig: GameConfig = {
      mapWidth: 3000,
      mapHeight: 3000,
      enemyNationCount: enemyCount,
      selectedBackground: backgroundIndex,
      touchControlsEnabled: touchEnabled,
    };
    setGameConfig(newConfig);
    
    // 使用现有的游戏引擎实例，只更新配置并初始化游戏
    if (gameRef.current) {
      gameRef.current.updateConfig(newConfig);
      gameRef.current.initGame(unitType);
      setGameState(GameState.PLAYING);
      audioManager.playBGM();
    }
  }, []);

  const toggleMute = () => {
    const newMuted = audioManager.toggleMute();
    setIsMuted(newMuted);
  };

  const toggleTouchControls = () => {
    setGameConfig(prev => ({
      ...prev,
      touchControlsEnabled: !prev.touchControlsEnabled
    }));
  };

  const handleSaveGame = (slot: number) => {
    if (gameRef.current) {
      return gameRef.current.saveGame(slot);
    }
    return false;
  };

  const handleLoadGame = (slot: number) => {
    if (gameRef.current) {
      return gameRef.current.loadGame(slot);
    }
    return false;
  };

  const handleDeleteSave = (slot: number) => {
    if (gameRef.current) {
      return gameRef.current.deleteSave(slot);
    }
    return false;
  };

  const getSaveSlots = () => {
    if (gameRef.current) {
      return gameRef.current.getSaveSlots();
    }
    return [];
  };

  const handleExitToMenu = () => {
    setShowSaveMenu(false);
    setGameState(GameState.MENU);
    audioManager.stopBGM();
  };

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-gray-900">
        <div className="text-4xl font-bold text-blue-400 mb-6">极寒末世 v4.0</div>
        <div className="text-xl text-gray-400 mb-4">加载资源中... {Math.floor(loadingProgress * 100)}%</div>
        <div className="w-80 h-4 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${loadingProgress * 100}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ cursor: gameState === GameState.PLAYING ? 'crosshair' : 'default' }}
      />
      
      {/* 主菜单 */}
      {(gameState === GameState.MENU || 
        gameState === GameState.VICTORY || 
        gameState === GameState.GAME_OVER) && (
        <MainMenu 
          onStartGame={handleStartGame} 
          onContinueGame={() => {
            // 继续游玩：切换到PLAYING状态，让游戏继续
            setGameState(GameState.PLAYING);
          }}
          gameState={gameState}
        />
      )}
      
      {/* 保存/加载菜单 */}
      {showSaveMenu && (
        <SaveLoadMenu
          onClose={() => setShowSaveMenu(false)}
          onSave={handleSaveGame}
          onLoad={handleLoadGame}
          onDelete={handleDeleteSave}
          onExit={handleExitToMenu}
          getSaveSlots={getSaveSlots}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          touchControlsEnabled={gameConfig.touchControlsEnabled}
          onToggleTouchControls={toggleTouchControls}
        />
      )}

      {/* 暂停菜单 - 现在直接打开存档菜单 */}
      {gameState === GameState.PAUSED && (
        <SaveLoadMenu
          onClose={() => setGameState(GameState.PLAYING)}
          onSave={handleSaveGame}
          onLoad={handleLoadGame}
          onDelete={handleDeleteSave}
          onExit={handleExitToMenu}
          getSaveSlots={getSaveSlots}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          touchControlsEnabled={gameConfig.touchControlsEnabled}
          onToggleTouchControls={toggleTouchControls}
        />
      )}

      {/* 游戏内控制按钮 */}
      {(gameState === GameState.PLAYING) && (
        <>
          {/* 保存按钮 - 右上角 */}
          <button
            onClick={() => setShowSaveMenu(true)}
            className="absolute top-4 right-4 w-10 h-10 bg-blue-800/80 hover:bg-blue-700/80 rounded-full flex items-center justify-center transition-colors border-2 border-blue-600 z-30"
            title="保存/加载游戏"
          >
            <span className="text-white text-lg">💾</span>
          </button>

          {/* 操作提示 - 左下角（触摸屏模式下隐藏） */}
          {!gameConfig.touchControlsEnabled && (
            <div className="absolute bottom-4 left-4 bg-black/60 rounded-lg p-3 text-white text-xs z-30">
              <p>WASD - 移动 | 鼠标 - 射击</p>
              <p>1/2/3 - 魔法 | B - 建造</p>
              <p>F - 基地菜单 | X - 招募</p>
              <p>I - 背包 | ESC - 存档</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
