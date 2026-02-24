// 音频管理器
export class AudioManager {
  private bgm: HTMLAudioElement | null = null;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private isMuted: boolean = false;
  private volume: number = 0.5;
  private soundVolume: number = 0.6;

  // 特定音效的音量倍数
  private soundVolumeMultipliers: Record<string, number> = {
    'pickup': 0.4,      // 飞机坦克制造声音降低
    'shoot': 0.5,       // 攻击声音减半
    'explosion': 1.0,
    'zombie': 1.0,
    'fire': 0.5,        // 火焰攻击也减半
    'water': 1.0,
    'ice': 1.0,
    'victory': 1.0,
    'gameover': 1.0,
    'horde': 1.0,
    'click': 0.8,
    'missile': 0.5,     // 导弹声音也降低
  };

  private soundFiles: Record<string, string> = {
    'bgm': '/assets/bgm-battle.mp3',
    'shoot': '/assets/sfx-shoot.mp3',
    'explosion': '/assets/sfx-explosion.mp3',
    'zombie': '/assets/sfx-zombie.mp3',
    'fire': '/assets/sfx-fire.mp3',
    'water': '/assets/sfx-water.mp3',
    'ice': '/assets/sfx-ice.mp3',
    'pickup': '/assets/sfx-pickup.mp3',
    'victory': '/assets/sfx-victory.mp3',
    'gameover': '/assets/sfx-gameover.mp3',
    'horde': '/assets/sfx-horde.mp3',
    'click': '/assets/sfx-click.mp3',
    'missile': '/assets/sfx-shoot.mp3', // 导弹使用射击音效
  };

  constructor() {
    this.init();
  }

  private init() {
    Object.entries(this.soundFiles).forEach(([name, path]) => {
      const audio = new Audio(path);
      audio.preload = 'auto';
      if (name === 'bgm') {
        audio.loop = true;
        audio.volume = this.volume;
        this.bgm = audio;
      } else {
        audio.volume = this.soundVolume;
      }
      this.sounds.set(name, audio);
    });
  }

  playBGM() {
    if (this.isMuted || !this.bgm) return;
    this.bgm.currentTime = 0;
    this.bgm.play().catch(() => {});
  }

  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }
  }

  playSound(name: string) {
    if (this.isMuted) return;
    const sound = this.sounds.get(name);
    if (sound) {
      const clone = sound.cloneNode() as HTMLAudioElement;
      // 应用特定音效的音量倍数
      const multiplier = this.soundVolumeMultipliers[name] ?? 1.0;
      clone.volume = this.soundVolume * multiplier;
      clone.play().catch(() => {});
    }
  }

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.bgm) {
      this.bgm.muted = this.isMuted;
    }
    this.sounds.forEach(sound => {
      sound.muted = this.isMuted;
    });
    return this.isMuted;
  }

  getIsMuted(): boolean {
    return this.isMuted;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.bgm) {
      this.bgm.volume = this.volume;
    }
  }

  setSoundVolume(vol: number) {
    this.soundVolume = Math.max(0, Math.min(1, vol));
  }
}

export const audioManager = new AudioManager();
