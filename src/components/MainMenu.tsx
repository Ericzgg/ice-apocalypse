// 主菜单组件 v3.0
import { useState, useEffect } from 'react';
import { UnitType, GameState } from '@/types/game';
import { audioManager } from '@/game/AudioManager';
import { getGlobalAssets } from '@/game/AssetLoader';

interface MainMenuProps {
  onStartGame: (unitType: UnitType, enemyCount: number, backgroundIndex: number, touchEnabled: boolean) => void;
  onContinueGame?: () => void;
  gameState: GameState;
}

export function MainMenu({ onStartGame, onContinueGame, gameState }: MainMenuProps) {
  const [selectedUnit, setSelectedUnit] = useState<UnitType>(UnitType.FIGHTER);
  const [enemyCount, setEnemyCount] = useState<number>(3);
  const [backgroundIndex, setBackgroundIndex] = useState<number>(1); // 默认选择第二个冰原地图
  const [touchEnabled, setTouchEnabled] = useState<boolean>(true); // 默认启用触屏控制
  const [showInstructions, setShowInstructions] = useState(false);
  const [isMuted, setIsMuted] = useState(audioManager.getIsMuted());
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const assets = getGlobalAssets();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const toggleMute = () => {
    const newMuted = audioManager.toggleMute();
    setIsMuted(newMuted);
  };

  const handleStart = () => {
    audioManager.playSound('click');
    onStartGame(selectedUnit, enemyCount, backgroundIndex, touchEnabled);
  };

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900 z-50">
        <div className="text-4xl font-bold text-blue-400 mb-6">极寒末世</div>
        <div className="text-xl text-gray-400 mb-4">加载资源中... {Math.floor(loadingProgress * 100)}%</div>
        <div className="w-80 h-4 bg-gray-700 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${loadingProgress * 100}%` }} />
        </div>
      </div>
    );
  }

  if (gameState === GameState.VICTORY) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
        style={{
          backgroundImage: assets?.victoryBg ? `url(${assets.victoryBg.src})` : 'linear-gradient(135deg, #1a5f1a 0%, #0d3d0d 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-7xl font-bold text-yellow-400 mb-4 drop-shadow-lg">胜利！</h1>
          <p className="text-2xl text-white mb-2">火箭发射成功！你赢得了游戏！</p>
          <div className="flex gap-4 mt-8">
            <button
              onClick={() => { audioManager.playSound('click'); onStartGame(selectedUnit, enemyCount, backgroundIndex, touchEnabled); }}
              className="px-8 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg border-2 border-green-400"
            >
              重新开始
            </button>
            <button
              onClick={() => { audioManager.playSound('click'); onContinueGame?.(); }}
              className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg border-2 border-blue-400"
            >
              继续游玩
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center z-50"
        style={{
          backgroundImage: assets?.gameoverBg ? `url(${assets.gameoverBg.src})` : 'linear-gradient(135deg, #3d0d0d 0%, #1a0505 100%)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}>
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-7xl font-bold text-red-500 mb-4 drop-shadow-lg">游戏结束</h1>
          <p className="text-2xl text-white mb-2">你的基地被攻破了...</p>
          <button
            onClick={handleStart}
            className="mt-8 px-10 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg border-2 border-red-400"
          >
            重新挑战
          </button>
        </div>
      </div>
    );
  }

  if (showInstructions) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 p-8">
        <div className="max-w-2xl w-full bg-gray-900/90 rounded-2xl p-8 border-2 border-blue-500">
          <h2 className="text-4xl font-bold text-white mb-8 text-center">游戏说明</h2>
          <div className="text-gray-300 space-y-3 text-lg">
            <p><span className="text-green-400 font-bold">WASD / 虚拟摇杆</span> - 移动</p>
            <p><span className="text-green-400 font-bold">鼠标 / 射击按钮</span> - 射击</p>
            <p><span className="text-green-400 font-bold">M / 导弹按钮</span> - 追踪导弹</p>
            <p><span className="text-green-400 font-bold">1/2/3</span> - 火球/水流/冰锥魔法</p>
            <p><span className="text-green-400 font-bold">B</span> - 建造菜单</p>
            <p><span className="text-green-400 font-bold">F / 点击基地</span> - 基地菜单（升级/制造）</p>
            <p><span className="text-green-400 font-bold">X</span> - 招募附近的小弟</p>
            <p><span className="text-green-400 font-bold">I</span> - 背包</p>
            <p><span className="text-green-400 font-bold">ESC</span> - 存档/加载菜单</p>
            <p><span className="text-green-400 font-bold">滚轮</span> - 缩放地图</p>
          </div>
          <div className="mt-6 p-4 bg-blue-900/50 rounded-lg">
            <p className="text-yellow-400 font-bold">游戏目标：</p>
            <p className="text-gray-300">消灭所有敌方基地，保护我方基地不被攻破！</p>
            <p className="text-gray-300">在基地制造飞机坦克，按X招募它们跟随你战斗！</p>
            <p className="text-gray-300">上交材料升级火箭，获得最终胜利！</p>
            <p className="text-gray-300">每60秒会有一波尸潮来袭！</p>
          </div>
          <button
            onClick={() => { audioManager.playSound('click'); setShowInstructions(false); }}
            className="mt-8 w-full px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors"
          >
            返回
          </button>
        </div>
      </div>
    );
  }

  const unitCards = [
    { type: UnitType.FIGHTER, name: '战斗机', desc: '速度快，攻击力低', img: assets?.cardFighter },
    { type: UnitType.TANK, name: '坦克', desc: '速度慢，攻击力强', img: assets?.cardTank },
    { type: UnitType.SOLDIER, name: '强化士兵', desc: '均衡型单位', img: assets?.cardSoldier },
  ];

  const bgPreviews = [
    { name: '雪地', img: assets?.bgSnow1 },
    { name: '冰原', img: assets?.bgSnow2 },
    { name: '战场', img: assets?.bgSnow3 },
  ];

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-50 overflow-auto py-8">
      {/* 静音按钮 */}
      <button
        onClick={toggleMute}
        className="absolute top-6 right-6 w-12 h-12 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center transition-colors border-2 border-gray-600 z-50"
      >
        {assets && (
          <img src={isMuted ? assets.soundOff.src : assets.soundOn.src} alt="sound" className="w-8 h-8" />
        )}
      </button>

      {/* Logo */}
      {assets?.logo && <img src={assets.logo.src} alt="极寒末世" className="w-64 mb-4" />}
      <p className="text-xl text-blue-400 mb-6 tracking-widest">FROST ESCAPE v3.0</p>

      <div className="flex flex-col lg:flex-row gap-8 max-w-6xl w-full px-4">
        {/* 左侧 - 兵种选择 */}
        <div className="flex-1">
          <h3 className="text-white text-lg mb-4 text-center">选择兵种</h3>
          <div className="grid grid-cols-3 gap-3">
            {unitCards.map((card) => (
              <button
                key={card.type}
                onClick={() => { audioManager.playSound('click'); setSelectedUnit(card.type); }}
                className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                  selectedUnit === card.type
                    ? 'border-green-500 shadow-lg shadow-green-500/30'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                {card.img && (
                  <img src={card.img.src} alt={card.name} className="w-full h-32 object-cover" />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 p-2">
                  <p className="text-white font-bold text-sm">{card.name}</p>
                  <p className="text-gray-400 text-xs">{card.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 右侧 - 设置 */}
        <div className="w-full lg:w-80 space-y-4">
          {/* 敌方国家数量 */}
          <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-600">
            <h3 className="text-white text-sm mb-3">敌方国家数量</h3>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="10"
                value={enemyCount}
                onChange={(e) => setEnemyCount(parseInt(e.target.value))}
                className="flex-1"
              />
              <span className="text-white font-bold w-8">{enemyCount}</span>
            </div>
          </div>

          {/* 背景选择 */}
          <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-600">
            <h3 className="text-white text-sm mb-3">选择背景</h3>
            <div className="grid grid-cols-3 gap-2">
              {bgPreviews.map((bg, index) => (
                <button
                  key={index}
                  onClick={() => { audioManager.playSound('click'); setBackgroundIndex(index); }}
                  className={`relative rounded-lg overflow-hidden border-2 transition-all ${
                    backgroundIndex === index
                      ? 'border-blue-500'
                      : 'border-gray-600 hover:border-gray-500'
                  }`}
                >
                  {bg.img && <img src={bg.img.src} alt={bg.name} className="w-full h-16 object-cover" />}
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs text-center py-1">
                    {bg.name}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* 触屏控制 */}
          <div className="bg-gray-800/80 rounded-xl p-4 border border-gray-600">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={touchEnabled}
                onChange={(e) => setTouchEnabled(e.target.checked)}
                className="w-5 h-5"
              />
              <span className="text-white text-sm">启用触屏控制（平板/手机）</span>
            </label>
          </div>
        </div>
      </div>

      {/* 按钮 */}
      <div className="flex gap-4 mt-8">
        <button
          onClick={handleStart}
          className="px-10 py-4 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg border-2 border-green-400"
        >
          开始游戏
        </button>
        <button
          onClick={() => { audioManager.playSound('click'); setShowInstructions(true); }}
          className="px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all transform hover:scale-105 shadow-lg border-2 border-blue-400"
        >
          游戏说明
        </button>
      </div>
    </div>
  );
}
