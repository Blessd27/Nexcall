# NexCall — 3D Video Calling Platform

> Premium WebRTC-powered video calling with immersive 3D glassmorphism design. No downloads, no accounts — just share a Room ID and connect.

![NexCall](https://img.shields.io/badge/WebRTC-Powered-7c3aed?style=for-the-badge&logo=webrtc)
![PeerJS](https://img.shields.io/badge/PeerJS-1.5.2-06b6d4?style=for-the-badge)
![Vanilla JS](https://img.shields.io/badge/Vanilla-JavaScript-f59e0b?style=for-the-badge&logo=javascript)
![Mobile Ready](https://img.shields.io/badge/Mobile-Responsive-10b981?style=for-the-badge)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🎥 **HD Video Calls** | 720p camera with progressive fallback constraints |
| 👥 **Group Calls** | Up to 8 participants in an adaptive grid layout |
| 📌 **Click-to-Pin Spotlight** | Click any tile to pin it as the main view; others become a filmstrip |
| 🖥️ **Screen Sharing** | Share your screen with audio (Chrome) or video-only (Firefox/Safari) |
| 💬 **Live Chat** | Real-time text chat during calls via WebRTC data channels |
| 🔇 **Mute Output** | Mute all incoming audio with one click (Speaker button) |
| 🔗 **Invite Links** | Share a `?join=ROOM-ID` URL — recipients auto-join the lobby |
| 🌐 **NAT Traversal** | STUN + TURN relay servers for cross-network connectivity |
| 🎨 **3D Design** | Glassmorphism UI with Three.js animated background |
| 📱 **Fully Responsive** | Mobile-first design across all screen sizes |
| 🔒 **E2E Encrypted** | Peer-to-peer WebRTC — your media never touches a server |

---

## 🚀 Getting Started

### Prerequisites
- A modern browser (Chrome 88+, Firefox 78+, Safari 14+)
- **HTTPS is required** for camera/mic access on non-localhost URLs

### Run Locally

```bash
# Clone the repository
git clone https://github.com/your-username/nexcall.git
cd nexcall

# Serve with any static file server
npx serve .
# or
python -m http.server 8080
# or use VS Code Live Server extension
```

Open `http://localhost:8080` in your browser.

> ⚠️ **Do NOT open `index.html` directly** as `file://` — ES modules require an HTTP server.

### Deploy

NexCall is a **100% static site** — no backend needed. Deploy anywhere:

- **Netlify** — drag & drop the folder
- **GitHub Pages** — push to `gh-pages` branch
- **Vercel** — `vercel --prod`
- **Cloudflare Pages** — connect your repo

> 🔒 Make sure your deployment uses HTTPS (all the above do by default) so camera access works.

---

## 📁 Project Structure

```
nexcall/
├── index.html              # Main HTML — all three views (Landing, Lobby, Call)
├── styles/
│   ├── main.css            # Global design tokens, buttons, glass components
│   ├── landing.css         # Landing / hero page styles
│   ├── lobby.css           # Pre-call lobby & room setup styles
│   └── call.css            # In-call view: video grid, controls, panels, spotlight
└── js/
    ├── app.js              # Router — manages view transitions & shared state
    ├── landing.js          # Landing page interactions & Three.js scene
    ├── lobby.js            # Camera preview, room creation/join logic
    ├── call.js             # WebRTC via PeerJS, chat, controls, screen share
    └── three-bg.js         # Shared Three.js animated background helper
```

---

## 🏗️ Architecture

```
Browser A (Host)                    Browser B (Joiner)
      │                                    │
      │         PeerJS Signaling           │
      │◄──────── 0.peerjs.com ────────────►│
      │                                    │
      │◄──── WebRTC P2P (Media + Data) ───►│
      │         STUN: Google / CF          │
      │         TURN: openrelay.metered.ca │
```

- **Signaling**: PeerJS cloud (`0.peerjs.com`) exchanges SDP offers/answers
- **Media**: Direct peer-to-peer after ICE negotiation
- **Data Channel**: Used for chat messages, name exchange, and media-state sync
- **TURN relay**: Used as fallback when both peers are behind strict NAT/firewalls

---

## 🎮 How to Use

### Start a Call
1. Click **"Start a Call"** on the landing page
2. Enter your name and allow camera/mic access
3. Choose **1-on-1** or **Group** room type
4. Click **"Create Room"**
5. Share the **Room ID** or **Invite Link** with participants

### Join a Call
1. Click **"Join a Room"** or open an invite link
2. Enter your name and the **Room ID**
3. Click **"Join Room"**

### In-Call Controls

| Button | Action |
|---|---|
| 🎙️ **Mic** | Toggle your microphone on/off |
| 📹 **Camera** | Toggle your camera on/off |
| 🔊 **Speaker** | Mute/unmute all incoming audio |
| 🖥️ **Screen** | Start/stop screen sharing |
| 📌 **Layout** | Toggle between Grid and Spotlight mode |
| ↔️ **Expand** | Enter/exit fullscreen |
| 💬 **Chat** | Open/close live chat panel |
| 📞 **Leave** | End the call and return to landing |

### Spotlight Mode
1. Click **Layout** button — button turns cyan, mode activates
2. Hover any tile to see the **"Click to Pin"** hint
3. Click a tile → it becomes the large main view, others form a filmstrip at the bottom
4. Click a filmstrip tile → reassign the pin
5. Click the pinned tile again → unpin
6. Click **Layout** again → exit spotlight, return to grid

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| **HTML5 / CSS3 / Vanilla JS** | Core — no framework dependency |
| **WebRTC** | Peer-to-peer audio/video/data |
| **PeerJS 1.5.2** | WebRTC signaling abstraction |
| **Three.js r128** | Animated 3D background canvas |
| **Phosphor Icons** | UI icon library |
| **Google Fonts** | Space Grotesk + Inter typography |
| **CSS Grid + Flexbox** | Responsive video grid layouts |
| **CSS Custom Properties** | Design token system |

---

## 🌐 Browser Compatibility

| Browser | Video | Screen Share | Notes |
|---|---|---|---|
| Chrome 88+ | ✅ | ✅ (with audio) | Best experience |
| Firefox 78+ | ✅ | ✅ (video only) | Audio capture not supported in `getDisplayMedia` |
| Safari 14+ | ✅ | ⚠️ | Requires macOS 13+ for screen share |
| Edge 88+ | ✅ | ✅ | Chromium-based, same as Chrome |
| iOS Safari | ✅ | ❌ | Screen share not supported on iOS |
| Android Chrome | ✅ | ✅ | Supported on Chrome 88+ |

---

## 🔧 Configuration

### ICE Servers
Edit the `iceServers` array in `js/call.js` to use your own TURN server:

```js
const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'your-username',
    credential: 'your-password',
  },
];
```

### PeerJS Server
By default NexCall uses the free PeerJS cloud. For production, [self-host a PeerJS server](https://github.com/peers/peerjs-server):

```js
peer = new Peer(myPeerId, {
  host: 'your-peerjs-server.com',
  port: 443,
  path: '/',
  secure: true,
});
```

---

## 📱 Mobile Support

NexCall is fully responsive with breakpoints at:
- **≤900px** — tablet layout
- **≤768px** — mobile layout (controls wrap, panels go full-screen, labels shrink)
- **≤480px** — small phone (labels hidden, icon-only controls)
- **Landscape** — optimized grid reflow for horizontal phone orientation

---

## ⚠️ Known Limitations

- **TURN relay** uses the free `openrelay.metered.ca` server — for production use, set up your own TURN server (e.g., [Coturn](https://github.com/coturn/coturn))
- **Group calls** beyond 4 participants may experience performance issues on low-end devices due to the mesh P2P topology (each peer connects to every other peer)
- **Screen sharing** with audio only works in Chrome/Edge (browser limitation)

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Acknowledgements

- [PeerJS](https://peerjs.com/) — WebRTC made simple
- [Three.js](https://threejs.org/) — 3D graphics
- [Phosphor Icons](https://phosphoricons.com/) — Beautiful icon library
- [Open Relay](https://www.metered.ca/tools/openrelay/) — Free TURN server

---

<div align="center">
  <strong>Built with ❤️ using pure HTML, CSS & JavaScript</strong>
</div>
