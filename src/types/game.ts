// 极寒末世 v3.0 - 游戏类型定义

// 阵营枚举
export enum Faction {
  PLAYER = 0,      // 玩家方（绿色）
  ENEMY_1 = 1,     // 敌方1（红色）
  ENEMY_2 = 2,     // 敌方2（橙色）
  ENEMY_3 = 3,     // 敌方3（紫色）
  ZOMBIE = 4,      // 丧尸（灰色）
  NEUTRAL = 5,     // 中立（黄色）
}

// 资源类型
export enum ResourceType {
  STEEL_BAR = 'steel_bar',      // 钢筋
  CEMENT = 'cement',             // 水泥
  CHIP = 'chip',                 // 电子芯片
  ZOMBIE_CRYSTAL = 'zombie_crystal', // 丧尸晶格
  FUEL = 'fuel',                 // 燃料
  AMMO_BOX = 'ammo_box',         // 弹药箱
}

// 兵种类型 - 简化为3种
export enum UnitType {
  FIGHTER = 'fighter',   // 战斗机 - 速度快，攻击力低
  TANK = 'tank',         // 坦克 - 速度慢，攻击力强
  SOLDIER = 'soldier',   // 强化士兵 - 均衡
}

// 建筑类型
export enum BuildingType {
  TURRET = 'turret',           // 炮台
  ELECTRIC_WALL = 'electric_wall', // 电击墙
}

// 魔法类型
export enum MagicType {
  FIRE = 'fire',      // 火球
  WATER = 'water',    // 水流
  ICE = 'ice',        // 冰锥
}

// 游戏状态
export enum GameState {
  MENU = 'menu',
  PLAYING = 'playing',
  PAUSED = 'paused',
  VICTORY = 'victory',
  GAME_OVER = 'game_over',
  BUILD_MODE = 'build_mode',
}

// 向量接口
export interface Vector2 {
  x: number;
  y: number;
}

// 实体基础接口
export interface Entity {
  id: string;
  position: Vector2;
  velocity: Vector2;
  rotation: number;
  radius: number;
  faction: Faction;
  hp: number;
  maxHp: number;
  isDead: boolean;
  level: number;
  update: (deltaTime: number) => void;
  render: (ctx: CanvasRenderingContext2D) => void;
}

// 玩家单位接口
export interface PlayerUnit extends Entity {
  unitType: UnitType;
  speed: number;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  currentCooldown: number;
  magic: number;
  maxMagic: number;
  missiles: number;
  maxMissiles: number;
  overheat: number;
  inventory: Record<ResourceType, number>;
}

// 敌方单位接口
export interface EnemyUnit extends Entity {
  homeBaseId: string;
  state: 'patrol' | 'combat' | 'return' | 'gather';
  target: Entity | null;
  attackDamage: number;
  attackRange: number;
  attackCooldown: number;
  currentCooldown: number;
  speed: number;
}

// 丧尸接口
export interface Zombie extends Entity {
  state: 'idle' | 'wander' | 'chase' | 'attack';
  detectRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  currentCooldown: number;
  target: Entity | null;
  wanderTarget: Vector2 | null;
  isBoss: boolean;
  ashTime: number;
}

// 国家/基地接口
export interface Nation {
  id: string;
  faction: Faction;
  position: Vector2;
  hp: number;
  maxHp: number;
  radius: number;
  rocketProgress: number;
  level: number;
  units: Map<string, EnemyUnit>;
  lastSpawnTime: number;
  spawnInterval: number;
  maxUnits: number;
  color: string;
  name: string;
  // 基地攻击属性
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  currentCooldown: number;
  defense: number;
}

// 建筑接口
export interface Building extends Entity {
  buildingType: BuildingType;
  ownerFaction: Faction;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number;
  currentCooldown: number;
}

// 资源物品接口
export interface ResourceItem extends Entity {
  resourceType: ResourceType;
  amount: number;
}

// 投射物接口
export interface Projectile extends Entity {
  damage: number;
  speed: number;
  lifetime: number;
  maxLifetime: number;
  owner: Entity;
  type: 'bullet' | 'missile' | 'base';
  target?: Zombie | Nation | EnemyUnit | null; // 跟踪目标（用于导弹）
}

// 魔法效果接口
export interface MagicEffect {
  id: string;
  position: Vector2;
  type: MagicType;
  radius: number;
  damage: number;
  lifetime: number;
  maxLifetime: number;
}

// 粒子特效接口
export interface Particle {
  id: string;
  position: Vector2;
  velocity: Vector2;
  color: string;
  size: number;
  lifetime: number;
  maxLifetime: number;
  alpha: number;
  type: 'ash' | 'explosion' | 'magic' | 'spark';
}

// 游戏配置
export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  enemyNationCount: number;
  selectedBackground: number;
  touchControlsEnabled: boolean;
}

// 输入状态
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  missile: boolean;
  magic1: boolean;
  magic2: boolean;
  magic3: boolean;
  build: boolean;
  mouseX: number;
  mouseY: number;
  touchAimX: number;
  touchAimY: number;
  touchAiming: boolean;
  // 摇杆移动
  joystickX: number;
  joystickY: number;
  joystickActive: boolean;
}

// 存档数据
export interface SaveData {
  id: string;
  name: string;
  timestamp: number;
  playerPosition: Vector2;
  playerUnitType: UnitType;
  playerLevel: number;
  inventory: Record<ResourceType, number>;
  rocketProgress: number;
  nations: Nation[];
  buildings: Building[];
}

// 图片资源
export interface GameAssets {
  // 单位
  playerFighter: HTMLImageElement;
  playerTank: HTMLImageElement;
  playerSoldier: HTMLImageElement;
  enemyPlane: HTMLImageElement;
  zombie: HTMLImageElement;
  zombieBoss: HTMLImageElement;
  neutralUnit: HTMLImageElement;
  
  // 基地
  playerBase: HTMLImageElement;
  enemyBase: HTMLImageElement;
  
  // 建筑
  turret: HTMLImageElement;
  electricWall: HTMLImageElement;
  
  // 资源
  steelBar: HTMLImageElement;
  cement: HTMLImageElement;
  chip: HTMLImageElement;
  crystal: HTMLImageElement;
  fuel: HTMLImageElement;
  ammo: HTMLImageElement;
  
  // 特效
  magicFire: HTMLImageElement;
  magicIce: HTMLImageElement;
  magicWater: HTMLImageElement;
  planeExplosion: HTMLImageElement;
  bullet: HTMLImageElement;
  missile: HTMLImageElement;
  
  // 背景
  bgSnow1: HTMLImageElement;
  bgSnow2: HTMLImageElement;
  bgSnow3: HTMLImageElement;
  victoryBg: HTMLImageElement;
  gameoverBg: HTMLImageElement;
  
  // UI
  logo: HTMLImageElement;
  cardFighter: HTMLImageElement;
  cardTank: HTMLImageElement;
  cardSoldier: HTMLImageElement;
  soundOn: HTMLImageElement;
  soundOff: HTMLImageElement;
}

// 触屏控制状态
export interface TouchControls {
  joystick: {
    active: boolean;
    centerX: number;
    centerY: number;
    currentX: number;
    currentY: number;
  };
  buttons: {
    shoot: boolean;
    missile: boolean;
    magic: boolean;
  };
}
