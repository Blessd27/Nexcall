/* ===================================================
   NexCall — Call Room (WebRTC via PeerJS)
=================================================== */

export function initCall({ showView, state, showToast, copyToClipboard, roomToPeerId }) {

  // --- DOM References ---
  const videoGrid = document.getElementById('video-grid');
  const localVideo = document.getElementById('local-video');
  const localAvatar = document.getElementById('local-avatar');
  const localTile = document.getElementById('local-tile');
  const localNameLabel = document.getElementById('local-name-label');
  const waitingOverlay = document.getElementById('waiting-overlay');
  const waitingRoomId = document.getElementById('waiting-room-id');
  const callRoomLabel = document.getElementById('call-room-label');

  // Topbar
  const copyLinkBtn = document.getElementById('copy-link-btn');
  const toggleChatBtn = document.getElementById('toggle-chat-btn');
  const toggleParticipantsBtn = document.getElementById('toggle-participants-btn');
  const chatBadge = document.getElementById('chat-badge');
  const participantsCount = document.getElementById('participants-count');

  // Controls
  const micBtn = document.getElementById('mic-btn');
  const camBtn = document.getElementById('cam-btn');
  const screenBtn = document.getElementById('screen-btn');
  const leaveBtn = document.getElementById('leave-btn');
  const chatCtrlBtn = document.getElementById('chat-ctrl-btn');
  const fullscreenBtn = document.getElementById('fullscreen-btn');
  const gridLayoutBtn = document.getElementById('grid-layout-btn');
  const speakerBtn = document.getElementById('speaker-btn');
  const micIcon = document.getElementById('mic-icon');
  const camIcon = document.getElementById('cam-icon');
  const screenIcon = document.getElementById('screen-icon');
  const fullscreenIcon = document.getElementById('fullscreen-icon');
  const speakerIcon = document.getElementById('speaker-icon');
  const gridIcon = document.getElementById('grid-icon');

  // Chat
  const chatPanel = document.getElementById('chat-panel');
  const chatMessages = document.getElementById('chat-messages');
  const chatInput = document.getElementById('chat-input');
  const sendChatBtn = document.getElementById('send-chat-btn');
  const closeChatBtn = document.getElementById('close-chat-btn');

  // Participants
  const participantsPanel = document.getElementById('participants-panel');
  const participantsListEl = document.getElementById('participants-list');
  const closeParticipantsBtn = document.getElementById('close-participants-btn');

  // Waiting overlay buttons
  const copyWaitingBtn = document.getElementById('copy-waiting-btn');
  const shareLinkBtn = document.getElementById('share-link-btn');

  // Local state
  let peer = null;
  let screenStream = null;
  let isChatOpen = false;
  let isParticipantsOpen = false;
  let unreadMessages = 0;
  let layoutMode = 0; // 0=grid, 1=spotlight
  let connections = {}; // peerId -> { call, dataConn, name }
  let isCallActive = false;
  let isSpeakerMuted = false;
  let pinnedPeerId = null; // 'local' | peerId | null

  // --- ICE Servers (STUN + TURN for NAT traversal across the internet) ---
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    // Free TURN relay — needed when both peers are behind strict NAT/firewall
    { urls: 'turn:openrelay.metered.ca:80',       username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443',      username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ];

  // --- Camera/Mic with progressive fallback (critical for mobile) ---
  async function getMediaStreamWithFallback() {
    // Check HTTPS requirement (mobile browsers block camera on HTTP except localhost)
    if (location.protocol === 'http:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      showToast('Camera requires HTTPS. Use the secure link!', 'error', '🔒');
      return null;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showToast('Camera/mic not supported in this browser', 'error', '📵');
      return null;
    }

    // Progressive constraints — try HD first, fall back to simpler for mobile
    const constraintSets = [
      { video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: true },
      { video: { facingMode: 'user' }, audio: true },
      { video: true, audio: true },
      { video: true, audio: false }, // no mic fallback
      { video: false, audio: true }, // audio only
    ];

    for (const constraints of constraintSets) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (!constraints.video) {
          showToast('Camera unavailable, audio-only mode', 'info', '🎙️');
        }
        return stream;
      } catch (err) {
        console.warn('[Media] Constraint failed:', constraints, err.name);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          showToast('Camera/mic permission denied. Please allow access.', 'error', '🚫');
          return null; // No point retrying with different constraints
        }
        // Try next fallback for OverconstrainedError, NotFoundError etc.
      }
    }

    showToast('Could not access camera or microphone', 'error', '📵');
    return null;
  }

  // --- Call Init Event ---
  window.addEventListener('nexcall:startcall', async (e) => {
    const { mode, roomId } = e.detail;
    await setupCall(mode, roomId);
  });


  async function setupCall(mode, roomId) {
    isCallActive = true;
    connections = {};

    // Update UI labels
    if (callRoomLabel) callRoomLabel.textContent = `Room: ${roomId}`;
    if (waitingRoomId) waitingRoomId.textContent = roomId;
    if (localNameLabel) localNameLabel.textContent = `${state.username} (You)`;

    // Attach local video
    if (state.localStream) {
      localVideo.srcObject = state.localStream;
      const hasVideo = state.localStream.getVideoTracks().length > 0 &&
                       state.localStream.getVideoTracks()[0].enabled;
      localAvatar.className = hasVideo ? 'video-avatar hidden' : 'video-avatar visible';
    } else {
      // Try to get stream with progressive fallback (important for mobile)
      state.localStream = await getMediaStreamWithFallback();
      if (state.localStream) {
        localVideo.srcObject = state.localStream;
        localAvatar.className = 'video-avatar hidden';
      } else {
        localAvatar.classList.remove('hidden');
        if (localAvatar.querySelector('i')) localAvatar.querySelector('i').className = 'ph ph-user';
      }
    }

    // Apply initial mute states
    applyMicState();
    applyCamState();
    updateButtons();
    updateParticipantsPanel();
    updateGrid();

    // Show waiting overlay
    showWaiting(true);

    // --- Host peer ID = room ID directly (1:1 mapping)
    // --- Joiner gets a unique random peer ID
    const myPeerId = mode === 'host'
      ? roomToPeerId(roomId)   // e.g. nc-A3F2B1C4D5E6 — this IS the room
      : 'nc-' + Array.from(crypto.getRandomValues(new Uint8Array(6)))
                   .map(b => b.toString(16).padStart(2, '0'))
                   .join('')
                   .toUpperCase();

    let retryCount = 0;
    const maxRetries = 5;

    function createPeer() {
      if (peer) { try { peer.destroy(); } catch(_) {} }

      peer = new Peer(myPeerId, {
        host: '0.peerjs.com',
        port: 443,
        path: '/',
        secure: true,
        debug: 1,
        config: { iceServers, iceTransportPolicy: 'all' },
      });

      state.peer = peer;

      peer.on('open', (id) => {
        console.log('[PeerJS] Connected as:', id);
        showToast(`Connected to room ${roomId}`, 'success', '🔗');

        if (mode === 'join') {
          // Connect directly to host — host peer ID = roomToPeerId(roomId)
          const hostPeerId = roomToPeerId(roomId);
          connectToPeer(hostPeerId);
        }
      });

      peer.on('call', (incomingCall) => {
        incomingCall.answer(state.localStream || new MediaStream());
        setupCallHandlers(incomingCall, incomingCall.peer);
      });

      peer.on('connection', (dataConn) => {
        setupDataConnection(dataConn);
      });

      peer.on('error', (err) => {
        console.error('[PeerJS] Error:', err.type, err);

        if (err.type === 'unavailable-id') {
          // Host peer ID already taken — shouldn't happen with crypto IDs, but handle it
          showToast('Room ID conflict. Please create a new room.', 'error');

        } else if (err.type === 'peer-unavailable') {
          // Host not found — retry with backoff
          retryCount++;
          if (retryCount <= maxRetries) {
            const delay = Math.min(1000 * retryCount, 5000);
            showToast(`Host not reachable, retrying (${retryCount}/${maxRetries})...`, 'info', '🔄');
            setTimeout(() => {
              if (!isCallActive) return;
              const hostPeerId = roomToPeerId(roomId);
              connectToPeer(hostPeerId);
            }, delay);
          } else {
            showToast('Could not find host. Check the Room ID and try again.', 'error', '❌');
          }

        } else if (err.type === 'network' || err.type === 'server-error') {
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = 2000 * retryCount;
            showToast(`Connection issue, reconnecting...`, 'info', '🔄');
            setTimeout(() => { if (isCallActive) createPeer(); }, delay);
          } else {
            showToast(`Network error: ${err.type}`, 'error');
          }
        } else {
          showToast(`Connection error: ${err.type}`, 'error');
        }
      });
    }

    try {
      createPeer();
    } catch (err) {
      console.error('[PeerJS] Init error:', err);
      showToast('Failed to initialize connection', 'error');
    }
  }

  function connectToPeer(remotePeerId) {
    if (!peer || !isCallActive) return;

    console.log('[PeerJS] Connecting to:', remotePeerId);

    // Data channel
    const dataConn = peer.connect(remotePeerId, {
      metadata: { name: state.username }
    });
    setupDataConnection(dataConn);

    // Media call
    const call = peer.call(remotePeerId, state.localStream, {
      metadata: { name: state.username }
    });
    setupCallHandlers(call, remotePeerId);
  }

  function setupCallHandlers(call, peerId) {
    call.on('stream', (remoteStream) => {
      console.log('[PeerJS] Got remote stream from:', peerId);

      const name = connections[peerId]?.name || getNameFromPeer(peerId);

      if (!connections[peerId]) {
        connections[peerId] = { call, name };
      } else {
        connections[peerId].call = call;
      }

      addRemoteVideo(peerId, remoteStream, name);
      showWaiting(false);
      updateGrid();
      updateParticipantsPanel();
      updateCountLabel();

      showToast(`${name} joined the call`, 'success', '👤');
    });

    call.on('close', () => {
      removeRemotePeer(peerId);
    });

    call.on('error', (err) => {
      console.error('[PeerJS] Call error:', err);
      removeRemotePeer(peerId);
    });
  }

  function setupDataConnection(dataConn) {
    const peerId = dataConn.peer;
    const remoteName = dataConn.metadata?.name || getNameFromPeer(peerId);

    if (!connections[peerId]) {
      connections[peerId] = { name: remoteName };
    } else {
      connections[peerId].name = remoteName;
    }
    connections[peerId].dataConn = dataConn;

    dataConn.on('open', () => {
      // Send our name
      dataConn.send({ type: 'name', name: state.username });

      // If we're host and have existing peers, notify them about the new peer
      if (peer && peer.id.includes('-host')) {
        // broadcast new peer to others
        Object.entries(connections).forEach(([pid, c]) => {
          if (pid !== peerId && c.dataConn && c.dataConn.open) {
            c.dataConn.send({ type: 'peer-joined', peerId, name: remoteName });
          }
        });

        // Tell new peer about existing peers
        const existingPeers = Object.entries(connections)
          .filter(([pid]) => pid !== peerId)
          .map(([pid, c]) => ({ peerId: pid, name: c.name || 'Unknown' }));

        if (existingPeers.length > 0) {
          dataConn.send({ type: 'peer-list', peers: existingPeers });
        }
      }
    });

    dataConn.on('data', (data) => {
      handleDataMessage(data, peerId);
    });

    dataConn.on('close', () => {
      removeRemotePeer(peerId);
    });
  }

  function handleDataMessage(data, fromPeerId) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'name': {
        if (connections[fromPeerId]) {
          connections[fromPeerId].name = data.name;
        }
        updateParticipantsPanel();
        break;
      }

      case 'chat': {
        addChatMessage(data.message, data.senderName, 'other');
        if (!isChatOpen) {
          unreadMessages++;
          updateChatBadge();
        }
        break;
      }

      case 'media-state': {
        const tile = document.getElementById(`tile-${fromPeerId}`);
        if (tile) {
          const micInd = tile.querySelector('.mic-indicator');
          const camInd = tile.querySelector('.cam-indicator');
          if (micInd) micInd.classList.toggle('muted', !data.micOn);
          if (camInd) camInd.classList.toggle('cam-off', !data.camOn);

          const avatar = tile.querySelector('.video-avatar');
          if (avatar) {
            avatar.className = data.camOn ? 'video-avatar hidden' : 'video-avatar visible';
          }
        }
        break;
      }

      case 'peer-list': {
        // Connect to all existing peers in the room
        if (data.peers && Array.isArray(data.peers)) {
          data.peers.forEach(({ peerId: pid, name }) => {
            if (!connections[pid] && pid !== peer?.id) {
              if (!connections[pid]) connections[pid] = {};
              connections[pid].name = name;
              setTimeout(() => connectToPeer(pid), 300);
            }
          });
        }
        break;
      }

      case 'peer-joined': {
        if (data.peerId && data.peerId !== peer?.id && !connections[data.peerId]) {
          connections[data.peerId] = { name: data.name };
          setTimeout(() => connectToPeer(data.peerId), 300);
        }
        break;
      }
    }
  }

  // --- Remote Video Management ---
  function addRemoteVideo(peerId, stream, name) {
    const existingTile = document.getElementById(`tile-${peerId}`);
    if (existingTile) {
      // Update stream
      const video = existingTile.querySelector('video');
      if (video) video.srcObject = stream;
      return;
    }

    const initial = (name || 'U').charAt(0).toUpperCase();
    const tile = document.createElement('div');
    tile.className = 'video-tile remote-tile';
    tile.id = `tile-${peerId}`;
    tile.innerHTML = `
      <video autoplay playsinline></video>
      <div class="video-avatar visible">
        <div class="avatar-circle">${initial}</div>
        <span class="avatar-name">${name || 'Participant'}</span>
      </div>
      <div class="tile-overlay">
        <div class="tile-name">${name || 'Participant'}</div>
        <div class="tile-indicators">
          <span class="indicator mic-indicator"><i class="ph-fill ph-microphone"></i></span>
        </div>
      </div>
      <div class="tile-3d-border"></div>
    `;

    videoGrid.appendChild(tile);

    const video = tile.querySelector('video');
    video.srcObject = stream;

    video.addEventListener('loadedmetadata', () => {
      video.play().catch(() => {});
    });

    // Apply speaker mute to new remote video immediately
    video.volume = isSpeakerMuted ? 0 : 1;
    video.muted = isSpeakerMuted;

    // Hide avatar when video plays
    video.addEventListener('play', () => {
      const avatar = tile.querySelector('.video-avatar');
      if (avatar) avatar.className = 'video-avatar hidden';
    });

    // Tilt effect on tile
    tile.addEventListener('mousemove', (e) => {
      if (layoutMode === 1) return; // disable tilt in spotlight
      const rect = tile.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / (rect.width / 2);
      const dy = (e.clientY - cy) / (rect.height / 2);
      tile.style.transform = `perspective(600px) rotateX(${-dy * 3}deg) rotateY(${dx * 3}deg)`;
    });
    tile.addEventListener('mouseleave', () => {
      tile.style.transform = '';
    });

    // Click to pin in spotlight mode
    tile.addEventListener('click', () => {
      if (layoutMode === 1) pinTile(tile, peerId);
    });
  }

  function removeRemotePeer(peerId) {
    const tile = document.getElementById(`tile-${peerId}`);
    if (tile) {
      tile.style.animation = 'none';
      tile.style.transition = 'opacity 0.3s, transform 0.3s';
      tile.style.opacity = '0';
      tile.style.transform = 'scale(0.8)';
      setTimeout(() => tile.remove(), 350);
    }

    // If this peer was pinned, release the pin
    if (pinnedPeerId === peerId) {
      pinnedPeerId = null;
      videoGrid.classList.remove('has-pin');
      videoGrid.style.removeProperty('--filmstrip-cols');
    }

    const name = connections[peerId]?.name || 'A participant';
    delete connections[peerId];

    showToast(`${name} left the call`, 'info', '👋');
    updateGrid();
    updateParticipantsPanel();
    updateCountLabel();

    if (Object.keys(connections).length === 0) {
      showWaiting(true);
    }
  }

  // --- Grid Update ---
  function updateGrid() {
    const count = 1 + Object.keys(connections).length;
    videoGrid.className = `video-grid count-${Math.min(count, 8)}`;
    if (isChatOpen || isParticipantsOpen) videoGrid.classList.add('with-panel');
    if (layoutMode === 1) videoGrid.classList.add('spotlight-mode');
    if (pinnedPeerId !== null) videoGrid.classList.add('has-pin');
    if (layoutMode === 1 && pinnedPeerId !== null) updateFilmstripCols();
  }

  // --- Waiting overlay ---
  function showWaiting(show) {
    if (waitingOverlay) {
      waitingOverlay.className = show ? 'waiting-overlay' : 'waiting-overlay hidden';
    }
  }

  // --- Controls ---
  micBtn?.addEventListener('click', () => {
    state.isMicOn = !state.isMicOn;
    applyMicState();
    updateButtons();
    broadcastMediaState();
  });

  camBtn?.addEventListener('click', () => {
    state.isCamOn = !state.isCamOn;
    applyCamState();
    updateButtons();
    broadcastMediaState();
  });

  screenBtn?.addEventListener('click', () => toggleScreenShare());
  leaveBtn?.addEventListener('click', () => leaveCall());

  chatCtrlBtn?.addEventListener('click', () => toggleChat());
  toggleChatBtn?.addEventListener('click', () => toggleChat());

  // Speaker / audio output mute
  speakerBtn?.addEventListener('click', () => {
    isSpeakerMuted = !isSpeakerMuted;
    applyOutputMute();
    updateSpeakerButton();
    showToast(
      isSpeakerMuted ? 'Audio output muted' : 'Audio output on',
      isSpeakerMuted ? 'info' : 'success',
      isSpeakerMuted ? '🔇' : '🔊'
    );
  });

  fullscreenBtn?.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      if (fullscreenIcon) fullscreenIcon.className = 'ph ph-arrows-in';
    } else {
      document.exitFullscreen();
      if (fullscreenIcon) fullscreenIcon.className = 'ph ph-arrows-out';
    }
  });

  gridLayoutBtn?.addEventListener('click', () => {
    layoutMode = (layoutMode + 1) % 2;
    if (layoutMode === 1) {
      videoGrid.classList.add('spotlight-mode');
      if (gridIcon) gridIcon.className = 'ph-fill ph-push-pin';
      gridLayoutBtn.classList.add('active', 'layout-spotlight');
      showToast('Spotlight — tap any tile to pin it', 'info', '📌');
    } else {
      exitSpotlightMode();
      if (gridIcon) gridIcon.className = 'ph ph-grid-four';
      gridLayoutBtn.classList.remove('active', 'layout-spotlight');
      showToast('Grid layout', 'info', '🔲');
    }
  });

  // Click local tile to pin in spotlight mode
  localTile?.addEventListener('click', () => {
    if (layoutMode === 1) pinTile(localTile, 'local');
  });

  // Copy link
  copyLinkBtn?.addEventListener('click', () => copyRoomLink());
  copyWaitingBtn?.addEventListener('click', () => copyToClipboard(state.roomId).then(() => showToast('Room ID copied!', 'success', '📋')));
  shareLinkBtn?.addEventListener('click', () => copyRoomLink());

  function copyRoomLink() {
    const link = `${window.location.href.split('#')[0]}#join=${state.roomId}`;
    copyToClipboard(link).then(() => showToast('Invite link copied!', 'success', '🔗'));
  }

  toggleParticipantsBtn?.addEventListener('click', () => toggleParticipants());
  closeParticipantsBtn?.addEventListener('click', () => toggleParticipants(false));

  // --- Media State Helpers ---
  function applyMicState() {
    if (!state.localStream) return;
    state.localStream.getAudioTracks().forEach(t => (t.enabled = state.isMicOn));

    const micInd = document.getElementById('local-mic-ind');
    if (micInd) micInd.classList.toggle('muted', !state.isMicOn);
  }

  function applyCamState() {
    if (!state.localStream) return;
    state.localStream.getVideoTracks().forEach(t => (t.enabled = state.isCamOn));

    // Show/hide avatar
    localAvatar.className = state.isCamOn ? 'video-avatar hidden' : 'video-avatar visible';
  }

  function broadcastMediaState() {
    Object.values(connections).forEach(c => {
      if (c.dataConn && c.dataConn.open) {
        c.dataConn.send({
          type: 'media-state',
          micOn: state.isMicOn,
          camOn: state.isCamOn,
        });
      }
    });
  }

  // Apply speaker mute to all remote <video> elements
  function applyOutputMute() {
    const remoteVideos = videoGrid.querySelectorAll('.remote-tile video');
    remoteVideos.forEach(v => {
      v.volume = isSpeakerMuted ? 0 : 1;
      v.muted = isSpeakerMuted;
    });
  }

  function updateSpeakerButton() {
    if (speakerBtn) {
      speakerBtn.classList.toggle('active', isSpeakerMuted);
      speakerBtn.classList.toggle('speaker-muted', isSpeakerMuted);
    }
    if (speakerIcon) {
      speakerIcon.className = isSpeakerMuted
        ? 'ph-fill ph-speaker-slash'
        : 'ph-fill ph-speaker-high';
    }
  }

  // --- Spotlight / Pin Mode ---
  function pinTile(tileEl, peerId) {
    // Toggle off if already pinned
    if (pinnedPeerId === peerId) {
      tileEl.classList.remove('pinned');
      removePinBadge(tileEl);
      pinnedPeerId = null;
      videoGrid.classList.remove('has-pin');
      videoGrid.style.removeProperty('--filmstrip-cols');
      showToast('Unpinned', 'info', '📌');
      return;
    }
    // Unpin previous
    const prev = videoGrid.querySelector('.video-tile.pinned');
    if (prev) { prev.classList.remove('pinned'); removePinBadge(prev); }
    // Pin new tile
    tileEl.classList.add('pinned');
    addPinBadge(tileEl);
    pinnedPeerId = peerId;
    videoGrid.classList.add('has-pin');
    updateFilmstripCols();
    const name = tileEl.querySelector('.tile-name')?.textContent || 'Tile';
    showToast(`${name} pinned`, 'success', '📌');
  }

  function exitSpotlightMode() {
    const pinned = videoGrid.querySelector('.video-tile.pinned');
    if (pinned) { pinned.classList.remove('pinned'); removePinBadge(pinned); }
    pinnedPeerId = null;
    videoGrid.classList.remove('spotlight-mode', 'has-pin');
    videoGrid.style.removeProperty('--filmstrip-cols');
  }

  function updateFilmstripCols() {
    const n = videoGrid.querySelectorAll('.video-tile:not(.pinned)').length;
    videoGrid.style.setProperty('--filmstrip-cols', Math.max(1, n));
  }

  function addPinBadge(tileEl) {
    removePinBadge(tileEl);
    const b = document.createElement('div');
    b.className = 'pin-badge';
    b.innerHTML = '<i class="ph-fill ph-push-pin"></i> Pinned';
    tileEl.appendChild(b);
  }

  function removePinBadge(tileEl) {
    tileEl.querySelector('.pin-badge')?.remove();
  }

  function updateButtons() {
    // Mic
    if (micBtn) micBtn.classList.toggle('active', !state.isMicOn);
    if (micIcon) micIcon.className = state.isMicOn ? 'ph-fill ph-microphone' : 'ph-fill ph-microphone-slash';

    // Cam
    if (camBtn) camBtn.classList.toggle('active', !state.isCamOn);
    if (camIcon) camIcon.className = state.isCamOn ? 'ph-fill ph-video-camera' : 'ph-fill ph-video-camera-slash';
  }

  // --- Screen Share ---
  async function toggleScreenShare() {
    if (state.isScreenSharing) {
      stopScreenShare();
    } else {
      await startScreenShare();
    }
  }

  async function startScreenShare() {
    // Not supported on iOS / old browsers
    if (!navigator.mediaDevices?.getDisplayMedia) {
      showToast('Screen sharing not supported on this device', 'error', '📵');
      return;
    }

    try {
      // Try with audio (Chrome), fall back to video-only (Firefox/Safari)
      try {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' }, audio: true,
        });
      } catch (_) {
        screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' },
        });
      }

      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) throw new Error('No video track captured');

      // Show screen in local tile
      localVideo.srcObject = screenStream;
      localTile.classList.add('screen-tile');

      // Push to all peers — replaceTrack if sender exists, addTrack if audio-only join
      Object.values(connections).forEach(c => {
        if (!c.call?.peerConnection) return;
        const pc = c.call.peerConnection;
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(screenTrack).catch(e => console.warn('[Screen] replaceTrack:', e));
        } else {
          pc.addTrack(screenTrack, screenStream);
        }
      });

      state.isScreenSharing = true;
      if (screenBtn) screenBtn.classList.add('active', 'screen-share');
      if (screenIcon) screenIcon.className = 'ph-fill ph-monitor';
      showToast('Screen sharing started', 'success', '🖥️');
      screenTrack.addEventListener('ended', () => stopScreenShare());

    } catch (err) {
      console.error('[ScreenShare]', err);
      if (err.name !== 'NotAllowedError' && err.name !== 'AbortError') {
        showToast(`Screen share failed: ${err.message || err.name}`, 'error', '❌');
      }
      screenStream = null;
    }
  }

  function stopScreenShare() {
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
    }

    // Restore camera
    localVideo.srcObject = state.localStream;
    localTile.classList.remove('screen-tile');

    // Restore camera track in peers
    const camTrack = state.localStream?.getVideoTracks()[0];
    if (camTrack) {
      Object.values(connections).forEach(c => {
        if (c.call && c.call.peerConnection) {
          const sender = c.call.peerConnection.getSenders().find(s => s.track?.kind === 'video');
          if (sender) sender.replaceTrack(camTrack);
        }
      });
    }

    state.isScreenSharing = false;
    if (screenBtn) screenBtn.classList.remove('active', 'screen-share');
    if (screenIcon) screenIcon.className = 'ph ph-monitor';
    showToast('Screen sharing stopped', 'info', '🖥️');
  }

  // --- Leave Call ---
  function leaveCall() {
    isCallActive = false;

    // Stop all streams
    if (state.localStream) {
      state.localStream.getTracks().forEach(t => t.stop());
      state.localStream = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach(t => t.stop());
      screenStream = null;
    }

    // Close all connections
    Object.values(connections).forEach(c => {
      c.call?.close();
      c.dataConn?.close();
    });
    connections = {};

    // Destroy peer
    if (peer) {
      peer.destroy();
      peer = null;
      state.peer = null;
    }

    // Clean up video tiles
    const remoteTiles = videoGrid.querySelectorAll('.remote-tile');
    remoteTiles.forEach(t => t.remove());

    // Reset local video
    localVideo.srcObject = null;

    // Reset UI
    isChatOpen = false;
    isParticipantsOpen = false;
    if (chatPanel) chatPanel.classList.remove('open');
    if (participantsPanel) participantsPanel.classList.remove('open');
    if (chatMessages) chatMessages.innerHTML = '<div class="chat-system-msg">Chat started. Say hello! 👋</div>';
    unreadMessages = 0;
    updateChatBadge();
    showWaiting(true);
    updateGrid();

    showView('view-landing');
    showToast('You left the call', 'info', '👋');
  }

  // --- URL Hash Join ---
  function checkUrlHash() {
    const hash = window.location.hash;
    const match = hash.match(/join=([A-Z0-9\-]+)/i);
    if (match) {
      const roomId = match[1].toUpperCase();
      window.location.hash = '';
      // Fill in the lobby
      setTimeout(() => {
        showView('view-lobby');
        const tabJoin = document.getElementById('tab-join');
        tabJoin?.click();
        const roomInput = document.getElementById('room-id-input');
        if (roomInput) roomInput.value = roomId;
        showToast(`Room link detected. Enter your name to join!`, 'info', '🔗');
      }, 100);
    }
  }

  checkUrlHash();

  // --- Chat ---
  function toggleChat(force) {
    isChatOpen = force !== undefined ? force : !isChatOpen;
    if (chatPanel) chatPanel.classList.toggle('open', isChatOpen);
    if (chatCtrlBtn) chatCtrlBtn.classList.toggle('active', isChatOpen);
    if (chatCtrlBtn) chatCtrlBtn.classList.toggle('chat-open', isChatOpen);

    if (isChatOpen) {
      unreadMessages = 0;
      updateChatBadge();
      chatInput?.focus();
      // Close participants if open
      if (isParticipantsOpen) toggleParticipants(false);
    }

    updateGrid();
  }

  function toggleParticipants(force) {
    isParticipantsOpen = force !== undefined ? force : !isParticipantsOpen;
    if (participantsPanel) participantsPanel.classList.toggle('open', isParticipantsOpen);

    if (isParticipantsOpen && isChatOpen) toggleChat(false);
    updateGrid();
  }

  closeChatBtn?.addEventListener('click', () => toggleChat(false));

  sendChatBtn?.addEventListener('click', () => sendChatMessage());
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  function sendChatMessage() {
    const msg = chatInput?.value.trim();
    if (!msg) return;

    addChatMessage(msg, state.username, 'own');

    // Broadcast to all peers
    Object.values(connections).forEach(c => {
      if (c.dataConn && c.dataConn.open) {
        c.dataConn.send({
          type: 'chat',
          message: msg,
          senderName: state.username,
        });
      }
    });

    if (chatInput) chatInput.value = '';
  }

  function addChatMessage(message, senderName, type) {
    const div = document.createElement('div');
    div.className = `chat-msg ${type}`;
    div.innerHTML = `
      <div class="chat-msg-name">${senderName}</div>
      <div class="chat-msg-bubble">${escapeHtml(message)}</div>
    `;
    chatMessages?.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function updateChatBadge() {
    if (chatBadge) {
      if (unreadMessages > 0 && !isChatOpen) {
        chatBadge.textContent = unreadMessages > 9 ? '9+' : unreadMessages;
        chatBadge.style.display = 'flex';
      } else {
        chatBadge.style.display = 'none';
      }
    }
  }

  // --- Participants Panel Update ---
  function updateParticipantsPanel() {
    if (!participantsListEl) return;
    participantsListEl.innerHTML = '';

    // Self
    addParticipantItem(state.username, '(You)', state.isMicOn, state.isCamOn);

    // Peers
    Object.values(connections).forEach(c => {
      addParticipantItem(c.name || 'Participant', '', true, true);
    });
  }

  function addParticipantItem(name, suffix, micOn, camOn) {
    const item = document.createElement('div');
    item.className = 'participant-item';
    const initial = (name || 'U').charAt(0).toUpperCase();
    item.innerHTML = `
      <div class="participant-avatar">${initial}</div>
      <div class="participant-info">
        <div class="participant-name">${name}${suffix ? ' ' + suffix : ''}</div>
        <div class="participant-status">In call</div>
      </div>
      <div class="participant-icons">
        <i class="ph-fill ph-microphone ${micOn ? '' : 'muted'}" title="${micOn ? 'Mic on' : 'Muted'}"></i>
        <i class="ph-fill ph-video-camera ${camOn ? '' : 'muted'}" title="${camOn ? 'Camera on' : 'Camera off'}"></i>
      </div>
    `;
    participantsListEl.appendChild(item);
  }

  function updateCountLabel() {
    const total = 1 + Object.keys(connections).length;
    if (participantsCount) participantsCount.textContent = total;
  }

  function getNameFromPeer(peerId) {
    return connections[peerId]?.name || 'Participant';
  }
}
