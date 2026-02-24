// 资源加载器
import type { GameAssets } from '@/types/game';

export class AssetLoader {
  private assets: Partial<GameAssets> = {};
  private loadedCount: number = 0;
  private totalCount: number = 0;
  private onProgress?: (progress: number) => void;
  private onComplete?: () => void;

  // 图片资源路径
  private imagePaths: Record<string, string> = {
    // 单位
    'playerFighter': '/assets/player-fighter.png',
    'playerTank': '/assets/unit-tank.png',
    'playerSoldier': '/assets/unit-soldier.png',
    'enemyPlane': '/assets/enemy-plane.png',
    'zombie': '/assets/zombie.png',
    'zombieBoss': '/assets/zombie-boss.png',
    'neutralUnit': '/assets/neutral-unit.png',
    
    // 基地
    'playerBase': '/assets/base.png',
    'enemyBase': '/assets/enemy-base.png',
    
    // 建筑
    'turret': '/assets/turret.png',
    'electricWall': '/assets/electric-wall.png',
    
    // 资源
    'steelBar': '/assets/steel-bar.png',
    'cement': '/assets/cement.png',
    'chip': '/assets/chip.png',
    'crystal': '/assets/crystal.png',
    'fuel': '/assets/fuel.png',
    'ammo': '/assets/ammo.png',
    
    // 特效
    'magicFire': '/assets/magic-fire.png',
    'magicIce': '/assets/magic-ice.png',
    'magicWater': '/assets/magic-water.png',
    'planeExplosion': '/assets/plane-explosion.png',
    'bullet': '/assets/bullet.png',
    'missile': '/assets/missile.png',
    
    // 背景
    'bgSnow1': '/assets/bg-snow1.jpg',
    'bgSnow2': '/assets/bg-snow2.jpg',
    'bgSnow3': '/assets/bg-snow3.jpg',
    'victoryBg': '/assets/victory-bg.jpg',
    'gameoverBg': '/assets/gameover-bg.jpg',
    
    // UI
    'logo': '/assets/logo.png',
    'cardFighter': '/assets/card-fighter.png',
    'cardTank': '/assets/card-tank.png',
    'cardSoldier': '/assets/card-soldier.png',
    'soundOn': '/assets/sound-on.png',
    'soundOff': '/assets/sound-off.png',
  };

  constructor(onProgress?: (progress: number) => void, onComplete?: () => void) {
    this.onProgress = onProgress;
    this.onComplete = onComplete;
  }

  async loadAll(): Promise<GameAssets> {
    const entries = Object.entries(this.imagePaths);
    this.totalCount = entries.length;

    const promises = entries.map(([key, path]) => this.loadImage(key, path));
    await Promise.all(promises);

    return this.assets as GameAssets;
  }

  private loadImage(key: string, path: string): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        (this.assets as Record<string, HTMLImageElement>)[key] = img;
        this.loadedCount++;
        const progress = this.loadedCount / this.totalCount;
        this.onProgress?.(progress);
        if (this.loadedCount >= this.totalCount) {
          this.onComplete?.();
        }
        resolve();
      };
      img.onerror = () => {
        console.warn(`Failed to load image: ${path}`);
        this.loadedCount++;
        resolve();
      };
      img.src = path;
    });
  }

  getAssets(): GameAssets {
    return this.assets as GameAssets;
  }
}

let globalAssets: GameAssets | null = null;

export function setGlobalAssets(assets: GameAssets) {
  globalAssets = assets;
}

export function getGlobalAssets(): GameAssets | null {
  return globalAssets;
}
