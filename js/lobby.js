/* ===================================================
   NexCall — Lobby (Room Setup) Logic
=================================================== */

import { initThreeBackground } from './three-bg.js';

export function initLobby({ showView, state, generateRoomId, showToast, copyToClipboard }) {
  let previewStream = null;
  let threeInstance = null;

  // --- Elements ---
  const backBtn = document.getElementById('lobby-back-btn');
  const usernameInput = document.getElementById('username-input');
  const previewVideo = document.getElementById('preview-video');
  const previewCamBtn = document.getElementById('preview-cam-btn');
  const previewMicBtn = document.getElementById('preview-mic-btn');
  const previewCamIcon = document.getElementById('preview-cam-icon');
  const previewMicIcon = document.getElementById('preview-mic-icon');
  const avatarPlaceholder = document.getElementById('avatar-placeholder');

  const tabCreate = document.getElementById('tab-create');
  const tabJoin = document.getElementById('tab-join');
  const tabContentCreate = document.getElementById('tab-content-create');
  const tabContentJoin = document.getElementById('tab-content-join');

  const typeOneOne = document.getElementById('type-oneone');
  const typeGroup = document.getElementById('type-group');

  const createRoomBtn = document.getElementById('create-room-btn');
  const joinRoomBtn = document.getElementById('join-room-btn');
  const roomIdInput = document.getElementById('room-id-input');
  const pasteBtn = document.getElementById('paste-btn');

  // --- View lifecycle: when lobby becomes active ---
  const lobbyView = document.getElementById('view-lobby');
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(m => {
      if (m.attributeName === 'class') {
        if (lobbyView.classList.contains('active')) {
          onLobbyOpen();
        } else {
          onLobbyClose();
        }
      }
    });
  });
  observer.observe(lobbyView, { attributes: true });

  function onLobbyOpen() {
    // Start preview camera
    startPreview();
    // Init Three.js background
    if (!threeInstance) {
      threeInstance = initThreeBackground('three-canvas-lobby');
    }
  }

  function onLobbyClose() {
    stopPreview();
    if (threeInstance) {
      threeInstance.stop();
      threeInstance = null;
    }
  }
  // --- HTTPS check for mobile ---
  if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    const banner = document.createElement('div');
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#ef4444;color:#fff;text-align:center;padding:10px 16px;font-size:0.88rem;font-weight:600;font-family:Space Grotesk,sans-serif;';
    banner.innerHTML = '⚠️ Camera requires HTTPS — use the <strong>https://</strong> link, not the IP address!';
    document.body.prepend(banner);
  }

  // --- Camera Preview ---
  let isCamOn = true;
  let isMicOn = true;

  // --- Camera/Mic Preview with progressive fallback ---
  async function startPreview() {
    // Mobile: camera won't work over plain HTTP (non-localhost)
    if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showToast('Camera needs HTTPS. Use the https:// link!', 'error', '🔒');
      avatarPlaceholder.classList.remove('hidden');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Camera not supported in this browser', 'info', '📵');
      avatarPlaceholder.classList.remove('hidden');
      return;
    }

    // Progressive fallback — from HD to bare minimum
    const constraintSets = [
      { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: true },
      { video: { facingMode: 'user' }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false },
      { video: false, audio: true },
    ];

    for (const constraints of constraintSets) {
      try {
        previewStream = await navigator.mediaDevices.getUserMedia(constraints);
        previewVideo.srcObject = previewStream;
        avatarPlaceholder.classList.add('hidden');
        state.isCamOn = !!constraints.video;
        state.isMicOn = !!constraints.audio;
        isCamOn = state.isCamOn;
        isMicOn = state.isMicOn;
        updateCamIcon();
        updateMicIcon();
        if (!constraints.video) showToast('Audio-only mode (no camera found)', 'info', '🎙️');
        return;
      } catch (err) {
        console.warn('[Preview] Constraint failed:', constraints, err.name);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          showToast('Allow camera & mic access in your browser settings', 'error', '🚫');
          avatarPlaceholder.classList.remove('hidden');
          return;
        }
        // continue to next fallback
      }
    }

    avatarPlaceholder.classList.remove('hidden');
    showToast('Camera unavailable. You can still join.', 'info', '📷');
  }

  function stopPreview() {
    if (previewStream) {
      previewStream.getTracks().forEach(t => t.stop());
      previewStream = null;
    }
    if (previewVideo) previewVideo.srcObject = null;
  }

  // --- Controls ---
  previewCamBtn?.addEventListener('click', () => {
    if (!previewStream) return;
    isCamOn = !isCamOn;
    previewStream.getVideoTracks().forEach(t => (t.enabled = isCamOn));
    if (isCamOn) {
      avatarPlaceholder.classList.add('hidden');
    } else {
      avatarPlaceholder.classList.remove('hidden');
    }
    state.isCamOn = isCamOn;
    updateCamIcon();
    previewCamBtn.classList.toggle('muted', !isCamOn);
  });

  previewMicBtn?.addEventListener('click', () => {
    if (!previewStream) return;
    isMicOn = !isMicOn;
    previewStream.getAudioTracks().forEach(t => (t.enabled = isMicOn));
    state.isMicOn = isMicOn;
    updateMicIcon();
    previewMicBtn.classList.toggle('muted', !isMicOn);
  });

  function updateCamIcon() {
    if (!previewCamIcon) return;
    previewCamIcon.className = isCamOn ? 'ph-fill ph-video-camera' : 'ph-fill ph-video-camera-slash';
  }

  function updateMicIcon() {
    if (!previewMicIcon) return;
    previewMicIcon.className = isMicOn ? 'ph-fill ph-microphone' : 'ph-fill ph-microphone-slash';
  }

  // --- Tab Switching ---
  function switchTab(tab) {
    tabCreate.classList.toggle('active', tab === 'create');
    tabJoin.classList.toggle('active', tab === 'join');
    tabContentCreate.classList.toggle('active', tab === 'create');
    tabContentJoin.classList.toggle('active', tab === 'join');
  }

  tabCreate?.addEventListener('click', () => switchTab('create'));
  tabJoin?.addEventListener('click', () => switchTab('join'));

  // --- Room Type ---
  typeOneOne?.addEventListener('click', () => {
    typeOneOne.classList.add('selected');
    typeGroup.classList.remove('selected');
    state.roomType = 'oneone';
  });

  typeGroup?.addEventListener('click', () => {
    typeGroup.classList.add('selected');
    typeOneOne.classList.remove('selected');
    state.roomType = 'group';
  });

  // --- Paste button ---
  pasteBtn?.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && roomIdInput) {
        roomIdInput.value = text.trim().toUpperCase();
        showToast('Pasted from clipboard', 'success', '📋');
      }
    } catch {
      showToast('Could not read clipboard', 'info');
    }
  });

  // --- Back ---
  backBtn?.addEventListener('click', () => {
    onLobbyClose();
    showView('view-landing');
  });

  // --- Create Room ---
  createRoomBtn?.addEventListener('click', () => {
    const name = (usernameInput?.value.trim()) || 'Guest';
    if (!name) {
      showToast('Please enter your name', 'error');
      usernameInput?.focus();
      return;
    }

    state.username = name;
    state.roomId = generateRoomId();

    // Transfer stream to call
    if (previewStream) {
      state.localStream = previewStream;
      previewStream = null;
    }

    stopPreview();
    showView('view-call');
    // trigger call init
    window.dispatchEvent(new CustomEvent('nexcall:startcall', {
      detail: { mode: 'host', roomId: state.roomId }
    }));
  });

  // --- Join Room ---
  joinRoomBtn?.addEventListener('click', () => {
    const name = (usernameInput?.value.trim()) || 'Guest';
    const rawId = roomIdInput?.value.trim().toUpperCase();

    if (!name) {
      showToast('Please enter your name', 'error');
      usernameInput?.focus();
      return;
    }

    if (!rawId || rawId.length < 3) {
      showToast('Please enter a valid Room ID', 'error');
      roomIdInput?.focus();
      return;
    }

    state.username = name;
    state.roomId = rawId;

    if (previewStream) {
      state.localStream = previewStream;
      previewStream = null;
    }

    stopPreview();
    showView('view-call');
    window.dispatchEvent(new CustomEvent('nexcall:startcall', {
      detail: { mode: 'join', roomId: state.roomId }
    }));
  });
}
