// 游戏核心引擎 v4.0 - 极寒末世
import {
  GameState, UnitType, MagicType, BuildingType, ResourceType, Faction,
  type GameAssets, type GameConfig, type InputState, type PlayerUnit, type EnemyUnit, 
  type Zombie, type Nation, type Building, type ResourceItem, type Projectile, type MagicEffect, type Particle,
  type Vector2, type SaveData, type TouchControls, type Entity
} from '@/types/game';
import { getGlobalAssets } from './AssetLoader';
import { audioManager } from './AudioManager';

// 工具函数
const generateId = () => Math.random().toString(36).substr(2, 9);

const getDistance = (a: Vector2, b: Vector2): number => {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
};

// 游戏引擎类
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private gameState: GameState = GameState.MENU;
  private config: GameConfig;
  private assets: GameAssets | null = null;
  
  // 游戏实体
  private player: PlayerUnit | null = null;
  private nations: Map<string, Nation> = new Map();
  private zombies: Map<string, Zombie> = new Map();
  private buildings: Map<string, Building> = new Map();
  private resources: Map<string, ResourceItem> = new Map();
  private projectiles: Map<string, Projectile> = new Map();
  private magicEffects: Map<string, MagicEffect> = new Map();
  private particles: Map<string, Particle> = new Map();
  private playerUnits: Map<string, PlayerUnit> = new Map(); // 玩家制造的小弟
  
  // 输入状态
  private input: InputState = {
    up: false, down: false, left: false, right: false,
    shoot: false, missile: false, magic1: false, magic2: false, magic3: false, build: false,
    mouseX: 0, mouseY: 0,
    touchAimX: 0, touchAimY: 0, touchAiming: false,
    joystickX: 0, joystickY: 0, joystickActive: false
  };
  
  // 触摸追踪
  private moveTouchId: number | null = null;
  private aimTouchId: number | null = null;
  
  // 触屏控制
  private touchControls: TouchControls = {
    joystick: { active: false, centerX: 0, centerY: 0, currentX: 0, currentY: 0 },
    buttons: { shoot: false, missile: false, magic: false }
  };
  
  // 游戏数据
  private waveCountdown: number = 60;
  private waveNumber: number = 1;
  private gameTime: number = 0;
  private camera: Vector2 = { x: 0, y: 0 };
  private cameraZoom: number = 1;
  private minZoom: number = 0.5;
  private maxZoom: number = 1.5;
  
  // UI状态
  private selectedBuilding: BuildingType | null = null;
  private showBuildMenu: boolean = false;
  private showMagicMenu: boolean = false;
  private showBaseMenu: boolean = false;
  private showInventory: boolean = false;
  private selectedMagic: MagicType = MagicType.FIRE;
  private notifications: Array<{ text: string; time: number; color: string }> = [];
  
  // 基地菜单位置
  private baseMenuPosition: Vector2 = { x: 0, y: 0 };
  
  // 回调
  private onStateChange?: (state: GameState) => void;
  private onVictory?: () => void;
  private onGameOver?: () => void;
  private onExitToMenu?: () => void;

  constructor(canvas: HTMLCanvasElement, config: GameConfig, onStateChange?: (state: GameState) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.config = config;
    this.onStateChange = onStateChange;
    this.assets = getGlobalAssets();
    this.setupInput();
    this.setupTouchControls();
    this.setupMouseWheel();
  }

  // 更新游戏配置
  updateConfig(config: GameConfig) {
    const oldTouchEnabled = this.config.touchControlsEnabled;
    this.config = config;
    
    // 触摸屏设置发生变化时，更新事件监听器
    if (config.touchControlsEnabled !== oldTouchEnabled) {
      if (config.touchControlsEnabled) {
        this.setupTouchControls();
      } else {
        this.removeTouchControls();
      }
    }
  }
  
  // 移除触摸屏事件监听
  private removeTouchControls() {
    this.canvas.removeEventListener('touchstart', (e) => this.handleTouchStart(e));
    this.canvas.removeEventListener('touchmove', (e) => this.handleTouchMove(e));
    this.canvas.removeEventListener('touchend', (e) => this.handleTouchEnd(e));
  }

  // 初始化游戏
  initGame(unitType: UnitType) {
    this.gameState = GameState.PLAYING;
    this.gameTime = 0;
    this.waveCountdown = 60;
    this.waveNumber = 1;
    this.cameraZoom = 1;
    
    // 清空实体
    this.nations.clear();
    this.zombies.clear();
    this.buildings.clear();
    this.resources.clear();
    this.projectiles.clear();
    this.magicEffects.clear();
    this.particles.clear();
    this.playerUnits.clear();
    
    // 创建玩家
    this.createPlayer(unitType);
    
    // 创建国家
    this.createNations();
    
    // 初始资源
    this.spawnInitialResources();
    
    this.onStateChange?.(GameState.PLAYING);
    audioManager.playBGM();
  }

  private createPlayer(unitType: UnitType) {
    const stats = this.getUnitStats(unitType);
    const playerBase = { x: this.config.mapWidth / 2, y: this.config.mapHeight / 2 };
    
    this.player = {
      id: 'player',
      position: { ...playerBase },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: stats.radius,
      faction: Faction.PLAYER,
      hp: stats.hp,
      maxHp: stats.hp,
      isDead: false,
      level: 1,
      unitType,
      speed: stats.speed,
      attackDamage: stats.damage,
      attackRange: stats.range,
      attackCooldown: stats.cooldown,
      currentCooldown: 0,
      magic: 100,
      maxMagic: 100,
      missiles: 5,
      maxMissiles: 10,
      overheat: 0,
      inventory: {
        [ResourceType.STEEL_BAR]: 20,
        [ResourceType.CEMENT]: 15,
        [ResourceType.CHIP]: 10,
        [ResourceType.ZOMBIE_CRYSTAL]: 0,
        [ResourceType.FUEL]: 10,
        [ResourceType.AMMO_BOX]: 5,
      },
      update: (deltaTime: number) => this.updatePlayer(deltaTime),
      render: (ctx: CanvasRenderingContext2D) => this.renderPlayer(ctx)
    };
  }

  private getUnitStats(unitType: UnitType) {
    switch (unitType) {
      case UnitType.FIGHTER:
        return { hp: 100, speed: 250, damage: 15, range: 300, cooldown: 0.15, radius: 25 };
      case UnitType.TANK:
        return { hp: 300, speed: 120, damage: 35, range: 250, cooldown: 0.2, radius: 35 };
      case UnitType.SOLDIER:
        return { hp: 150, speed: 180, damage: 25, range: 200, cooldown: 0.3, radius: 20 };
      default:
        return { hp: 100, speed: 200, damage: 20, range: 250, cooldown: 0.2, radius: 25 };
    }
  }

  private createNations() {
    // 玩家基地
    const playerBase: Nation = {
      id: 'player-base',
      faction: Faction.PLAYER,
      position: { x: this.config.mapWidth / 2, y: this.config.mapHeight / 2 },
      hp: 8000,
      maxHp: 8000,
      radius: 100,
      rocketProgress: 0,
      level: 1,
      units: new Map(),
      lastSpawnTime: 0,
      spawnInterval: 8000,
      maxUnits: 10,
      color: '#00ff00',
      name: '玩家基地',
      attackRange: 250,
      attackDamage: 15,
      attackCooldown: 0.8,
      currentCooldown: 0,
      defense: 1
    };
    this.nations.set('player-base', playerBase);

    // 初始化守卫检查时间和资源生产时间
    (playerBase as any).lastGuardCheck = Date.now();
    (playerBase as any).lastResourceProduction = Date.now();

    // 为玩家基地创建默认守卫（1辆坦克 + 1架飞机）
    this.createBaseGuard(playerBase, 'tank');
    this.createBaseGuard(playerBase, 'fighter');

    // 敌方国家
    const colors = ['#ff0000', '#ff8800', '#ff00ff', '#8800ff', '#00ffff', '#ffff00', '#ff4444', '#ff8844', '#ff44ff', '#8844ff'];
    const names = ['赤红帝国', '橙光联邦', '紫晶王国', '蓝月共和国', '青霜部落', '黄金联盟', '血牙军团', '烈焰氏族', '暗影组织', '冰霜盟约'];
    
    for (let i = 0; i < this.config.enemyNationCount; i++) {
      const angle = (i / Math.max(1, this.config.enemyNationCount)) * Math.PI * 2;
      const distance = Math.min(this.config.mapWidth, this.config.mapHeight) * 0.35;
      const x = this.config.mapWidth / 2 + Math.cos(angle) * distance;
      const y = this.config.mapHeight / 2 + Math.sin(angle) * distance;
      
      const nation: Nation = {
        id: `enemy-${i}`,
        faction: Faction.ENEMY_1 + i,
        position: { x, y },
        hp: 6000,
        maxHp: 6000,
        radius: 90,
        rocketProgress: 0,
        level: 1,
        units: new Map(),
        lastSpawnTime: 0,
        spawnInterval: 10000,
        maxUnits: 5,
        color: colors[i % colors.length],
        name: names[i % names.length],
        attackRange: 220,
        attackDamage: 12,
        attackCooldown: 1.0,
        currentCooldown: 0,
        defense: 1
      };
      this.nations.set(nation.id, nation);
    }
  }

  private spawnInitialResources() {
    for (let i = 0; i < 40; i++) {
      this.spawnRandomResource();
    }
  }

  private spawnRandomResource() {
    const types = Object.values(ResourceType);
    const type = types[Math.floor(Math.random() * types.length)];
    const x = Math.random() * (this.config.mapWidth - 200) + 100;
    const y = Math.random() * (this.config.mapHeight - 200) + 100;
    
    const resource: ResourceItem = {
      id: generateId(),
      position: { x, y },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: 20,
      faction: Faction.NEUTRAL,
      hp: 1,
      maxHp: 1,
      isDead: false,
      level: 1,
      resourceType: type,
      amount: Math.floor(Math.random() * 3) + 1,
      update: () => {},
      render: (ctx) => this.renderResource(ctx, resource)
    };
    this.resources.set(resource.id, resource);
  }

  // 输入处理
  private setupInput() {
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', () => this.handleMouseUp());
  }

  private setupMouseWheel() {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.cameraZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.cameraZoom * delta));
    }, { passive: false });
  }

  private handleKeyDown(e: KeyboardEvent) {
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': this.input.up = true; break;
      case 's': case 'arrowdown': this.input.down = true; break;
      case 'a': case 'arrowleft': this.input.left = true; break;
      case 'd': case 'arrowright': this.input.right = true; break;
      case ' ': this.input.shoot = true; break;
      case 'm': this.input.missile = true; break;
      case '1': this.input.magic1 = true; break;
      case '2': this.input.magic2 = true; break;
      case '3': this.input.magic3 = true; break;
      case 'b': this.toggleBuildMenu(); break;
      case 'v': this.toggleMagicMenu(); break;
      case 'i': this.showInventory = !this.showInventory; break;
      case 'f': this.toggleBaseMenu(); break;
      case 'x': this.recruitNearbyUnits(); break;
      case 'escape': this.handleEscape(); break;
    }
  }

  private handleKeyUp(e: KeyboardEvent) {
    switch (e.key.toLowerCase()) {
      case 'w': case 'arrowup': this.input.up = false; break;
      case 's': case 'arrowdown': this.input.down = false; break;
      case 'a': case 'arrowleft': this.input.left = false; break;
      case 'd': case 'arrowright': this.input.right = false; break;
      case ' ': this.input.shoot = false; break;
      case 'm': this.input.missile = false; break;
      case '1': this.input.magic1 = false; break;
      case '2': this.input.magic2 = false; break;
      case '3': this.input.magic3 = false; break;
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    this.input.mouseX = e.clientX - rect.left;
    this.input.mouseY = e.clientY - rect.top;
  }

  private handleMouseDown(e: MouseEvent) {
    // 检查是否点击基地菜单
    if (this.showBaseMenu) {
      this.handleBaseMenuClick(e);
      return;
    }
    
    // 检查是否点击基地
    if (e.button === 0) {
      const worldPos = this.screenToWorld(this.input.mouseX, this.input.mouseY);
      const playerBase = this.nations.get('player-base');
      if (playerBase && getDistance(worldPos, playerBase.position) < playerBase.radius) {
        this.toggleBaseMenu();
        return;
      }
    }
    
    if (e.button === 0) {
      this.input.shoot = true;
    }
  }

  private handleMouseUp() {
    this.input.shoot = false;
  }

  private handleEscape() {
    if (this.showBaseMenu) {
      this.showBaseMenu = false;
    } else if (this.showBuildMenu) {
      this.showBuildMenu = false;
    } else if (this.showMagicMenu) {
      this.showMagicMenu = false;
    } else if (this.showInventory) {
      this.showInventory = false;
    } else {
      this.onStateChange?.(GameState.PAUSED);
    }
  }

  // 触屏控制
  private setupTouchControls() {
    if (!this.config.touchControlsEnabled) return;
    
    this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
    this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
    this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
  }

  private handleTouchStart(e: TouchEvent) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // 如果基地菜单打开，处理菜单点击
      if (this.showBaseMenu) {
        this.handleTouchBaseMenuClick(x, y);
        return;
      }

      // 检查是否点击了基地（打开菜单）
      const playerBase = this.nations.get('player-base');
      if (playerBase && this.player) {
        const screenPos = this.worldToScreen(playerBase.position.x, playerBase.position.y);
        const dist = Math.sqrt((x - screenPos.x) ** 2 + (y - screenPos.y) ** 2);
        if (dist < playerBase.radius + 30) {
          this.toggleBaseMenu();
          return;
        }
      }

      // 左下角 - 虚拟摇杆（移动）
      if (x < this.canvas.width * 0.35 && y > this.canvas.height * 0.5 && this.moveTouchId === null) {
        this.moveTouchId = touch.identifier;
        const centerX = this.canvas.width * 0.12;
        const centerY = this.canvas.height * 0.82;
        this.input.joystickActive = true;
        this.input.joystickX = x - centerX;
        this.input.joystickY = y - centerY;
      }
      // 右侧区域 - 攻击方向控制（滑动控制瞄准+自动射击）
      else if (x > this.canvas.width * 0.5 && this.aimTouchId === null) {
        // 检查是否点击了导弹按钮或魔法按钮（在攻击圆圈上方）
        const aimCenterX = this.canvas.width - this.canvas.width * 0.12;
        const aimCenterY = this.canvas.height * 0.82;
        const missileX = aimCenterX - 45; // 偏左
        const missileY = aimCenterY - 75 - 45; // 攻击圆圈上方
        const magicX = aimCenterX + 45; // 偏右
        const magicY = aimCenterY - 75 - 45;
        const distToMissile = Math.sqrt((x - missileX) ** 2 + (y - missileY) ** 2);
        const distToMagic = Math.sqrt((x - magicX) ** 2 + (y - magicY) ** 2);

        if (distToMissile < 40) {
          // 点击了导弹按钮
          this.input.missile = true;
        } else if (distToMagic < 40) {
          // 点击了魔法按钮
          this.input.magic1 = true;
        } else {
          // 攻击区域
          this.aimTouchId = touch.identifier;
          this.input.touchAiming = true;
          this.input.touchAimX = x;
          this.input.touchAimY = y;
          this.input.shoot = true; // 自动开始射击
        }
      }
    }
  }

  // 处理触摸屏基地菜单点击
  private handleTouchBaseMenuClick(x: number, y: number) {
    const screenPos = this.worldToScreen(this.baseMenuPosition.x, this.baseMenuPosition.y);
    const buttonSize = 45;
    const buttonSpacing = 85;

    // 按钮位置：上、右、下、左
    const buttons = [
      { x: screenPos.x, y: screenPos.y - buttonSpacing, action: 'upgrade', label: '升级' },
      { x: screenPos.x + buttonSpacing, y: screenPos.y, action: 'plane', label: '飞机' },
      { x: screenPos.x, y: screenPos.y + buttonSpacing, action: 'tank', label: '坦克' },
      { x: screenPos.x - buttonSpacing, y: screenPos.y, action: 'rocket', label: '造火箭' }
    ];

    for (const btn of buttons) {
      const dist = Math.sqrt((x - btn.x) ** 2 + (y - btn.y) ** 2);
      if (dist < buttonSize) {
        this.executeBaseAction(btn.action);
        return;
      }
    }

    // 点击其他地方关闭菜单
    this.showBaseMenu = false;
  }

  private handleTouchMove(e: TouchEvent) {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;

      // 更新摇杆位置（移动）
      if (touch.identifier === this.moveTouchId) {
        const centerX = this.canvas.width * 0.15;
        const centerY = this.canvas.height * 0.8;
        this.input.joystickX = x - centerX;
        this.input.joystickY = y - centerY;
      }
      // 更新攻击方向（瞄准）
      else if (touch.identifier === this.aimTouchId) {
        this.input.touchAimX = x;
        this.input.touchAimY = y;
      }
    }
  }

  private handleTouchEnd(e: TouchEvent) {
    e.preventDefault();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      // 摇杆触摸结束
      if (touch.identifier === this.moveTouchId) {
        this.moveTouchId = null;
        this.input.joystickActive = false;
        this.input.joystickX = 0;
        this.input.joystickY = 0;
      }
      // 瞄准触摸结束
      else if (touch.identifier === this.aimTouchId) {
        this.aimTouchId = null;
        this.input.touchAiming = false;
        this.input.shoot = false; // 停止射击
      }
    }

    // 重置按钮状态（按钮是瞬时触发，不需要持续按住）
    this.input.missile = false;
    this.input.magic1 = false;
  }

  // 坐标转换
  private screenToWorld(screenX: number, screenY: number): Vector2 {
    return {
      x: (screenX - this.canvas.width / 2) / this.cameraZoom + this.camera.x + this.canvas.width / 2,
      y: (screenY - this.canvas.height / 2) / this.cameraZoom + this.camera.y + this.canvas.height / 2
    };
  }

  private worldToScreen(worldX: number, worldY: number): Vector2 {
    return {
      x: (worldX - this.camera.x - this.canvas.width / 2) * this.cameraZoom + this.canvas.width / 2,
      y: (worldY - this.camera.y - this.canvas.height / 2) * this.cameraZoom + this.canvas.height / 2
    };
  }

  // 基地菜单
  private toggleBaseMenu() {
    if (!this.player) return;
    const playerBase = this.nations.get('player-base');
    if (!playerBase) return;
    
    const dist = getDistance(this.player.position, playerBase.position);
    if (dist > playerBase.radius + 50 && !this.showBaseMenu) {
      this.addNotification('需要靠近基地才能打开菜单', '#ff4444');
      return;
    }
    
    this.showBaseMenu = !this.showBaseMenu;
    this.showBuildMenu = false;
    this.showMagicMenu = false;
    
    if (this.showBaseMenu) {
      this.baseMenuPosition = { ...playerBase.position };
    }
  }

  private handleBaseMenuClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    const screenPos = this.worldToScreen(this.baseMenuPosition.x, this.baseMenuPosition.y);
    const buttonSize = 50;
    const buttonSpacing = 70;
    
    // 按钮位置：上、右、下、左
    const buttons = [
      { x: screenPos.x, y: screenPos.y - buttonSpacing, action: 'upgrade', label: '升级基地' },
      { x: screenPos.x + buttonSpacing, y: screenPos.y, action: 'plane', label: '制造飞机' },
      { x: screenPos.x, y: screenPos.y + buttonSpacing, action: 'tank', label: '制造坦克' },
      { x: screenPos.x - buttonSpacing, y: screenPos.y, action: 'rocket', label: '造火箭' }
    ];
    
    for (const btn of buttons) {
      const dist = Math.sqrt((clickX - btn.x) ** 2 + (clickY - btn.y) ** 2);
      if (dist < buttonSize) {
        this.executeBaseAction(btn.action);
        return;
      }
    }
    
    this.showBaseMenu = false;
  }

  private executeBaseAction(action: string) {
    const playerBase = this.nations.get('player-base');
    if (!playerBase || !this.player) return;
    
    switch (action) {
      case 'upgrade':
        this.upgradeBase(playerBase);
        break;
      case 'plane':
        this.createPlayerUnit(UnitType.FIGHTER);
        break;
      case 'tank':
        this.createPlayerUnit(UnitType.TANK);
        break;
      case 'rocket':
        this.contributeToRocket();
        break;
    }
    this.showBaseMenu = false;
  }

  private upgradeBase(base: Nation) {
    const cost = { [ResourceType.STEEL_BAR]: 15, [ResourceType.CEMENT]: 10, [ResourceType.CHIP]: 8 };

    if (!this.canAfford(cost)) {
      this.addNotification('资源不足！需要: 钢筋×15 水泥×10 芯片×8', '#ff4444');
      return;
    }

    this.deductResources(cost);
    base.level++;

    // 保存升级前的血量比例
    const hpRatio = base.hp / base.maxHp;

    base.maxHp = Math.floor(base.maxHp * 1.3);
    // 按原比例同步血量，保持血条百分比不变
    base.hp = Math.floor(base.maxHp * hpRatio);
    // 额外恢复20%血量
    const healAmount = Math.floor(base.maxHp * 0.2);
    base.hp = Math.min(base.maxHp, base.hp + healAmount);

    base.defense *= 1.2;
    // 攻击力和攻击范围都提升
    base.attackDamage = Math.floor(base.attackDamage * 1.3);
    base.attackRange = Math.floor(base.attackRange * 1.15);
    // 体积扩大（基于等级持续变大，每级增加10%）
    const baseRadius = 100; // 基础半径
    base.radius = Math.floor(baseRadius * (1 + base.level * 0.1));

    this.addNotification(
      `基地升级到 Lv.${base.level}！血量+${healAmount} 攻击${base.attackDamage} 范围${base.attackRange} 体积${base.radius}`,
      '#00ff00'
    );
    audioManager.playSound('pickup');
  }

  private createPlayerUnit(unitType: UnitType) {
    const costs: Partial<Record<UnitType, Partial<Record<ResourceType, number>>>> = {
      [UnitType.FIGHTER]: { [ResourceType.STEEL_BAR]: 15, [ResourceType.CHIP]: 8, [ResourceType.FUEL]: 5 },
      [UnitType.TANK]: { [ResourceType.STEEL_BAR]: 20, [ResourceType.CEMENT]: 10, [ResourceType.CHIP]: 8, [ResourceType.FUEL]: 5 }
    };

    const cost = costs[unitType];
    if (!cost) {
      return;
    }

    // 检查资源并显示具体缺少的资源
    const resourceNames: Record<ResourceType, string> = {
      [ResourceType.STEEL_BAR]: '钢筋',
      [ResourceType.CEMENT]: '水泥',
      [ResourceType.CHIP]: '芯片',
      [ResourceType.ZOMBIE_CRYSTAL]: '丧尸晶格',
      [ResourceType.FUEL]: '燃料',
      [ResourceType.AMMO_BOX]: '弹药'
    };

    const missingResources: string[] = [];
    for (const [type, amount] of Object.entries(cost)) {
      const resourceType = type as ResourceType;
      const currentAmount = this.player?.inventory[resourceType] || 0;
      if (currentAmount < amount) {
        missingResources.push(`${resourceNames[resourceType]}×${amount - currentAmount}`);
      }
    }

    if (missingResources.length > 0) {
      const name = unitType === UnitType.FIGHTER ? '飞机' : '坦克';
      this.addNotification(`缺少: ${missingResources.join(' ')}`, '#ff4444');
      return;
    }

    // 限制小弟数量
    if (this.playerUnits.size >= 8) {
      this.addNotification('小弟数量已达上限(8个)！', '#ff4444');
      return;
    }

    this.deductResources(cost);

    const playerBase = this.nations.get('player-base');
    const stats = this.getUnitStats(unitType);

    const unit: PlayerUnit = {
      id: generateId(),
      position: {
        x: (playerBase?.position.x || 0) + (Math.random() - 0.5) * 100,
        y: (playerBase?.position.y || 0) + (Math.random() - 0.5) * 100
      },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: stats.radius,
      faction: Faction.PLAYER,
      hp: stats.hp,
      maxHp: stats.hp,
      isDead: false,
      level: 1,
      unitType,
      speed: stats.speed * 0.8,
      attackDamage: stats.damage * 0.7,
      attackRange: stats.range,
      attackCooldown: stats.cooldown,
      currentCooldown: 0,
      magic: 0,
      maxMagic: 0,
      missiles: 0,
      maxMissiles: 0,
      overheat: 0,
      inventory: {
        [ResourceType.STEEL_BAR]: 0,
        [ResourceType.CEMENT]: 0,
        [ResourceType.CHIP]: 0,
        [ResourceType.ZOMBIE_CRYSTAL]: 0,
        [ResourceType.FUEL]: 0,
        [ResourceType.AMMO_BOX]: 0,
      },
      update: () => {},
      render: () => {}
    };

    // 标记为已招募（自动跟随玩家）
    (unit as any).isRecruited = true;
    // 设置生存时间（2分钟 = 120秒）
    (unit as any).lifespan = 120;
    (unit as any).maxLifespan = 120;

    this.playerUnits.set(unit.id, unit);
    const name = unitType === UnitType.FIGHTER ? '飞机' : '坦克';
    this.addNotification(`${name}制造完成！存活2分钟`, '#00ff00');
    audioManager.playSound('pickup');
  }

  private contributeToRocket() {
    if (!this.player) return;
    const playerBase = this.nations.get('player-base');
    if (!playerBase) return;

    // 如果已经达到100%，提示胜利
    if (playerBase.rocketProgress >= 100) {
      this.addNotification('火箭已完成！准备发射！', '#00ff00');
      this.triggerVictory();
      return;
    }

    // 火箭建造需要累计200个材料才能达到100%
    // 每次可以上交任意数量的资源，每个资源增加0.5%进度
    const resources = [ResourceType.STEEL_BAR, ResourceType.CEMENT, ResourceType.CHIP, ResourceType.FUEL];
    const progressPerItem = 0.5; // 每个材料增加0.5%进度

    let contributed = false;
    let totalItems = 0;
    let contributedResources: string[] = [];
    const resourceNames: Record<string, string> = {
      [ResourceType.STEEL_BAR]: '钢筋',
      [ResourceType.CEMENT]: '水泥',
      [ResourceType.CHIP]: '芯片',
      [ResourceType.FUEL]: '燃料'
    };

    for (const type of resources) {
      if (this.player.inventory[type] > 0) {
        const amount = this.player.inventory[type];
        this.player.inventory[type] = 0;
        const progress = amount * progressPerItem;
        playerBase.rocketProgress += progress;
        totalItems += amount;
        contributed = true;
        contributedResources.push(`${resourceNames[type]}×${amount}`);
      }
    }

    if (contributed) {
      playerBase.rocketProgress = Math.min(100, playerBase.rocketProgress);
      this.addNotification(
        `火箭进度: ${playerBase.rocketProgress.toFixed(1)}% (+${totalItems}个材料) ${contributedResources.join(',')}`,
        '#00ff00'
      );
      audioManager.playSound('pickup');

      // 检查是否达到100%
      if (playerBase.rocketProgress >= 100) {
        this.addNotification('火箭建造完成！', '#00ff00');
        this.triggerVictory();
      }
    } else {
      this.addNotification(`火箭建造需要材料：钢筋、水泥、芯片、燃料（累计200个=100%）`, '#ff4444');
    }
  }

  // 触发胜利
  private triggerVictory() {
    this.gameState = GameState.VICTORY;
    this.addNotification('恭喜！火箭发射成功！你赢得了游戏！', '#00ff00');
  }

  // 招募小弟
  private recruitNearbyUnits() {
    if (!this.player) return;
    const player = this.player;
    
    let recruited = 0;
    this.playerUnits.forEach(unit => {
      if (unit.isDead) return;
      const dist = getDistance(player.position, unit.position);
      if (dist < 200) {
        // 标记为已招募（会在update中跟随）
        (unit as any).isRecruited = true;
        recruited++;
      }
    });
    
    if (recruited > 0) {
      this.addNotification(`招募了 ${recruited} 个小弟！`, '#00ff00');
    }
  }

  private canAfford(cost: Partial<Record<ResourceType, number>>): boolean {
    if (!this.player) return false;
    for (const [type, amount] of Object.entries(cost)) {
      if (this.player.inventory[type as ResourceType] < (amount || 0)) return false;
    }
    return true;
  }

  private deductResources(cost: Partial<Record<ResourceType, number>>) {
    if (!this.player) return;
    for (const [type, amount] of Object.entries(cost)) {
      this.player.inventory[type as ResourceType] -= (amount || 0);
    }
  }

  private toggleBuildMenu() {
    this.showBuildMenu = !this.showBuildMenu;
    this.showMagicMenu = false;
    this.showBaseMenu = false;
  }

  private toggleMagicMenu() {
    this.showMagicMenu = !this.showMagicMenu;
    this.showBuildMenu = false;
    this.showBaseMenu = false;
  }

  // 游戏更新
  update(deltaTime: number) {
    // 胜利后也可以继续更新游戏（让玩家可以继续游玩）
    if (this.gameState !== GameState.PLAYING && this.gameState !== GameState.VICTORY) return;
    
    this.gameTime += deltaTime;
    
    // 更新玩家
    if (this.player) {
      if (this.player.isDead) {
        this.respawnPlayer(deltaTime);
      } else {
        this.updatePlayer(deltaTime);
      }
    }
    
    // 更新玩家小弟
    this.playerUnits.forEach(unit => this.updatePlayerUnit(unit, deltaTime));
    
    // 更新丧尸波次
    this.updateWaveCountdown(deltaTime);
    
    // 更新丧尸
    this.zombies.forEach(zombie => this.updateZombie(zombie, deltaTime));
    
    // 更新敌方单位
    this.nations.forEach(nation => {
      nation.units.forEach(unit => this.updateEnemyUnit(unit, deltaTime));
    });
    
    // 更新投射物
    this.updateProjectiles(deltaTime);
    
    // 更新魔法效果
    this.updateMagicEffects(deltaTime);
    
    // 更新粒子
    this.updateParticles(deltaTime);
    
    // 更新建筑
    this.buildings.forEach(building => this.updateBuilding(building, deltaTime));
    
    // 更新国家AI（基地攻击）
    this.updateNationsAI(deltaTime);
    
    // 碰撞检测
    this.handleCollisions();
    
    // 清理死亡实体
    this.cleanupDeadEntities();
    
    // 更新相机
    this.updateCamera();
    
    // 更新通知
    this.updateNotifications(deltaTime);
    
    // 检查游戏结束条件
    this.checkGameEnd();
  }

  private respawnTimer: number = 0;
  
  private respawnPlayer(deltaTime: number) {
    this.respawnTimer += deltaTime;
    if (this.respawnTimer >= 3) {
      // 在基地重生
      const playerBase = this.nations.get('player-base');
      if (playerBase && this.player) {
        this.player.position = { ...playerBase.position };
        this.player.hp = this.player.maxHp * 0.5;
        this.player.isDead = false;
        this.respawnTimer = 0;
        this.addNotification('已在基地重生！', '#00ff00');
      }
    }
  }

  private updatePlayer(deltaTime: number) {
    if (!this.player || this.player.isDead) return;

    // 移动
    let dx = 0;
    let dy = 0;

    // 优先使用摇杆输入（触摸屏模式）
    if (this.input.joystickActive) {
      const maxJoystickDist = 60;
      const joystickDist = Math.sqrt(this.input.joystickX * this.input.joystickX + this.input.joystickY * this.input.joystickY);
      if (joystickDist > 10) { // 死区
        const clampedDist = Math.min(joystickDist, maxJoystickDist);
        const factor = clampedDist / maxJoystickDist;
        dx = (this.input.joystickX / joystickDist) * factor;
        dy = (this.input.joystickY / joystickDist) * factor;
      }
    } else {
      // 键盘输入
      if (this.input.up) dy -= 1;
      if (this.input.down) dy += 1;
      if (this.input.left) dx -= 1;
      if (this.input.right) dx += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const length = Math.sqrt(dx * dx + dy * dy);
      if (length > 0) {
        dx /= length;
        dy /= length;
        this.player.position.x += dx * this.player.speed * deltaTime;
        this.player.position.y += dy * this.player.speed * deltaTime;
      }

      // 边界限制
      this.player.position.x = Math.max(50, Math.min(this.config.mapWidth - 50, this.player.position.x));
      this.player.position.y = Math.max(50, Math.min(this.config.mapHeight - 50, this.player.position.y));
    }
    
    // 旋转朝向鼠标或触摸瞄准方向
    if (this.input.touchAiming) {
      // 使用触摸瞄准方向 - 计算触摸点相对于屏幕中心的角度
      const aimCenterX = this.canvas.width - 100;
      const aimCenterY = this.canvas.height * 0.55;
      const dx = this.input.touchAimX - aimCenterX;
      const dy = this.input.touchAimY - aimCenterY;
      this.player.rotation = Math.atan2(dy, dx);
    } else {
      // 使用鼠标方向
      const mouseWorldPos = this.screenToWorld(this.input.mouseX, this.input.mouseY);
      this.player.rotation = Math.atan2(mouseWorldPos.y - this.player.position.y, mouseWorldPos.x - this.player.position.x);
    }
    
    // 射击冷却
    if (this.player.currentCooldown > 0) {
      this.player.currentCooldown -= deltaTime;
    }
    
    // 自动射击
    if (this.input.shoot && this.player.currentCooldown <= 0) {
      this.fireBullet(this.player);
      audioManager.playSound('shoot');
    }
    
    // 魔法自动恢复（每秒5点）
    if (this.player.magic < this.player.maxMagic) {
      this.player.magic = Math.min(this.player.maxMagic, this.player.magic + 5 * deltaTime);
    }

    // 导弹（消耗30魔法）
    if (this.input.missile && this.player.magic >= 30 && this.player.currentCooldown <= 0) {
      this.fireMissile(this.player);
      this.player.magic -= 30;
      audioManager.playSound('shoot');
    }

    // 魔法攻击（消耗25魔法）
    if (this.input.magic1 && this.player.magic >= 25) {
      this.castMagic(MagicType.FIRE);
      this.player.magic -= 25;
      this.input.magic1 = false;
      audioManager.playSound('fire');
    }

    // 资源收集
    this.collectResources();
    
    // 回血（靠近基地）
    const playerBase = this.nations.get('player-base');
    if (playerBase && getDistance(this.player.position, playerBase.position) < playerBase.radius + 50) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 8 * deltaTime);
    }
  }

  private updatePlayerUnit(unit: PlayerUnit, deltaTime: number) {
    if (unit.isDead) return;

    // 处理生存时间
    if ((unit as any).lifespan !== undefined) {
      (unit as any).lifespan -= deltaTime;
      if ((unit as any).lifespan <= 0) {
        unit.isDead = true;
        this.addNotification('飞机燃料耗尽，已返航', '#888888');
        return;
      }
    }

    // 攻击冷却
    if (unit.currentCooldown > 0) {
      unit.currentCooldown -= deltaTime;
    }

    // 如果已招募，跟随玩家
    if ((unit as any).isRecruited && this.player && !this.player.isDead) {
      const dist = getDistance(unit.position, this.player.position);
      // 跟随距离：飞机保持150距离，坦克保持100距离
      const followDistance = unit.unitType === UnitType.FIGHTER ? 150 : 100;
      if (dist > followDistance) {
        const dx = this.player.position.x - unit.position.x;
        const dy = this.player.position.y - unit.position.y;
        // 使用deltaTime确保平滑移动，避免闪现
        const moveSpeed = unit.speed * 0.8 * deltaTime;
        const moveDist = Math.min(dist - followDistance, moveSpeed);
        if (moveDist > 0) {
          unit.position.x += (dx / dist) * moveDist;
          unit.position.y += (dy / dist) * moveDist;
        }
        unit.rotation = Math.atan2(dy, dx);
      }

      // 自动攻击范围内的敌人（包括僵尸和敌方基地）
      let nearestEnemy: Zombie | Nation | null = null;
      let minDist = unit.attackRange;

      // 寻找最近的僵尸
      this.zombies.forEach(zombie => {
        if (!zombie.isDead) {
          const d = getDistance(unit.position, zombie.position);
          if (d < minDist) {
            minDist = d;
            nearestEnemy = zombie;
          }
        }
      });

      // 如果没有找到僵尸，寻找敌方基地
      if (!nearestEnemy) {
        this.nations.forEach(nation => {
          if (nation.id !== 'player-base' && nation.hp > 0) {
            const d = getDistance(unit.position, nation.position);
            if (d < minDist) {
              minDist = d;
              nearestEnemy = nation;
            }
          }
        });
      }

      if (nearestEnemy && unit.currentCooldown <= 0) {
        const enemy = nearestEnemy as Zombie | Nation;
        unit.rotation = Math.atan2(enemy.position.y - unit.position.y, enemy.position.x - unit.position.x);
        this.fireBulletFromUnit(unit);
      }
    }
  }

  private fireBulletFromUnit(unit: PlayerUnit) {
    const projectile: Projectile = {
      id: generateId(),
      position: { ...unit.position },
      velocity: {
        x: Math.cos(unit.rotation) * 500,
        y: Math.sin(unit.rotation) * 500
      },
      rotation: unit.rotation,
      radius: 10, // 子弹尺寸变大
      faction: Faction.PLAYER,
      hp: 1,
      maxHp: 1,
      isDead: false,
      level: 1,
      damage: unit.attackDamage,
      speed: 500,
      lifetime: 2,
      maxLifetime: 2,
      owner: unit,
      type: 'bullet',
      update: () => {},
      render: () => {}
    };
    
    projectile.position.x += Math.cos(unit.rotation) * 30;
    projectile.position.y += Math.sin(unit.rotation) * 30;
    
    this.projectiles.set(projectile.id, projectile);
    unit.currentCooldown = unit.attackCooldown;
  }

  private updateEnemyUnit(unit: EnemyUnit, deltaTime: number) {
    if (unit.isDead) return;
    
    // 攻击冷却
    if (unit.currentCooldown > 0) {
      unit.currentCooldown -= deltaTime;
    }
    
    // 仇恨计时器
    if ((unit as any).hateTimer > 0) {
      (unit as any).hateTimer -= deltaTime;
      if ((unit as any).hateTimer <= 0) {
        unit.target = null;
      }
    }
    
    const nation = this.nations.get(unit.homeBaseId);
    if (!nation || nation.hp <= 0) {
      unit.isDead = true;
      return;
    }
    
    // 限制飞行区域
    const distFromBase = getDistance(unit.position, nation.position);
    if (distFromBase > 500) {
      // 返回基地方向
      const dx = nation.position.x - unit.position.x;
      const dy = nation.position.y - unit.position.y;
      unit.position.x += (dx / distFromBase) * unit.speed * deltaTime;
      unit.position.y += (dy / distFromBase) * unit.speed * deltaTime;
      unit.rotation = Math.atan2(dy, dx);
      return;
    }
    
    // AI状态机
    switch (unit.state) {
      case 'patrol':
        this.patrolBehavior(unit, nation, deltaTime);
        break;
      case 'combat':
        this.combatBehavior(unit, deltaTime);
        break;
      case 'return':
        this.returnBehavior(unit, nation, deltaTime);
        break;
    }
  }

  private patrolBehavior(unit: EnemyUnit, nation: Nation, deltaTime: number) {
    // 守卫在基地附近转圈巡逻
    const isGuard = (unit as any).isGuard;
    const patrolRadius = isGuard ? (unit as any).patrolRadius || 150 : 300;
    const patrolSpeed = isGuard ? 0.0008 : 0.0005; // 守卫转圈速度更快

    // 更新巡逻角度
    if (isGuard) {
      (unit as any).patrolAngle = ((unit as any).patrolAngle || 0) + patrolSpeed * deltaTime * 1000;
    }
    const angle = isGuard ? (unit as any).patrolAngle : (Date.now() / 2000 + parseInt(unit.id.slice(-3))) % (Math.PI * 2);

    const targetX = nation.position.x + Math.cos(angle) * patrolRadius;
    const targetY = nation.position.y + Math.sin(angle) * patrolRadius;

    const dx = targetX - unit.position.x;
    const dy = targetY - unit.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 5) {
      const moveSpeed = isGuard ? unit.speed * 0.8 : unit.speed * 0.5;
      unit.position.x += (dx / distance) * moveSpeed * deltaTime;
      unit.position.y += (dy / distance) * moveSpeed * deltaTime;
    }
    // 沿切线方向旋转（转圈效果）
    unit.rotation = angle + Math.PI / 2;

    // 检测敌人（守卫只保护基地，不主动追击太远）
    const detectionRange = isGuard ? patrolRadius + 100 : 250;

    // 检测僵尸
    this.zombies.forEach(zombie => {
      if (!zombie.isDead && getDistance(unit.position, zombie.position) < detectionRange) {
        unit.state = 'combat';
        unit.target = zombie;
        (unit as any).hateTimer = isGuard ? 5 : 10; // 守卫仇恨时间更短，优先回防
      }
    });

    // 检测敌方单位
    if (!isGuard || nation.id === 'player-base') {
      this.nations.forEach(otherNation => {
        if (otherNation.id === nation.id || otherNation.hp <= 0) return;
        otherNation.units.forEach(otherUnit => {
          if (!otherUnit.isDead && getDistance(unit.position, otherUnit.position) < detectionRange) {
            unit.state = 'combat';
            unit.target = otherUnit;
            (unit as any).hateTimer = isGuard ? 5 : 10;
          }
        });
      });
    }

    // 检测玩家（只有敌方单位会攻击玩家）
    if (nation.id !== 'player-base' && this.player && !this.player.isDead &&
        getDistance(unit.position, this.player.position) < detectionRange) {
      unit.state = 'combat';
      unit.target = this.player;
      (unit as any).hateTimer = 10;
    }

    // 检测玩家小弟
    if (nation.id !== 'player-base') {
      this.playerUnits.forEach(playerUnit => {
        if (!playerUnit.isDead && getDistance(unit.position, playerUnit.position) < detectionRange) {
          unit.state = 'combat';
          unit.target = playerUnit;
          (unit as any).hateTimer = 10;
        }
      });
    }
  }

  private combatBehavior(unit: EnemyUnit, deltaTime: number) {
    if (!unit.target || unit.target.isDead) {
      unit.state = 'return';
      unit.target = null;
      return;
    }
    
    const distance = getDistance(unit.position, unit.target.position);
    
    // 追击
    if (distance > unit.attackRange) {
      const dx = unit.target.position.x - unit.position.x;
      const dy = unit.target.position.y - unit.position.y;
      unit.position.x += (dx / distance) * unit.speed * deltaTime;
      unit.position.y += (dy / distance) * unit.speed * deltaTime;
      unit.rotation = Math.atan2(dy, dx);
    }
    
    // 攻击
    if (distance <= unit.attackRange && unit.currentCooldown <= 0) {
      this.fireBullet(unit);
      unit.currentCooldown = unit.attackCooldown;
    }
    
    // 血量低时撤退
    if (unit.hp < unit.maxHp * 0.3) {
      unit.state = 'return';
    }
  }

  private returnBehavior(unit: EnemyUnit, nation: Nation, deltaTime: number) {
    const dx = nation.position.x - unit.position.x;
    const dy = nation.position.y - unit.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > nation.radius) {
      unit.position.x += (dx / distance) * unit.speed * 1.5 * deltaTime;
      unit.position.y += (dy / distance) * unit.speed * 1.5 * deltaTime;
      unit.rotation = Math.atan2(dy, dx);
    } else {
      unit.hp = Math.min(unit.maxHp, unit.hp + 15 * deltaTime);
      if (unit.hp >= unit.maxHp * 0.8) {
        unit.state = 'patrol';
      }
    }
  }

  private updateWaveCountdown(deltaTime: number) {
    this.waveCountdown -= deltaTime;
    
    if (this.waveCountdown <= 0) {
      this.spawnZombieWave();
      this.waveCountdown = 60;
      this.waveNumber++;
    }
  }

  private spawnZombieWave() {
    const baseCount = 5 + this.waveNumber * 2;
    const bossCount = Math.floor(this.waveNumber / 3);
    
    for (let i = 0; i < baseCount; i++) {
      this.spawnZombie(false);
    }
    
    for (let i = 0; i < bossCount; i++) {
      this.spawnZombie(true);
    }
    
    this.addNotification(`第 ${this.waveNumber} 波尸潮来袭！`, '#ff4444');
    audioManager.playSound('horde');
  }

  private spawnZombie(isBoss: boolean) {
    const edge = Math.floor(Math.random() * 4);
    let x, y;
    switch (edge) {
      case 0: x = Math.random() * this.config.mapWidth; y = -50; break;
      case 1: x = this.config.mapWidth + 50; y = Math.random() * this.config.mapHeight; break;
      case 2: x = Math.random() * this.config.mapWidth; y = this.config.mapHeight + 50; break;
      default: x = -50; y = Math.random() * this.config.mapHeight; break;
    }
    
    const zombie: Zombie = {
      id: generateId(),
      position: { x, y },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: isBoss ? 40 : 20,
      faction: Faction.ZOMBIE,
      hp: isBoss ? 500 : 80,
      maxHp: isBoss ? 500 : 80,
      isDead: false,
      level: isBoss ? 5 : 1,
      state: 'idle',
      detectRange: isBoss ? 400 : 200,
      attackRange: isBoss ? 60 : 30,
      attackDamage: isBoss ? 30 : 10,
      attackCooldown: isBoss ? 1.5 : 1,
      currentCooldown: 0,
      target: null,
      wanderTarget: null,
      isBoss,
      ashTime: 0,
      update: () => {},
      render: () => {}
    };
    this.zombies.set(zombie.id, zombie);
  }

  private updateZombie(zombie: Zombie, deltaTime: number) {
    if (zombie.isDead) {
      zombie.ashTime -= deltaTime;
      return;
    }
    
    if (zombie.currentCooldown > 0) {
      zombie.currentCooldown -= deltaTime;
    }
    
    let nearestTarget: Entity | null = null;
    let minDistance = Infinity;
    
    if (this.player && !this.player.isDead) {
      const dist = getDistance(zombie.position, this.player.position);
      if (dist < zombie.detectRange && dist < minDistance) {
        minDistance = dist;
        nearestTarget = this.player;
      }
    }
    
    this.playerUnits.forEach(unit => {
      if (!unit.isDead) {
        const dist = getDistance(zombie.position, unit.position);
        if (dist < zombie.detectRange && dist < minDistance) {
          minDistance = dist;
          nearestTarget = unit;
        }
      }
    });
    
    this.nations.forEach(nation => {
      if (nation.id === 'player-base') return;
      nation.units.forEach(unit => {
        if (!unit.isDead) {
          const dist = getDistance(zombie.position, unit.position);
          if (dist < zombie.detectRange && dist < minDistance) {
            minDistance = dist;
            nearestTarget = unit;
          }
        }
      });
    });
    
    zombie.target = nearestTarget;
    
    if (zombie.target) {
      const dist = getDistance(zombie.position, zombie.target.position);
      
      if (dist <= zombie.attackRange) {
        zombie.state = 'attack';
        if (zombie.currentCooldown <= 0) {
          zombie.target.hp -= zombie.attackDamage;
          zombie.currentCooldown = zombie.attackCooldown;
          if (zombie.target.hp <= 0) {
            zombie.target.isDead = true;
          }
        }
      } else {
        zombie.state = 'chase';
        const dx = zombie.target.position.x - zombie.position.x;
        const dy = zombie.target.position.y - zombie.position.y;
        const speed = zombie.isBoss ? 40 : 25;
        zombie.position.x += (dx / dist) * speed * deltaTime;
        zombie.position.y += (dy / dist) * speed * deltaTime;
        zombie.rotation = Math.atan2(dy, dx);
      }
    } else {
      zombie.state = 'wander';
      if (!zombie.wanderTarget || getDistance(zombie.position, zombie.wanderTarget) < 10) {
        zombie.wanderTarget = {
          x: Math.random() * this.config.mapWidth,
          y: Math.random() * this.config.mapHeight
        };
      }
      const dx = zombie.wanderTarget.x - zombie.position.x;
      const dy = zombie.wanderTarget.y - zombie.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = zombie.isBoss ? 25 : 15;
      zombie.position.x += (dx / dist) * speed * deltaTime;
      zombie.position.y += (dy / dist) * speed * deltaTime;
      zombie.rotation = Math.atan2(dy, dx);
    }
  }

  private updateNationsAI(deltaTime: number) {
    this.nations.forEach(nation => {
      // 基地攻击
      if (nation.currentCooldown > 0) {
        nation.currentCooldown -= deltaTime;
      }
      
      if (nation.currentCooldown <= 0 && nation.hp > 0) {
        let nearestTarget: Entity | null = null;
        let minDist = nation.attackRange;
        
        // 玩家基地攻击丧尸和敌方单位
        if (nation.id === 'player-base') {
          this.zombies.forEach(zombie => {
            if (!zombie.isDead) {
              const dist = getDistance(nation.position, zombie.position);
              if (dist < minDist) {
                minDist = dist;
                nearestTarget = zombie;
              }
            }
          });
          
          this.nations.forEach(otherNation => {
            if (otherNation.id !== 'player-base' && otherNation.hp > 0) {
              otherNation.units.forEach(unit => {
                if (!unit.isDead) {
                  const dist = getDistance(nation.position, unit.position);
                  if (dist < minDist) {
                    minDist = dist;
                    nearestTarget = unit;
                  }
                }
              });
            }
          });
        } else {
          // 敌方基地攻击玩家和小弟
          if (this.player && !this.player.isDead) {
            const dist = getDistance(nation.position, this.player.position);
            if (dist < minDist) {
              minDist = dist;
              nearestTarget = this.player;
            }
          }
          
          this.playerUnits.forEach(unit => {
            if (!unit.isDead) {
              const dist = getDistance(nation.position, unit.position);
              if (dist < minDist) {
                minDist = dist;
                nearestTarget = unit;
              }
            }
          });
        }
        
        if (nearestTarget) {
          this.fireBulletFromBase(nation, nearestTarget);
          nation.currentCooldown = nation.attackCooldown;
        }
      }
      
      // 敌方国家生成单位
      if (nation.id !== 'player-base' && nation.hp > 0) {
        if (nation.units.size < nation.maxUnits && Date.now() - nation.lastSpawnTime > nation.spawnInterval) {
          this.spawnEnemyUnit(nation);
          nation.lastSpawnTime = Date.now();
        }
      }

      // 玩家基地补充守卫（每10秒检查一次）
      if (nation.id === 'player-base' && nation.hp > 0) {
        if (Date.now() - (nation as any).lastGuardCheck > 10000) {
          this.replenishBaseGuards(nation);
          (nation as any).lastGuardCheck = Date.now();
        }
      }

      // 玩家基地每10秒恢复1%血量
      if (nation.id === 'player-base' && nation.hp > 0 && nation.hp < nation.maxHp) {
        const lastHealTime = (nation as any).lastHealTime || 0;
        if (Date.now() - lastHealTime > 10000) { // 10秒
          const healAmount = Math.floor(nation.maxHp * 0.01); // 1%血量
          nation.hp = Math.min(nation.maxHp, nation.hp + healAmount);
          (nation as any).lastHealTime = Date.now();
          // 显示恢复提示（每30秒显示一次，避免频繁提示）
          const lastHealNotification = (nation as any).lastHealNotification || 0;
          if (Date.now() - lastHealNotification > 30000) {
            this.addNotification(`基地自动恢复 ${healAmount} 血量`, '#00ff00');
            (nation as any).lastHealNotification = Date.now();
          }
        }
      }

      // 玩家基地每分钟自动生产物资（5个/分钟 = 每12秒1个）
      if (nation.id === 'player-base' && nation.hp > 0 && this.player) {
        const lastResourceProduction = (nation as any).lastResourceProduction || 0;
        if (Date.now() - lastResourceProduction > 12000) { // 12秒 = 每分钟5个
          // 增加各类物资1个
          const resources = [
            ResourceType.STEEL_BAR,
            ResourceType.CEMENT,
            ResourceType.CHIP,
            ResourceType.FUEL,
            ResourceType.AMMO_BOX
          ];
          resources.forEach(type => {
            this.player!.inventory[type] = (this.player!.inventory[type] || 0) + 1;
          });
          (nation as any).lastResourceProduction = Date.now();
          this.addNotification('基地生产: 物资+1', '#00ff00');
        }
      }
    });
  }

  private fireBulletFromBase(nation: Nation, target: Entity) {
    const angle = Math.atan2(target.position.y - nation.position.y, target.position.x - nation.position.x);
    
    const projectile: Projectile = {
      id: generateId(),
      position: { ...nation.position },
      velocity: {
        x: Math.cos(angle) * 400,
        y: Math.sin(angle) * 400
      },
      rotation: angle,
      radius: 8,
      faction: nation.faction,
      hp: 1,
      maxHp: 1,
      isDead: false,
      level: 1,
      damage: nation.attackDamage,
      speed: 400,
      lifetime: 3,
      maxLifetime: 3,
      owner: nation as any,
      type: 'bullet',
      update: () => {},
      render: () => {}
    };
    
    projectile.position.x += Math.cos(angle) * (nation.radius + 10);
    projectile.position.y += Math.sin(angle) * (nation.radius + 10);
    
    this.projectiles.set(projectile.id, projectile);
  }

  private spawnEnemyUnit(nation: Nation) {
    // 限制最多5架
    if (nation.units.size >= 5) return;

    const angle = Math.random() * Math.PI * 2;
    const x = nation.position.x + Math.cos(angle) * (nation.radius + 30);
    const y = nation.position.y + Math.sin(angle) * (nation.radius + 30);

    const unit: EnemyUnit = {
      id: generateId(),
      position: { x, y },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: 25,
      faction: nation.faction,
      hp: 100,
      maxHp: 100,
      isDead: false,
      level: 1,
      homeBaseId: nation.id,
      state: 'patrol',
      target: null,
      attackDamage: 15,
      attackRange: 200,
      attackCooldown: 0.5,
      currentCooldown: 0,
      speed: 100,
      update: () => {},
      render: () => {}
    };
    nation.units.set(unit.id, unit);
  }

  // 创建基地守卫（坦克或飞机）
  private createBaseGuard(nation: Nation, type: 'tank' | 'fighter') {
    const angle = Math.random() * Math.PI * 2;
    const distance = nation.radius + 80;
    const x = nation.position.x + Math.cos(angle) * distance;
    const y = nation.position.y + Math.sin(angle) * distance;

    const isTank = type === 'tank';
    const guard: EnemyUnit = {
      id: `guard-${type}-${generateId()}`,
      position: { x, y },
      velocity: { x: 0, y: 0 },
      rotation: 0,
      radius: isTank ? 30 : 25,
      faction: nation.faction,
      hp: isTank ? 200 : 150,
      maxHp: isTank ? 200 : 150,
      isDead: false,
      level: 1,
      homeBaseId: nation.id,
      state: 'patrol',
      target: null,
      attackDamage: isTank ? 25 : 20,
      attackRange: isTank ? 250 : 220,
      attackCooldown: isTank ? 0.8 : 0.5,
      currentCooldown: 0,
      speed: isTank ? 80 : 120,
      update: () => {},
      render: () => {}
    };

    // 标记为守卫
    (guard as any).isGuard = true;
    (guard as any).guardType = type;
    (guard as any).patrolAngle = angle;
    (guard as any).patrolRadius = 150; // 巡逻半径

    nation.units.set(guard.id, guard);
    this.addNotification(`基地${isTank ? '坦克' : '飞机'}守卫已就位`, '#00ff00');
  }

  // 补充基地守卫
  private replenishBaseGuards(nation: Nation) {
    if (nation.id !== 'player-base') return;

    let hasTankGuard = false;
    let hasFighterGuard = false;

    nation.units.forEach(unit => {
      if ((unit as any).isGuard && !unit.isDead) {
        if ((unit as any).guardType === 'tank') hasTankGuard = true;
        if ((unit as any).guardType === 'fighter') hasFighterGuard = true;
      }
    });

    // 补充死亡的守卫
    if (!hasTankGuard) {
      this.createBaseGuard(nation, 'tank');
    }
    if (!hasFighterGuard) {
      this.createBaseGuard(nation, 'fighter');
    }
  }

  private fireBullet(owner: PlayerUnit | EnemyUnit) {
    const isPlayer = 'unitType' in owner;
    const speed = isPlayer ? 600 : 400;
    const damage = owner.attackDamage;

    const projectile: Projectile = {
      id: generateId(),
      position: { ...owner.position },
      velocity: {
        x: Math.cos(owner.rotation) * speed,
        y: Math.sin(owner.rotation) * speed
      },
      rotation: owner.rotation,
      radius: 10, // 子弹尺寸变大（原来是5）
      faction: owner.faction,
      hp: 1,
      maxHp: 1,
      isDead: false,
      level: 1,
      damage,
      speed,
      lifetime: 2,
      maxLifetime: 2,
      owner,
      type: 'bullet',
      update: () => {},
      render: () => {}
    };
    
    projectile.position.x += Math.cos(owner.rotation) * 30;
    projectile.position.y += Math.sin(owner.rotation) * 30;
    
    this.projectiles.set(projectile.id, projectile);
    
    if (isPlayer) {
      (owner as PlayerUnit).currentCooldown = (owner as PlayerUnit).attackCooldown;
    }
  }

  private fireMissile(owner: PlayerUnit) {
    // 寻找最近的敌人作为目标
    let nearestEnemy: Zombie | Nation | null = null;
    let minDist = 600; // 导弹锁定范围

    // 寻找最近的僵尸
    this.zombies.forEach(zombie => {
      if (!zombie.isDead) {
        const d = getDistance(owner.position, zombie.position);
        if (d < minDist) {
          minDist = d;
          nearestEnemy = zombie;
        }
      }
    });

    // 如果没有找到僵尸，寻找敌方基地
    if (!nearestEnemy) {
      this.nations.forEach(nation => {
        if (nation.id !== 'player-base' && nation.hp > 0) {
          const d = getDistance(owner.position, nation.position);
          if (d < minDist) {
            minDist = d;
            nearestEnemy = nation;
          }
        }
      });
    }

    // 如果没有找到敌人，朝玩家面向方向发射
    const target = nearestEnemy;

    const projectile: Projectile = {
      id: generateId(),
      position: { ...owner.position },
      velocity: {
        x: Math.cos(owner.rotation) * 300,
        y: Math.sin(owner.rotation) * 300
      },
      rotation: owner.rotation,
      radius: 10,
      faction: owner.faction,
      hp: 1,
      maxHp: 1,
      isDead: false,
      level: 1,
      damage: owner.attackDamage * 5, // 提高攻击力
      speed: 350,
      lifetime: 4,
      maxLifetime: 4,
      owner,
      type: 'missile',
      target: target, // 保存目标用于跟踪
      update: () => {},
      render: () => {}
    };

    projectile.position.x += Math.cos(owner.rotation) * 30;
    projectile.position.y += Math.sin(owner.rotation) * 30;

    this.projectiles.set(projectile.id, projectile);
    owner.currentCooldown = 1.5;

    // 播放发射音效
    audioManager.playSound('shoot');
  }

  private updateProjectiles(deltaTime: number) {
    this.projectiles.forEach(proj => {
      proj.lifetime -= deltaTime;
      if (proj.lifetime <= 0) {
        proj.isDead = true;
        return;
      }

      // 导弹跟踪逻辑
      if (proj.type === 'missile' && proj.target) {
        const target = proj.target;
        // 检查目标是否还存在
        if ((target as any).isDead || (target as any).hp <= 0) {
          proj.target = null;
        } else {
          // 计算朝向目标的角度
          const dx = target.position.x - proj.position.x;
          const dy = target.position.y - proj.position.y;
          const targetAngle = Math.atan2(dy, dx);

          // 平滑转向（最大转向角度）
          const maxTurnRate = 3 * deltaTime; // 每秒最大转向3弧度
          let angleDiff = targetAngle - proj.rotation;

          // 标准化角度差到 -PI 到 PI
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          // 限制转向速度
          if (angleDiff > maxTurnRate) angleDiff = maxTurnRate;
          if (angleDiff < -maxTurnRate) angleDiff = -maxTurnRate;

          proj.rotation += angleDiff;

          // 更新速度方向
          proj.velocity.x = Math.cos(proj.rotation) * proj.speed;
          proj.velocity.y = Math.sin(proj.rotation) * proj.speed;
        }
      }

      proj.position.x += proj.velocity.x * deltaTime;
      proj.position.y += proj.velocity.y * deltaTime;

      if (proj.position.x < 0 || proj.position.x > this.config.mapWidth ||
          proj.position.y < 0 || proj.position.y > this.config.mapHeight) {
        proj.isDead = true;
      }
    });
  }

  private castMagic(type: MagicType) {
    if (!this.player) return;

    // 魔法消耗已经在调用处处理，这里只创建效果
    const effect: MagicEffect = {
      id: generateId(),
      position: {
        x: this.player.position.x + Math.cos(this.player.rotation) * 100,
        y: this.player.position.y + Math.sin(this.player.rotation) * 100
      },
      type,
      radius: type === MagicType.FIRE ? 150 : type === MagicType.WATER ? 100 : 80,
      damage: type === MagicType.FIRE ? 80 : type === MagicType.WATER ? 40 : 60,
      lifetime: 1.5,
      maxLifetime: 1.5
    };

    this.magicEffects.set(effect.id, effect);

    // 对僵尸造成伤害
    this.zombies.forEach(zombie => {
      if (!zombie.isDead && getDistance(zombie.position, effect.position) < effect.radius) {
        zombie.hp -= effect.damage;
        if (zombie.hp <= 0) {
          zombie.isDead = true;
          this.spawnAshParticles(zombie.position);
        }
      }
    });

    // 对敌方基地造成伤害
    this.nations.forEach(nation => {
      if (nation.id !== 'player-base' && nation.hp > 0) {
        const dist = getDistance(nation.position, effect.position);
        if (dist < effect.radius + nation.radius) {
          const actualDamage = Math.floor(effect.damage * (1 - nation.defense));
          nation.hp -= actualDamage;
          if (nation.hp <= 0) {
            this.addNotification(`${nation.name} 被魔法摧毁！`, '#ff4444');
          }
        }
      }
    });
  }

  private updateMagicEffects(deltaTime: number) {
    this.magicEffects.forEach(effect => {
      effect.lifetime -= deltaTime;
      if (effect.lifetime <= 0) {
        this.magicEffects.delete(effect.id);
      }
    });
  }

  private updateBuilding(building: Building, deltaTime: number) {
    if (building.currentCooldown > 0) {
      building.currentCooldown -= deltaTime;
    }
    
    if (building.currentCooldown <= 0) {
      let nearestTarget: Zombie | null = null;
      let minDistance = building.attackRange;
      
      this.zombies.forEach(zombie => {
        if (!zombie.isDead) {
          const dist = getDistance(building.position, zombie.position);
          if (dist < minDistance) {
            minDistance = dist;
            nearestTarget = zombie;
          }
        }
      });
      
      if (nearestTarget) {
        const target = nearestTarget as Zombie;
        target.hp -= building.attackDamage;
        building.currentCooldown = building.attackCooldown;
        if (target.hp <= 0) {
          target.isDead = true;
        }
      }
    }
  }

  private updateParticles(deltaTime: number) {
    this.particles.forEach(particle => {
      particle.lifetime -= deltaTime;
      particle.position.x += particle.velocity.x * deltaTime;
      particle.position.y += particle.velocity.y * deltaTime;
      particle.alpha = particle.lifetime / particle.maxLifetime;
    });
    
    this.particles.forEach((particle, id) => {
      if (particle.lifetime <= 0) {
        this.particles.delete(id);
      }
    });
  }

  private spawnAshParticles(position: Vector2) {
    // 限制最大粒子数量
    if (this.particles.size > 100) {
      // 如果粒子太多，删除最旧的粒子
      const entries = Array.from(this.particles.entries());
      for (let i = 0; i < 20 && i < entries.length; i++) {
        this.particles.delete(entries[i][0]);
      }
    }

    // 减少粒子数量从15到8
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8 + Math.random() * 0.5;
      const speed = 20 + Math.random() * 30;
      const particle: Particle = {
        id: generateId(),
        position: { ...position },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        color: `rgba(${100 + Math.random() * 100}, ${100 + Math.random() * 100}, ${100 + Math.random() * 100}, 1)`,
        size: 2 + Math.random() * 3,
        lifetime: 0.5 + Math.random() * 0.5,
        maxLifetime: 0.5 + Math.random() * 0.5,
        alpha: 1,
        type: 'ash'
      };
      this.particles.set(particle.id, particle);
    }
  }

  private handleCollisions() {
    this.projectiles.forEach(proj => {
      if (proj.isDead) return;
      
      // 检测与丧尸碰撞
      this.zombies.forEach(zombie => {
        if (!zombie.isDead && getDistance(proj.position, zombie.position) < zombie.radius + proj.radius) {
          zombie.hp -= proj.damage;
          proj.isDead = true;
          if (zombie.hp <= 0) {
            zombie.isDead = true;
            this.spawnAshParticles(zombie.position);
            this.dropResources(zombie.position, zombie.isBoss);
          }
        }
      });
      
      // 检测与敌方单位碰撞
      if (proj.faction === Faction.PLAYER) {
        this.nations.forEach(nation => {
          if (nation.id === 'player-base') return;
          nation.units.forEach(unit => {
            if (!unit.isDead && getDistance(proj.position, unit.position) < unit.radius + proj.radius) {
              unit.hp -= proj.damage;
              proj.isDead = true;
              if (unit.hp <= 0) {
                unit.isDead = true;
                this.spawnAshParticles(unit.position);
              }
            }
          });
        });
      }
      
      // 检测与玩家碰撞
      if (proj.faction !== Faction.PLAYER && this.player && !this.player.isDead) {
        if (getDistance(proj.position, this.player.position) < this.player.radius + proj.radius) {
          this.player.hp -= proj.damage;
          proj.isDead = true;
          if (this.player.hp <= 0) {
            this.player.isDead = true;
            this.spawnAshParticles(this.player.position);
            audioManager.playSound('explosion');
          }
        }
      }
      
      // 检测与玩家小弟碰撞
      if (proj.faction !== Faction.PLAYER) {
        this.playerUnits.forEach(unit => {
          if (!unit.isDead && getDistance(proj.position, unit.position) < unit.radius + proj.radius) {
            unit.hp -= proj.damage;
            proj.isDead = true;
            if (unit.hp <= 0) {
              unit.isDead = true;
              this.spawnAshParticles(unit.position);
            }
          }
        });
      }
      
      // 检测与基地碰撞
      this.nations.forEach(nation => {
        if (getDistance(proj.position, nation.position) < nation.radius + proj.radius) {
          // 计算实际伤害（考虑防御）
          const actualDamage = proj.damage / nation.defense;
          nation.hp -= actualDamage;
          proj.isDead = true;
          
          if (nation.hp <= 0) {
            nation.hp = 0;
            this.spawnAshParticles(nation.position);
            audioManager.playSound('explosion');
            
            // 敌方基地被摧毁，清除所有单位
            if (nation.id !== 'player-base') {
              nation.units.clear();
              this.addNotification(`${nation.name} 被摧毁！`, '#ff4444');
            }
          }
        }
      });
    });
  }

  private dropResources(position: Vector2, isBoss: boolean) {
    const count = isBoss ? 5 : 1;
    for (let i = 0; i < count; i++) {
      const types = Object.values(ResourceType);
      const type = types[Math.floor(Math.random() * types.length)];
      const angle = (Math.PI * 2 * i) / count;
      const dist = 20 + Math.random() * 30;
      
      const resource: ResourceItem = {
        id: generateId(),
        position: {
          x: position.x + Math.cos(angle) * dist,
          y: position.y + Math.sin(angle) * dist
        },
        velocity: { x: 0, y: 0 },
        rotation: 0,
        radius: 30, // 2倍大小
        faction: Faction.NEUTRAL,
        hp: 1,
        maxHp: 1,
        isDead: false,
        level: 1,
        resourceType: type,
        amount: isBoss ? Math.floor(Math.random() * 5) + 3 : 1,
        update: () => {},
        render: (ctx) => this.renderResource(ctx, resource)
      };
      this.resources.set(resource.id, resource);
    }
  }

  private collectResources() {
    if (!this.player) return;
    
    this.resources.forEach(resource => {
      if (getDistance(this.player!.position, resource.position) < this.player!.radius + resource.radius + 20) {
        this.player!.inventory[resource.resourceType] += resource.amount;
        resource.isDead = true;
        this.addNotification(`+${resource.amount} ${this.getResourceName(resource.resourceType)}`, '#ffff00');
        audioManager.playSound('pickup');
      }
    });
  }

  private getResourceName(type: ResourceType): string {
    const names: Record<ResourceType, string> = {
      [ResourceType.STEEL_BAR]: '钢筋',
      [ResourceType.CEMENT]: '水泥',
      [ResourceType.CHIP]: '芯片',
      [ResourceType.ZOMBIE_CRYSTAL]: '丧尸晶格',
      [ResourceType.FUEL]: '燃料',
      [ResourceType.AMMO_BOX]: '弹药'
    };
    return names[type];
  }

  private cleanupDeadEntities() {
    this.zombies.forEach((zombie, id) => {
      if (zombie.isDead && zombie.ashTime <= 0) {
        this.zombies.delete(id);
      }
    });
    
    this.projectiles.forEach((proj, id) => {
      if (proj.isDead) this.projectiles.delete(id);
    });
    
    this.resources.forEach((res, id) => {
      if (res.isDead) this.resources.delete(id);
    });
    
    this.nations.forEach(nation => {
      nation.units.forEach((unit, id) => {
        if (unit.isDead) nation.units.delete(id);
      });
    });
    
    this.playerUnits.forEach((unit, id) => {
      if (unit.isDead) this.playerUnits.delete(id);
    });
  }

  private updateCamera() {
    if (!this.player) return;
    
    const targetX = this.player.position.x - this.canvas.width / 2 / this.cameraZoom;
    const targetY = this.player.position.y - this.canvas.height / 2 / this.cameraZoom;
    
    this.camera.x += (targetX - this.camera.x) * 0.1;
    this.camera.y += (targetY - this.camera.y) * 0.1;
  }

  private checkGameEnd() {
    const playerBase = this.nations.get('player-base');
    if (!playerBase || playerBase.hp <= 0) {
      this.gameState = GameState.GAME_OVER;
      this.onStateChange?.(GameState.GAME_OVER);
      audioManager.playSound('gameover');
      return;
    }
    
    let allEnemiesDestroyed = true;
    this.nations.forEach(nation => {
      if (nation.id !== 'player-base' && nation.hp > 0) {
        allEnemiesDestroyed = false;
      }
    });
    
    if (allEnemiesDestroyed && this.config.enemyNationCount > 0) {
      this.gameState = GameState.VICTORY;
      this.onStateChange?.(GameState.VICTORY);
      audioManager.playSound('victory');
    }
  }

  private addNotification(text: string, color: string = '#ffffff') {
    this.notifications.push({ text, time: 3, color });
  }

  private updateNotifications(deltaTime: number) {
    this.notifications = this.notifications.filter(n => {
      n.time -= deltaTime;
      return n.time > 0;
    });
  }

  // 渲染方法
  render() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    
    this.ctx.save();
    
    // 应用相机变换（带缩放）
    this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    this.ctx.scale(this.cameraZoom, this.cameraZoom);
    this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);
    this.ctx.translate(-this.camera.x, -this.camera.y);
    
    // 渲染游戏世界（只渲染视野内的对象）
    this.renderMap(this.ctx);
    this.buildings.forEach(building => {
      if (this.isInViewport(building.position, 100)) building.render(this.ctx);
    });
    this.resources.forEach(resource => {
      if (this.isInViewport(resource.position, 50)) resource.render(this.ctx);
    });
    this.renderNations(this.ctx);
    this.zombies.forEach(zombie => {
      if (this.isInViewport(zombie.position, 50)) this.renderZombie(this.ctx, zombie);
    });
    this.renderEnemyUnits(this.ctx);
    this.playerUnits.forEach(unit => {
      if (this.isInViewport(unit.position, 50)) this.renderPlayerUnit(this.ctx, unit);
    });
    if (this.player) this.renderPlayer(this.ctx);
    this.renderProjectiles(this.ctx);
    this.renderMagicEffects(this.ctx);
    this.renderParticles(this.ctx);
    
    this.ctx.restore();

    // 渲染UI（在相机变换之外）
    this.renderUI(this.ctx);

    // 渲染小地图
    this.renderMinimap(this.ctx);

    // 渲染触屏控制
    if (this.config.touchControlsEnabled) {
      this.renderTouchControls(this.ctx);
    }

    // 渲染基地菜单覆盖层（放在最上层，确保按钮不被触摸控制遮挡）
    if (this.showBaseMenu) {
      this.renderBaseMenuOverlay(this.ctx);
    }

  }

  // 检查对象是否在视野内
  private isInViewport(position: Vector2, padding: number = 0): boolean {
    const viewLeft = this.camera.x - padding;
    const viewRight = this.camera.x + this.canvas.width / this.cameraZoom + padding;
    const viewTop = this.camera.y - padding;
    const viewBottom = this.camera.y + this.canvas.height / this.cameraZoom + padding;

    return position.x >= viewLeft && position.x <= viewRight &&
           position.y >= viewTop && position.y <= viewBottom;
  }

  private renderMap(ctx: CanvasRenderingContext2D) {
    const bgKeys = ['bgSnow1', 'bgSnow2', 'bgSnow3'];
    const bgKey = bgKeys[this.config.selectedBackground] || 'bgSnow1';
    const bg = this.assets?.[bgKey as keyof GameAssets] as HTMLImageElement;

    // 扩展区域大小（在地图四周添加额外的背景区域）
    const extendSize = 2000;
    const totalWidth = this.config.mapWidth + extendSize * 2;
    const totalHeight = this.config.mapHeight + extendSize * 2;
    const offsetX = -extendSize;
    const offsetY = -extendSize;

    // 绘制扩展的背景区域
    if (bg) {
      // 绘制扩展区域（使用平铺或拉伸方式）
      ctx.save();
      ctx.fillStyle = ctx.createPattern(bg, 'repeat')!;
      ctx.fillRect(offsetX, offsetY, totalWidth, totalHeight);
      ctx.restore();

      // 在主地图区域绘制清晰的背景
      ctx.drawImage(bg, 0, 0, this.config.mapWidth, this.config.mapHeight);
    } else {
      // 扩展区域渐变
      const extGradient = ctx.createLinearGradient(0, offsetY, 0, this.config.mapHeight + extendSize);
      extGradient.addColorStop(0, '#c8e0e8');
      extGradient.addColorStop(0.3, '#e8f4f8');
      extGradient.addColorStop(0.7, '#b8d4e3');
      extGradient.addColorStop(1, '#a8c4d8');
      ctx.fillStyle = extGradient;
      ctx.fillRect(offsetX, offsetY, totalWidth, totalHeight);

      // 主地图区域更清晰的渐变
      const gradient = ctx.createLinearGradient(0, 0, 0, this.config.mapHeight);
      gradient.addColorStop(0, '#e8f4f8');
      gradient.addColorStop(1, '#b8d4e3');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, this.config.mapWidth, this.config.mapHeight);
    }

    // 地图边界线
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, this.config.mapWidth, this.config.mapHeight);

    // 绘制边界外的装饰性元素（如冰山、雪地等）
    this.renderExtendedAreaDecorations(ctx, extendSize);
  }

  // 绘制扩展区域的装饰
  private renderExtendedAreaDecorations(ctx: CanvasRenderingContext2D, extendSize: number) {
    // 随机生成一些装饰性的雪地纹理
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';

    // 左边界外
    for (let i = 0; i < 20; i++) {
      const x = -Math.random() * extendSize;
      const y = Math.random() * this.config.mapHeight;
      const size = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 右边界外
    for (let i = 0; i < 20; i++) {
      const x = this.config.mapWidth + Math.random() * extendSize;
      const y = Math.random() * this.config.mapHeight;
      const size = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 上边界外
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * this.config.mapWidth;
      const y = -Math.random() * extendSize;
      const size = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 下边界外
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * this.config.mapWidth;
      const y = this.config.mapHeight + Math.random() * extendSize;
      const size = 20 + Math.random() * 60;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // 四个角落
    const corners = [
      { x: -extendSize / 2, y: -extendSize / 2 },
      { x: this.config.mapWidth + extendSize / 2, y: -extendSize / 2 },
      { x: -extendSize / 2, y: this.config.mapHeight + extendSize / 2 },
      { x: this.config.mapWidth + extendSize / 2, y: this.config.mapHeight + extendSize / 2 }
    ];

    corners.forEach(corner => {
      for (let i = 0; i < 15; i++) {
        const x = corner.x + (Math.random() - 0.5) * extendSize;
        const y = corner.y + (Math.random() - 0.5) * extendSize;
        const size = 30 + Math.random() * 80;
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + Math.random() * 0.3})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  private renderNations(ctx: CanvasRenderingContext2D) {
    this.nations.forEach(nation => {
      if (nation.hp <= 0) return;
      
      const img = nation.id === 'player-base' ? this.assets?.playerBase : this.assets?.enemyBase;
      if (img) {
        ctx.drawImage(img, nation.position.x - nation.radius, nation.position.y - nation.radius, 
          nation.radius * 2, nation.radius * 2);
      } else {
        ctx.fillStyle = nation.color;
        ctx.beginPath();
        ctx.arc(nation.position.x, nation.position.y, nation.radius, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // 血条
      const barWidth = nation.radius * 1.5;
      const barHeight = 10;
      ctx.fillStyle = '#333';
      ctx.fillRect(nation.position.x - barWidth / 2, nation.position.y - nation.radius - 25, barWidth, barHeight);
      ctx.fillStyle = nation.hp > nation.maxHp * 0.3 ? nation.color : '#ff0000';
      ctx.fillRect(nation.position.x - barWidth / 2, nation.position.y - nation.radius - 25, 
        barWidth * (nation.hp / nation.maxHp), barHeight);
      
      // 基地名称和等级
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(`${nation.name} Lv.${nation.level}`, nation.position.x, nation.position.y - nation.radius - 35);
      ctx.fillText(`${nation.name} Lv.${nation.level}`, nation.position.x, nation.position.y - nation.radius - 35);
    });
  }

  private renderZombie(ctx: CanvasRenderingContext2D, zombie: Zombie) {
    if (zombie.isDead) {
      ctx.fillStyle = `rgba(100, 100, 100, ${Math.max(0, zombie.ashTime)})`;
      ctx.beginPath();
      ctx.arc(zombie.position.x, zombie.position.y, zombie.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    
    ctx.save();
    ctx.translate(zombie.position.x, zombie.position.y);
    ctx.rotate(zombie.rotation + Math.PI / 2);
    
    const img = zombie.isBoss ? this.assets?.zombieBoss : this.assets?.zombie;
    const size = zombie.isBoss ? 80 : 40;
    
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = zombie.isBoss ? '#8b0000' : '#4a4a4a';
      ctx.beginPath();
      ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
    
    const barWidth = zombie.isBoss ? 80 : 40;
    const barHeight = zombie.isBoss ? 8 : 4;
    ctx.fillStyle = '#333';
    ctx.fillRect(zombie.position.x - barWidth / 2, zombie.position.y - (zombie.isBoss ? 70 : 45), barWidth, barHeight);
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(zombie.position.x - barWidth / 2, zombie.position.y - (zombie.isBoss ? 70 : 45), 
      barWidth * (zombie.hp / zombie.maxHp), barHeight);
    
    if (zombie.isBoss) {
      ctx.fillStyle = '#ff0000';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('BOSS', zombie.position.x, zombie.position.y - 80);
    }
  }

  private renderEnemyUnits(ctx: CanvasRenderingContext2D) {
    this.nations.forEach(nation => {
      if (nation.hp <= 0) return;
      nation.units.forEach(unit => {
        if (unit.isDead) return;
        
        ctx.save();
        ctx.translate(unit.position.x, unit.position.y);
        ctx.rotate(unit.rotation + Math.PI / 2);
        
        if (this.assets?.enemyPlane) {
          ctx.drawImage(this.assets.enemyPlane, -25, -25, 50, 50);
        }
        
        ctx.restore();
        
        const barWidth = 45;
        const barHeight = 4;
        ctx.fillStyle = '#333';
        ctx.fillRect(unit.position.x - barWidth / 2, unit.position.y - 35, barWidth, barHeight);
        ctx.fillStyle = nation.color;
        ctx.fillRect(unit.position.x - barWidth / 2, unit.position.y - 35, 
          barWidth * (unit.hp / unit.maxHp), barHeight);
      });
    });
  }

  private renderPlayer(ctx: CanvasRenderingContext2D) {
    if (!this.player) return;
    
    // 死亡时显示爆炸效果
    if (this.player.isDead) {
      ctx.fillStyle = `rgba(255, 100, 0, ${Math.max(0, 1 - this.respawnTimer)})`;
      ctx.beginPath();
      ctx.arc(this.player.position.x, this.player.position.y, 50 * (1 + this.respawnTimer), 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.ceil(3 - this.respawnTimer)}秒后重生`, this.player.position.x, this.player.position.y);
      return;
    }
    
    ctx.save();
    ctx.translate(this.player.position.x, this.player.position.y);
    ctx.rotate(this.player.rotation + Math.PI / 2);
    
    let img: HTMLImageElement | null = null;
    let size = 60;
    
    switch (this.player.unitType) {
      case UnitType.FIGHTER: img = this.assets?.playerFighter || null; size = 60; break;
      case UnitType.TANK: img = this.assets?.playerTank || null; size = 70; break;
      case UnitType.SOLDIER: img = this.assets?.playerSoldier || null; size = 55; break;
    }
    
    size *= (1 + (this.player.level - 1) * 0.1);
    
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    } else {
      // 备用绘制：当图片未加载时显示简单图形
      ctx.fillStyle = '#00ff00';
      ctx.beginPath();
      ctx.moveTo(0, -size / 2);
      ctx.lineTo(size / 2, size / 2);
      ctx.lineTo(-size / 2, size / 2);
      ctx.closePath();
      ctx.fill();
    }
    
    ctx.restore();
    
    const barWidth = 60;
    const barHeight = 6;
    ctx.fillStyle = '#333';
    ctx.fillRect(this.player.position.x - barWidth / 2, this.player.position.y - 50, barWidth, barHeight);
    ctx.fillStyle = this.player.hp > this.player.maxHp * 0.3 ? '#00ff00' : '#ff0000';
    ctx.fillRect(this.player.position.x - barWidth / 2, this.player.position.y - 50, 
      barWidth * (this.player.hp / this.player.maxHp), barHeight);
    
    if (this.player.level > 1) {
      ctx.fillStyle = '#ffff00';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`Lv.${this.player.level}`, this.player.position.x, this.player.position.y - 60);
    }
  }

  private renderPlayerUnit(ctx: CanvasRenderingContext2D, unit: PlayerUnit) {
    if (unit.isDead) return;
    
    ctx.save();
    ctx.translate(unit.position.x, unit.position.y);
    ctx.rotate(unit.rotation + Math.PI / 2);
    
    let img: HTMLImageElement | null = null;
    let size = 50;
    
    switch (unit.unitType) {
      case UnitType.FIGHTER: img = this.assets?.playerFighter || null; size = 45; break;
      case UnitType.TANK: img = this.assets?.playerTank || null; size = 55; break;
      default: img = this.assets?.playerSoldier || null; size = 40;
    }
    
    if (img) {
      ctx.drawImage(img, -size / 2, -size / 2, size, size);
    }
    
    ctx.restore();
    
    const barWidth = 40;
    const barHeight = 4;
    ctx.fillStyle = '#333';
    ctx.fillRect(unit.position.x - barWidth / 2, unit.position.y - 35, barWidth, barHeight);
    ctx.fillStyle = unit.hp > unit.maxHp * 0.3 ? '#00aa00' : '#ff0000';
    ctx.fillRect(unit.position.x - barWidth / 2, unit.position.y - 35, 
      barWidth * (unit.hp / unit.maxHp), barHeight);
    
    // 招募标记
    if ((unit as any).isRecruited) {
      ctx.fillStyle = '#00ff00';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('跟随', unit.position.x, unit.position.y - 45);
    }
  }

  private renderProjectiles(ctx: CanvasRenderingContext2D) {
    this.projectiles.forEach(proj => {
      ctx.save();
      ctx.translate(proj.position.x, proj.position.y);
      ctx.rotate(proj.rotation);
      
      if (proj.type === 'bullet' && this.assets?.bullet) {
        ctx.drawImage(this.assets.bullet, -8, -3, 16, 6);
      } else if (proj.type === 'missile' && this.assets?.missile) {
        ctx.drawImage(this.assets.missile, -15, -6, 30, 12);
      } else {
        ctx.fillStyle = proj.type === 'missile' ? '#ff6600' : '#ffff00';
        ctx.beginPath();
        ctx.arc(0, 0, proj.type === 'missile' ? 6 : 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.restore();
    });
  }

  private renderMagicEffects(ctx: CanvasRenderingContext2D) {
    this.magicEffects.forEach(effect => {
      const alpha = effect.lifetime / effect.maxLifetime;
      const img = effect.type === MagicType.FIRE ? this.assets?.magicFire :
                  effect.type === MagicType.ICE ? this.assets?.magicIce :
                  this.assets?.magicWater;
      
      if (img) {
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, effect.position.x - effect.radius, effect.position.y - effect.radius, 
          effect.radius * 2, effect.radius * 2);
        ctx.globalAlpha = 1;
      }
    });
  }

  private renderParticles(ctx: CanvasRenderingContext2D) {
    this.particles.forEach(particle => {
      ctx.globalAlpha = particle.alpha;
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.position.x, particle.position.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  private renderResource(ctx: CanvasRenderingContext2D, resource: ResourceItem) {
    const imgMap: Record<ResourceType, keyof GameAssets | null> = {
      [ResourceType.STEEL_BAR]: 'steelBar',
      [ResourceType.CEMENT]: 'cement',
      [ResourceType.CHIP]: 'chip',
      [ResourceType.ZOMBIE_CRYSTAL]: 'crystal',
      [ResourceType.FUEL]: 'fuel',
      [ResourceType.AMMO_BOX]: 'ammo'
    };
    
    const imgKey = imgMap[resource.resourceType];
    const img = imgKey ? this.assets?.[imgKey] as HTMLImageElement : null;
    
    if (img) {
      ctx.drawImage(img, resource.position.x - 30, resource.position.y - 30, 60, 60);
    } else {
      const colors: Record<ResourceType, string> = {
        [ResourceType.STEEL_BAR]: '#888',
        [ResourceType.CEMENT]: '#aaa',
        [ResourceType.CHIP]: '#44f',
        [ResourceType.ZOMBIE_CRYSTAL]: '#f4f',
        [ResourceType.FUEL]: '#fa0',
        [ResourceType.AMMO_BOX]: '#080'
      };
      ctx.fillStyle = colors[resource.resourceType];
      ctx.fillRect(resource.position.x - 20, resource.position.y - 20, 40, 40);
    }
  }

  private renderBaseMenu(ctx: CanvasRenderingContext2D) {
    const buttonSize = 55;
    const buttonSpacing = 80;

    const buttons = [
      { x: 0, y: -buttonSpacing, action: 'upgrade', label: '升级', icon: '↑', color: '#4488ff', gradient: ['#66aaff', '#2266cc'] },
      { x: buttonSpacing, y: 0, action: 'plane', label: '飞机', icon: '✈', color: '#44ff44', gradient: ['#66ff66', '#22aa22'] },
      { x: 0, y: buttonSpacing, action: 'tank', label: '坦克', icon: '◆', color: '#ffaa44', gradient: ['#ffcc66', '#cc8822'] },
      { x: -buttonSpacing, y: 0, action: 'rocket', label: '造火箭', icon: '🚀', color: '#ff44ff', gradient: ['#ff88ff', '#cc22cc'] }
    ];

    // 绘制连接线（从基地到按钮）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    buttons.forEach(btn => {
      const x = this.baseMenuPosition.x + btn.x;
      const y = this.baseMenuPosition.y + btn.y;
      ctx.beginPath();
      ctx.moveTo(this.baseMenuPosition.x, this.baseMenuPosition.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    buttons.forEach(btn => {
      const x = this.baseMenuPosition.x + btn.x;
      const y = this.baseMenuPosition.y + btn.y;

      // 外圈光晕
      const glowGradient = ctx.createRadialGradient(x, y, buttonSize / 2, x, y, buttonSize / 2 + 8);
      glowGradient.addColorStop(0, btn.color + '40');
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, buttonSize / 2 + 8, 0, Math.PI * 2);
      ctx.fill();

      // 按钮背景渐变
      const bgGradient = ctx.createRadialGradient(x - 10, y - 10, 0, x, y, buttonSize / 2);
      bgGradient.addColorStop(0, btn.gradient[0]);
      bgGradient.addColorStop(1, btn.gradient[1]);
      ctx.fillStyle = bgGradient;
      ctx.beginPath();
      ctx.arc(x, y, buttonSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // 内圈高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.beginPath();
      ctx.arc(x - 8, y - 8, buttonSize / 4, 0, Math.PI * 2);
      ctx.fill();

      // 按钮边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 图标
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.icon, x, y);

      // 按钮文字（在按钮下方）
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(btn.label, x, y + buttonSize / 2 + 20);
      ctx.shadowBlur = 0;
    });

    // 中心点（基地位置）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.beginPath();
    ctx.arc(this.baseMenuPosition.x, this.baseMenuPosition.y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // 在屏幕坐标中渲染基地菜单（确保在触摸控制之上）
  private renderBaseMenuOverlay(ctx: CanvasRenderingContext2D) {
    const buttonSize = 55;
    const buttonSpacing = 80;

    // 将基地世界坐标转换为屏幕坐标
    const screenPos = this.worldToScreen(this.baseMenuPosition.x, this.baseMenuPosition.y);

    const buttons = [
      { x: 0, y: -buttonSpacing, action: 'upgrade', label: '升级', icon: '↑', color: '#4488ff', gradient: ['#66aaff', '#2266cc'] },
      { x: buttonSpacing, y: 0, action: 'plane', label: '飞机', icon: '✈', color: '#44ff44', gradient: ['#66ff66', '#22aa22'] },
      { x: 0, y: buttonSpacing, action: 'tank', label: '坦克', icon: '◆', color: '#ffaa44', gradient: ['#ffcc66', '#cc8822'] },
      { x: -buttonSpacing, y: 0, action: 'rocket', label: '上交', icon: '⚡', color: '#ff44ff', gradient: ['#ff88ff', '#cc22cc'] }
    ];

    // 绘制连接线（从基地到按钮）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    buttons.forEach(btn => {
      const x = screenPos.x + btn.x;
      const y = screenPos.y + btn.y;
      ctx.beginPath();
      ctx.moveTo(screenPos.x, screenPos.y);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    buttons.forEach(btn => {
      const x = screenPos.x + btn.x;
      const y = screenPos.y + btn.y;

      // 外圈光晕
      const glowGradient = ctx.createRadialGradient(x, y, buttonSize / 2, x, y, buttonSize / 2 + 8);
      glowGradient.addColorStop(0, btn.color + '60');
      glowGradient.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, buttonSize / 2 + 8, 0, Math.PI * 2);
      ctx.fill();

      // 按钮背景渐变
      const bgGradient = ctx.createRadialGradient(x - 10, y - 10, 0, x, y, buttonSize / 2);
      bgGradient.addColorStop(0, btn.gradient[0]);
      bgGradient.addColorStop(1, btn.gradient[1]);
      ctx.fillStyle = bgGradient;
      ctx.beginPath();
      ctx.arc(x, y, buttonSize / 2, 0, Math.PI * 2);
      ctx.fill();

      // 内圈高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(x - 8, y - 8, buttonSize / 4, 0, Math.PI * 2);
      ctx.fill();

      // 按钮边框
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 图标
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.icon, x, y);

      // 按钮文字（在按钮下方）
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px Arial';
      ctx.textBaseline = 'alphabetic';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(btn.label, x, y + buttonSize / 2 + 22);
      ctx.shadowBlur = 0;
    });

    // 中心点（基地位置）
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(screenPos.x, screenPos.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private renderUI(ctx: CanvasRenderingContext2D) {
    // 左上角状态面板（包含血量和排行）
    this.renderStatusPanel(ctx);
    
    // 尸潮倒计时
    this.renderWaveInfo(ctx);
    
    // 建造菜单
    if (this.showBuildMenu) {
      this.renderBuildMenu(ctx);
    }
    
    // 魔法菜单
    if (this.showMagicMenu) {
      this.renderMagicMenu(ctx);
    }
    
    // 背包
    if (this.showInventory && this.player) {
      this.renderInventory(ctx);
    }
    
    // 通知
    this.renderNotifications(ctx);
  }

  private renderStatusPanel(ctx: CanvasRenderingContext2D) {
    const x = 10;
    const y = 10;
    const width = 180;
    let height = 110;

    if (this.player) {
      height += 90; // 增加高度容纳背包数据
    }

    // 背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, width, height);

    if (this.player) {
      // ===== 背包数据（2行）=====
      const items = [
        { type: ResourceType.STEEL_BAR, name: '钢筋', color: '#aaa' },
        { type: ResourceType.CEMENT, name: '水泥', color: '#888' },
        { type: ResourceType.CHIP, name: '芯片', color: '#4af' },
        { type: ResourceType.ZOMBIE_CRYSTAL, name: '晶格', color: '#f4f' },
        { type: ResourceType.FUEL, name: '燃料', color: '#fa0' },
        { type: ResourceType.AMMO_BOX, name: '弹药', color: '#080' }
      ];

      // 第一行：钢筋、水泥、芯片
      ctx.font = 'bold 10px Arial';
      ctx.textAlign = 'left';
      let itemX = x + 8;
      for (let i = 0; i < 3; i++) {
        const item = items[i];
        ctx.fillStyle = item.color;
        ctx.fillText(`${item.name}:${this.player.inventory[item.type]}`, itemX, y + 14);
        itemX += 58;
      }

      // 第二行：晶格、燃料、弹药
      itemX = x + 8;
      for (let i = 3; i < 6; i++) {
        const item = items[i];
        ctx.fillStyle = item.color;
        ctx.fillText(`${item.name}:${this.player.inventory[item.type]}`, itemX, y + 28);
        itemX += 58;
      }

      // ===== 血量 =====
      const hpY = y + 45;
      ctx.fillStyle = '#fff';
      ctx.font = '12px Arial';
      ctx.fillText(`HP: ${Math.floor(this.player.hp)}/${this.player.maxHp}`, x + 8, hpY);
      ctx.fillStyle = '#333';
      ctx.fillRect(x + 8, hpY + 4, 164, 10);
      ctx.fillStyle = this.player.hp > this.player.maxHp * 0.3 ? '#00ff00' : '#ff0000';
      ctx.fillRect(x + 8, hpY + 4, 164 * (this.player.hp / this.player.maxHp), 10);

      // ===== 魔法 =====
      const magicY = y + 72;
      ctx.fillStyle = '#fff';
      ctx.fillText(`魔法: ${Math.floor(this.player.magic)}/${this.player.maxMagic}`, x + 8, magicY);
      ctx.fillStyle = '#333';
      ctx.fillRect(x + 8, magicY + 4, 164, 8);
      ctx.fillStyle = '#4488ff';
      ctx.fillRect(x + 8, magicY + 4, 164 * (this.player.magic / this.player.maxMagic), 8);
    }

    // ===== 国家排行 =====
    let offset = this.player ? 105 : 25;
    ctx.fillStyle = '#ffff00';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('国家排行', x + 8, y + offset);
    offset += 16;

    const sortedNations = Array.from(this.nations.values())
      .filter(n => n.hp > 0)
      .sort((a, b) => b.hp - a.hp)
      .slice(0, 3);

    sortedNations.forEach((nation, index) => {
      ctx.fillStyle = nation.color;
      ctx.font = '10px Arial';
      ctx.fillText(`${index + 1}. ${nation.name}`, x + 8, y + offset);
      ctx.fillText(`${Math.floor(nation.hp)}`, x + 150, y + offset);
      offset += 14;
    });
  }

  private renderWaveInfo(ctx: CanvasRenderingContext2D) {
    const x = this.canvas.width / 2 - 100;
    const y = 10;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, 200, 30);
    
    ctx.fillStyle = '#ff4444';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`第 ${this.waveNumber} 波尸潮 ${Math.ceil(this.waveCountdown)}s`, x + 100, y + 20);
  }

  private renderBuildMenu(ctx: CanvasRenderingContext2D) {
    const x = this.canvas.width / 2 - 150;
    const y = this.canvas.height / 2 - 100;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x, y, 300, 200);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('建造菜单 (B)', x + 150, y + 30);
    
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('1. 炮台 - 钢筋x10 芯片x5', x + 20, y + 70);
    ctx.fillText('2. 电击墙 - 钢筋x15 水泥x10 芯片x8', x + 20, y + 100);
    
    ctx.fillStyle = '#888';
    ctx.fillText('点击地图建造', x + 20, y + 150);
  }

  private renderMagicMenu(ctx: CanvasRenderingContext2D) {
    const x = this.canvas.width / 2 - 150;
    const y = this.canvas.height / 2 - 100;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x, y, 300, 200);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('魔法菜单 (V)', x + 150, y + 30);
    
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('1. 火球术 - 大范围高伤害', x + 20, y + 70);
    ctx.fillText('2. 水流术 - 中范围持续伤害', x + 20, y + 100);
    ctx.fillText('3. 冰锥术 - 小范围冻结伤害', x + 20, y + 130);
    
    ctx.fillStyle = '#888';
    ctx.fillText('消耗: 30 魔法值', x + 20, y + 170);
  }

  private renderInventory(ctx: CanvasRenderingContext2D) {
    if (!this.player) return;
    
    const x = this.canvas.width / 2 - 150;
    const y = this.canvas.height / 2 - 150;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.9)';
    ctx.fillRect(x, y, 300, 300);
    
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('背包 (I)', x + 150, y + 30);
    
    const items = [
      { type: ResourceType.STEEL_BAR, name: '钢筋' },
      { type: ResourceType.CEMENT, name: '水泥' },
      { type: ResourceType.CHIP, name: '芯片' },
      { type: ResourceType.ZOMBIE_CRYSTAL, name: '丧尸晶格' },
      { type: ResourceType.FUEL, name: '燃料' },
      { type: ResourceType.AMMO_BOX, name: '弹药' }
    ];
    
    let offset = 60;
    items.forEach(item => {
      ctx.fillStyle = '#fff';
      ctx.font = '14px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(`${item.name}: ${this.player!.inventory[item.type]}`, x + 30, y + offset);
      offset += 30;
    });
  }

  private renderNotifications(ctx: CanvasRenderingContext2D) {
    // 通知显示在页面最上面居中位置
    let y = 40;
    this.notifications.forEach(notification => {
      ctx.fillStyle = notification.color;
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      // 添加文字阴影增强可读性
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;
      ctx.fillText(notification.text, this.canvas.width / 2, y);
      // 重置阴影
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      y += 28;
    });
  }

  private renderMinimap(ctx: CanvasRenderingContext2D) {
    const mapSize = 120;
    const padding = 10;
    const x = this.canvas.width - mapSize - padding;
    const y = padding + 50; // 右上角，避开顶部信息栏
    
    // 小地图背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, mapSize, mapSize);
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, mapSize, mapSize);
    
    const scaleX = mapSize / this.config.mapWidth;
    const scaleY = mapSize / this.config.mapHeight;
    
    // 绘制基地
    this.nations.forEach(nation => {
      if (nation.hp <= 0) return;
      const mx = x + nation.position.x * scaleX;
      const my = y + nation.position.y * scaleY;
      ctx.fillStyle = nation.color;
      ctx.beginPath();
      ctx.arc(mx, my, nation.id === 'player-base' ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // 绘制玩家
    if (this.player && !this.player.isDead) {
      const mx = x + this.player.position.x * scaleX;
      const my = y + this.player.position.y * scaleY;
      ctx.fillStyle = '#00ffff';
      ctx.beginPath();
      ctx.arc(mx, my, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // 绘制视野框
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    const viewW = (this.canvas.width / this.cameraZoom) * scaleX;
    const viewH = (this.canvas.height / this.cameraZoom) * scaleY;
    const viewX = x + (this.camera.x + this.canvas.width / 2 / this.cameraZoom - this.canvas.width / 2) * scaleX;
    const viewY = y + (this.camera.y + this.canvas.height / 2 / this.cameraZoom - this.canvas.height / 2) * scaleY;
    ctx.strokeRect(viewX, viewY, viewW, viewH);
  }

  private renderTouchControls(ctx: CanvasRenderingContext2D) {
    if (!this.config.touchControlsEnabled) return;

    // ===== 左下角虚拟摇杆（移动）=====
    const joystickCenterX = this.canvas.width * 0.12;
    const joystickCenterY = this.canvas.height * 0.82;
    const joystickMaxRadius = 75; // 变大

    // 摇杆背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(joystickCenterX, joystickCenterY, joystickMaxRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 摇杆手柄位置
    let handleX = joystickCenterX;
    let handleY = joystickCenterY;
    if (this.input.joystickActive) {
      const joystickDist = Math.sqrt(this.input.joystickX * this.input.joystickX + this.input.joystickY * this.input.joystickY);
      const maxDist = 50;
      const clampedDist = Math.min(joystickDist, maxDist);
      if (joystickDist > 0) {
        const angle = Math.atan2(this.input.joystickY, this.input.joystickX);
        handleX = joystickCenterX + Math.cos(angle) * clampedDist;
        handleY = joystickCenterY + Math.sin(angle) * clampedDist;
      }
    }

    // 摇杆手柄 - 外圈
    ctx.fillStyle = this.input.joystickActive ? 'rgba(0, 200, 255, 0.3)' : 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 28, 0, Math.PI * 2);
    ctx.fill();
    // 摇杆手柄 - 内圈
    ctx.fillStyle = this.input.joystickActive ? 'rgba(0, 200, 255, 0.9)' : 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(handleX, handleY, 18, 0, Math.PI * 2);
    ctx.fill();

    // 摇杆提示文字
    if (!this.input.joystickActive) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('移动', joystickCenterX, joystickCenterY + 5);
    }

    // ===== 右侧攻击摇杆（和左侧对称）=====
    const aimCenterX = this.canvas.width - this.canvas.width * 0.12; // 和左侧对称
    const aimCenterY = this.canvas.height * 0.82; // 和左侧对称
    const aimMaxRadius = 75; // 和左侧一样大

    // 攻击摇杆背景
    ctx.fillStyle = 'rgba(255, 100, 100, 0.12)';
    ctx.beginPath();
    ctx.arc(aimCenterX, aimCenterY, aimMaxRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 100, 100, 0.4)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 攻击摇杆手柄位置
    let aimHandleX = aimCenterX;
    let aimHandleY = aimCenterY;
    if (this.input.touchAiming) {
      const aimDX = this.input.touchAimX - aimCenterX;
      const aimDY = this.input.touchAimY - aimCenterY;
      const aimDist = Math.sqrt(aimDX * aimDX + aimDY * aimDY);
      const maxDist = 50;
      const clampedDist = Math.min(aimDist, maxDist);
      if (aimDist > 0) {
        const angle = Math.atan2(aimDY, aimDX);
        aimHandleX = aimCenterX + Math.cos(angle) * clampedDist;
        aimHandleY = aimCenterY + Math.sin(angle) * clampedDist;
      }
    }

    // 攻击摇杆手柄 - 外圈
    ctx.fillStyle = this.input.touchAiming ? 'rgba(255, 80, 80, 0.3)' : 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.arc(aimHandleX, aimHandleY, 28, 0, Math.PI * 2);
    ctx.fill();
    // 攻击摇杆手柄 - 内圈
    ctx.fillStyle = this.input.touchAiming ? 'rgba(255, 80, 80, 0.9)' : 'rgba(255, 255, 255, 0.7)';
    ctx.beginPath();
    ctx.arc(aimHandleX, aimHandleY, 18, 0, Math.PI * 2);
    ctx.fill();

    // 攻击提示文字
    if (!this.input.touchAiming) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = 'bold 13px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('攻击', aimCenterX, aimCenterY + 5);
    }

    // 导弹按钮 - 放在攻击圆圈上方偏左
    const missileX = aimCenterX - 45;
    const missileY = aimCenterY - aimMaxRadius - 45; // 在攻击圆圈上方
    const missileRadius = 32;

    // 外圈光晕
    const missileGlow = ctx.createRadialGradient(missileX, missileY, missileRadius, missileX, missileY, missileRadius + 10);
    missileGlow.addColorStop(0, 'rgba(255, 200, 0, 0.5)');
    missileGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = missileGlow;
    ctx.beginPath();
    ctx.arc(missileX, missileY, missileRadius + 10, 0, Math.PI * 2);
    ctx.fill();

    // 外圈
    ctx.fillStyle = this.input.missile ? 'rgba(255, 180, 0, 0.5)' : 'rgba(255, 200, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(missileX, missileY, missileRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 220, 100, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 内圈
    ctx.fillStyle = this.input.missile ? 'rgba(255, 200, 50, 0.95)' : 'rgba(255, 220, 100, 0.8)';
    ctx.beginPath();
    ctx.arc(missileX, missileY, 20, 0, Math.PI * 2);
    ctx.fill();

    // 导弹图标（火箭形状）
    ctx.fillStyle = '#fff';
    // 火箭头部
    ctx.beginPath();
    ctx.moveTo(missileX, missileY - 12);
    ctx.lineTo(missileX - 6, missileY + 2);
    ctx.lineTo(missileX, missileY + 6);
    ctx.lineTo(missileX + 6, missileY + 2);
    ctx.closePath();
    ctx.fill();
    // 火箭尾焰
    ctx.fillStyle = '#ff8800';
    ctx.beginPath();
    ctx.moveTo(missileX - 4, missileY + 6);
    ctx.lineTo(missileX, missileY + 14);
    ctx.lineTo(missileX + 4, missileY + 6);
    ctx.closePath();
    ctx.fill();

    // 文字
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('导弹', missileX, missileY + missileRadius + 16);

    // 魔法攻击按钮 - 放在攻击圆圈上方偏右
    const magicX = aimCenterX + 45;
    const magicY = aimCenterY - aimMaxRadius - 45;
    const magicRadius = 32;

    // 外圈光晕
    const magicGlow = ctx.createRadialGradient(magicX, magicY, magicRadius, magicX, magicY, magicRadius + 10);
    magicGlow.addColorStop(0, 'rgba(255, 80, 0, 0.5)');
    magicGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = magicGlow;
    ctx.beginPath();
    ctx.arc(magicX, magicY, magicRadius + 10, 0, Math.PI * 2);
    ctx.fill();

    // 外圈
    ctx.fillStyle = this.input.magic1 ? 'rgba(255, 100, 0, 0.5)' : 'rgba(255, 80, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(magicX, magicY, magicRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 150, 50, 0.8)';
    ctx.lineWidth = 3;
    ctx.stroke();

    // 内圈
    ctx.fillStyle = this.input.magic1 ? 'rgba(255, 120, 50, 0.95)' : 'rgba(255, 100, 30, 0.8)';
    ctx.beginPath();
    ctx.arc(magicX, magicY, 20, 0, Math.PI * 2);
    ctx.fill();

    // 火焰图标
    ctx.fillStyle = '#ff4400';
    // 火焰主体
    ctx.beginPath();
    ctx.moveTo(magicX, magicY - 12);
    ctx.quadraticCurveTo(magicX - 8, magicY, magicX - 4, magicY + 8);
    ctx.quadraticCurveTo(magicX, magicY + 4, magicX + 4, magicY + 8);
    ctx.quadraticCurveTo(magicX + 8, magicY, magicX, magicY - 12);
    ctx.closePath();
    ctx.fill();
    // 火焰中心
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.moveTo(magicX, magicY - 6);
    ctx.quadraticCurveTo(magicX - 4, magicY + 2, magicX, magicY + 6);
    ctx.quadraticCurveTo(magicX + 4, magicY + 2, magicX, magicY - 6);
    ctx.closePath();
    ctx.fill();

    // 文字
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('火焰', magicX, magicY + magicRadius + 16);
  }

  // 公共方法
  getGameState() { return this.gameState; }
  getPlayer() { return this.player; }
  getWaveCountdown() { return this.waveCountdown; }
  getWaveNumber() { return this.waveNumber; }
  getNations() { return this.nations; }
  
  setOnExitToMenu(callback: () => void) {
    this.onExitToMenu = callback;
  }
  
  // 云端存档
  saveGame(slot: number): boolean {
    if (!this.player) return false;
    
    const saveData: SaveData = {
      id: `save-${slot}`,
      name: `存档 ${slot}`,
      timestamp: Date.now(),
      playerPosition: { ...this.player.position },
      playerUnitType: this.player.unitType,
      playerLevel: this.player.level,
      inventory: { ...this.player.inventory },
      rocketProgress: this.nations.get('player-base')?.rocketProgress || 0,
      nations: Array.from(this.nations.values()),
      buildings: Array.from(this.buildings.values())
    };
    
    try {
      localStorage.setItem(`polar-apocalypse-save-${slot}`, JSON.stringify(saveData));
      this.addNotification(`游戏已保存到存档 ${slot}`, '#00ff00');
      return true;
    } catch (e) {
      this.addNotification('保存失败！', '#ff4444');
      return false;
    }
  }

  loadGame(slot: number): boolean {
    try {
      const data = localStorage.getItem(`polar-apocalypse-save-${slot}`);
      if (!data) {
        this.addNotification(`存档 ${slot} 不存在！`, '#ff4444');
        return false;
      }
      
      const saveData: SaveData = JSON.parse(data);
      
      if (this.player) {
        this.player.position = saveData.playerPosition;
        this.player.level = saveData.playerLevel;
        this.player.inventory = { ...saveData.inventory };
      }
      
      const playerBase = this.nations.get('player-base');
      if (playerBase) {
        playerBase.rocketProgress = saveData.rocketProgress;
      }
      
      this.addNotification(`存档 ${slot} 加载成功！`, '#00ff00');
      return true;
    } catch (e) {
      this.addNotification('加载失败！', '#ff4444');
      return false;
    }
  }

  getSaveSlots() {
    const slots = [];
    for (let i = 1; i <= 10; i++) {
      const data = localStorage.getItem(`polar-apocalypse-save-${i}`);
      if (data) {
        const saveData: SaveData = JSON.parse(data);
        slots.push({ slot: i, exists: true, timestamp: saveData.timestamp });
      } else {
        slots.push({ slot: i, exists: false });
      }
    }
    return slots;
  }

  deleteSave(slot: number): boolean {
    try {
      localStorage.removeItem(`polar-apocalypse-save-${slot}`);
      this.addNotification(`存档 ${slot} 已删除`, '#ffff00');
      return true;
    } catch (e) {
      return false;
    }
  }
}
