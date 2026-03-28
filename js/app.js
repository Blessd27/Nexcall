/* ===================================================
   NexCall — Application Router
=================================================== */

import { initThreeBackground } from './three-bg.js';
import { initLanding } from './landing.js';
import { initLobby } from './lobby.js';
import { initCall } from './call.js';

// App State
export const state = {
  username: 'Guest',
  roomId: null,
  roomType: 'oneone', // 'oneone' | 'group'
  localStream: null,
  isMicOn: true,
  isCamOn: true,
  isScreenSharing: false,
  peer: null,
  connections: {}, // peerId -> { conn (data), call, name }
};

// View switching
export function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(viewId);
  if (target) target.classList.add('active');
}

// Toast system
export function showToast(message, type = 'info', icon = null) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconMap = { success: '✅', error: '❌', info: '💜' };
  const i = icon || iconMap[type] || '💬';

  toast.innerHTML = `<span>${i}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

// Copy to clipboard
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    return true;
  }
}

// Generate room ID using crypto random bytes (collision-proof)
export function generateRoomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const hex = Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}-${hex.slice(8, 12)}`;
}

// The host's PeerJS peer ID IS the room ID — direct 1:1 mapping, no suffix
export function roomToPeerId(roomId) {
  return 'nc-' + roomId.replace(/-/g, '').toUpperCase();
}

// --- Init All Views ---
document.addEventListener('DOMContentLoaded', () => {
  // Init Three.js on landing
  const threeLanding = initThreeBackground('three-canvas');

  // Init modules
  initLanding({ showView, state, threeLanding });
  initLobby({ showView, state, generateRoomId, showToast, copyToClipboard });
  initCall({ showView, state, showToast, copyToClipboard, roomToPeerId });

  // Make video grid display
  const grid = document.getElementById('video-grid');
  if (grid) grid.classList.add('count-1');
});
