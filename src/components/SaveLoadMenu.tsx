import { useState, useEffect } from 'react';
import { audioManager } from '@/game/AudioManager';
import { getGlobalAssets } from '@/game/AssetLoader';

interface SaveLoadMenuProps {
  onClose: () => void;
  onSave: (slot: number) => boolean;
  onLoad: (slot: number) => boolean;
  onDelete: (slot: number) => boolean;
  onExit?: () => void;
  getSaveSlots: () => Array<{ slot: number; exists: boolean; timestamp?: number }>;
  isMuted?: boolean;
  onToggleMute?: () => void;
  touchControlsEnabled?: boolean;
  onToggleTouchControls?: () => void;
}

export function SaveLoadMenu({ 
  onClose, onSave, onLoad, onDelete, onExit, getSaveSlots,
  isMuted = false, onToggleMute, touchControlsEnabled = false, onToggleTouchControls
}: SaveLoadMenuProps) {
  const [slots, setSlots] = useState<Array<{ slot: number; exists: boolean; timestamp?: number }>>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [activeTab, setActiveTab] = useState<'save' | 'load'>('save');
  const assets = getGlobalAssets();

  useEffect(() => {
    refreshSlots();
  }, []);

  const refreshSlots = () => {
    setSlots(getSaveSlots());
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return '空存档';
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (selectedSlot === null) {
      setMessage({ text: '请先选择一个存档位置', type: 'error' });
      return;
    }
    audioManager.playSound('click');
    const success = onSave(selectedSlot);
    if (success) {
      setMessage({ text: `存档 ${selectedSlot} 保存成功！`, type: 'success' });
      refreshSlots();
    } else {
      setMessage({ text: '保存失败', type: 'error' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleLoad = () => {
    if (selectedSlot === null) {
      setMessage({ text: '请先选择一个存档', type: 'error' });
      return;
    }
    const slot = slots.find(s => s.slot === selectedSlot);
    if (!slot?.exists) {
      setMessage({ text: '该存档位置为空', type: 'error' });
      return;
    }
    audioManager.playSound('click');
    const success = onLoad(selectedSlot);
    if (success) {
      setMessage({ text: `存档 ${selectedSlot} 加载成功！`, type: 'success' });
      setTimeout(() => onClose(), 1000);
    } else {
      setMessage({ text: '加载失败', type: 'error' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleDelete = () => {
    if (selectedSlot === null) {
      setMessage({ text: '请先选择一个存档', type: 'error' });
      return;
    }
    const slot = slots.find(s => s.slot === selectedSlot);
    if (!slot?.exists) {
      setMessage({ text: '该存档位置为空', type: 'error' });
      return;
    }
    if (!confirm(`确定要删除存档 ${selectedSlot} 吗？`)) return;
    
    audioManager.playSound('click');
    const success = onDelete(selectedSlot);
    if (success) {
      setMessage({ text: `存档 ${selectedSlot} 已删除`, type: 'success' });
      refreshSlots();
    } else {
      setMessage({ text: '删除失败', type: 'error' });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-50">
      <div className="bg-gray-900 rounded-2xl p-6 border-2 border-blue-500 w-full max-w-2xl max-h-[90vh] overflow-auto">
        {/* 标题 */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-white">云端存档</h2>
          <button
            onClick={() => { audioManager.playSound('click'); onClose(); }}
            className="text-gray-400 hover:text-white text-2xl transition-colors"
          >
            ✕
          </button>
        </div>

        {/* 标签页 */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { audioManager.playSound('click'); setActiveTab('save'); setSelectedSlot(null); }}
            className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'save'
                ? 'bg-green-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            保存游戏
          </button>
          <button
            onClick={() => { audioManager.playSound('click'); setActiveTab('load'); setSelectedSlot(null); }}
            className={`flex-1 py-3 rounded-lg font-bold transition-colors ${
              activeTab === 'load'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            加载游戏
          </button>
        </div>

        {/* 消息提示 */}
        {message && (
          <div className={`mb-4 p-3 rounded-lg text-center font-bold ${
            message.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {message.text}
          </div>
        )}

        {/* 存档列表 */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {slots.map((slot) => (
            <button
              key={slot.slot}
              onClick={() => { audioManager.playSound('click'); setSelectedSlot(slot.slot); }}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedSlot === slot.slot
                  ? 'border-yellow-400 bg-yellow-400/20'
                  : slot.exists
                  ? 'border-green-500 bg-green-500/10 hover:bg-green-500/20'
                  : 'border-gray-600 bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="text-2xl font-bold text-white mb-1">{slot.slot}</div>
              <div className={`text-xs ${slot.exists ? 'text-green-400' : 'text-gray-500'}`}>
                {slot.exists ? '有存档' : '空'}
              </div>
              {slot.exists && (
                <div className="text-xs text-gray-400 mt-1">
                  {formatDate(slot.timestamp)}
                </div>
              )}
            </button>
          ))}
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-3">
          {activeTab === 'save' ? (
            <>
              <button
                onClick={handleSave}
                disabled={selectedSlot === null}
                className="flex-1 py-4 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
              >
                保存到位置 {selectedSlot || '...'}
              </button>
              {selectedSlot !== null && slots.find(s => s.slot === selectedSlot)?.exists && (
                <button
                  onClick={handleDelete}
                  className="px-6 py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
                >
                  删除
                </button>
              )}
            </>
          ) : (
            <button
              onClick={handleLoad}
              disabled={selectedSlot === null || !slots.find(s => s.slot === selectedSlot)?.exists}
              className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors"
            >
              加载存档 {selectedSlot || '...'}
            </button>
          )}
        </div>

        {/* 退出游戏按钮 */}
        {onExit && (
          <div className="mt-4">
            <button
              onClick={() => { audioManager.playSound('click'); onExit(); }}
              className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
            >
              退出游戏（返回主菜单）
            </button>
          </div>
        )}

        {/* 设置区域 */}
        <div className="mt-4 p-4 bg-gray-800 rounded-lg">
          <h3 className="text-white font-bold mb-3">设置</h3>
          <div className="flex gap-4">
            {/* 静音按钮 */}
            <button
              onClick={() => { audioManager.playSound('click'); onToggleMute?.(); }}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              {assets && (
                <img 
                  src={isMuted ? assets.soundOff.src : assets.soundOn.src} 
                  alt="sound" 
                  className="w-5 h-5"
                />
              )}
              <span className="text-white text-sm">{isMuted ? '已静音' : '声音开启'}</span>
            </button>
            
            {/* 触摸屏按钮切换 */}
            <button
              onClick={() => { audioManager.playSound('click'); onToggleTouchControls?.(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                touchControlsEnabled 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-700 hover:bg-gray-600'
              }`}
            >
              <span className="text-white text-lg">{touchControlsEnabled ? '✓' : '✗'}</span>
              <span className="text-white text-sm">触摸屏按钮</span>
            </button>
          </div>
        </div>

        {/* 说明 */}
        <div className="mt-4 p-3 bg-gray-800 rounded-lg text-gray-400 text-sm">
          <p>💡 提示：游戏会自动保存到浏览器本地存储中</p>
          <p>💡 最多可保存 10 个存档</p>
          <p>💡 按 ESC 键可快速打开此菜单</p>
        </div>
      </div>
    </div>
  );
}
