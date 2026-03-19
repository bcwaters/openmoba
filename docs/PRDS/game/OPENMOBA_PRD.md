# Product Requirements Document (PRD)
## OpenMOBA: Three.js Backend Integration

### 1. Introduction
This document outlines the requirements for integrating the Three.js rendering engine with the backend server for the OpenMOBA multiplayer game. The goal is to establish a clear, maintainable connection between the game logic running on the server and the visual representation running in the client (initially browser, with future Electron portability).

### 2. Goals
- Enable real-time synchronization of game state between backend and Three.js client.
- Implement core V1 mechanics: player movement and fog of war rendering.
- Ensure the client-server transport layer is portable to Electron desktop applications.
- Maintain a clean separation of concerns: game logic on server, rendering on client.
- Support 10 concurrent players per game room with low-latency updates.

### 3. Scope (V1 - Movement + Fog of War)
**In Scope:**
- Backend: Game server logic (player positions, movement validation, fog of war state calculation).
- Client: Three.js renderer that receives game state and renders:
  - Terrain/ground plane.
  - Player avatars (simple shapes or models).
  - Fog of war effect (hiding unexplored areas).
- Communication: WebSocket connection for bi-directional, real-time data exchange.
- Input handling: Capturing keyboard/mouse input on client, sending movement intents to server.
- Basic room/lobby system for 10-player matches.

**Out of Scope (for V1):**
- Advanced abilities/combat systems.
- Persistent player profiles or progression.
- Complex terrain/obstacles (beyond flat plane).
- UI menus (settings, chat, etc.) - though basic overlay may be needed for debugging.
- Server-side rendering or headless Three.js for validation.
- Physics engine integration (beyond simple collision for movement).

### 4. Non-Goals
- Using React for the UI layer (explicitly requested to use Three.js directly).
- Mobile touch controls (initial focus on keyboard/mouse).
- VR/AR support.
- Cross-platform play beyond desktop/browser (Electron is a future consideration, not V1).

### 5. Functional Requirements
#### 5.1 Game Client (Three.js)
- **FR-C1:** Initialize a Three.js scene with camera (top-down orthographic or perspective), renderer, and lighting.
- **FR-C2:** Render a flat ground plane representing the game map.
- **FR-C3:** Render player avatars at positions received from the server.
- **FR-C4:** Implement fog of war: hide areas of the map not yet explored by the player's team.
- **FR-C5:** Capture keyboard input (WASD/arrow keys) for movement intent.
- **FR-C6:** Send movement intents (direction, desired speed) to the server via WebSocket.
- **FR-C7:** Interpolate player positions smoothly between server updates to reduce perceived latency.
- **FR-C8:** Handle connection loss and attempt reconnection with exponential backoff.
- **FR-C9:** Provide basic FPS counter and connection status debug overlay (optional).

#### 5.2 Game Server
- **FR-S1:** Maintain authoritative game state for each room (max 10 players).
- **FR-S2:** Validate and apply player movement intents from clients (with basic collision/no-wall checks).
- **FR-S3:** Calculate and distribute fog of war state per player/team (what areas are visible).
- **FR-S4:** Broadcast game state updates (player positions, fog of war) to all clients in the room at a fixed tick rate (e.g., 10Hz).
- **FR-S5:** Handle player connections, disconnections, and room assignment.
- **FR-S6:** Ensure server logic is deterministic and independent of rendering concerns.

#### 5.3 Communication
- **FR-M1:** Use WebSocket (Socket.IO or native ws) for low-latency, bidirectional communication.
- **FR-M2:** Define a minimal protocol for:
  - Client → Server: `{ type: 'move_intent', direction: {x: number, y: number} }`
  - Server → Client: `{ type: 'game_state', players: [{id, position, team}], fogOfWar: { ... } }`
- **FR-M3:** Implement heartbeat/ping to detect stale connections.
- **FR-M4:** Encapsulate transport layer to allow swapping WebSocket for other mechanisms (e.g., WebRTC, Electron IPC) without changing game logic.

### 6. Technical Requirements
#### 6.1 Performance
- **TR-P1:** Client target: 60 FPS on mid-range desktop/laptop with integrated graphics.
- **TR-P2:** Server target: Handle 50 concurrent rooms (500 players) on a single modest VM (2 vCPU, 4GB RAM).
- **TR-P3:** Average latency from input to visual update: <100ms.

#### 6.2 Portability (Electron Future-Proofing)
- **TR-E1:** Avoid direct use of browser-specific APIs (e.g., `window`, `document`) in core game logic. Abstract via an interface.
- **TR-E2:** Keep Three.js initialization and rendering loop in a module that can be hosted in a BrowserWindow (Electron) or browser tab.
- **TR-E3:** Use relative URLs for asset loading; avoid assumptions about hosting domain.

#### 6.3 Code Quality & Maintainability
- **TR-Q1:** Clear separation between: networking layer, game state logic (client-side prediction/interpolation), and rendering.
- **TR-Q2:** Use ES6 modules; avoid global variables where possible.
- **TR-Q3:** Linting (ESLint) and basic unit tests for networking and state interpolation logic.
- **TR-Q4:** README with setup instructions and development guidelines.

### 7. Architecture Overview
```
+-------------------+        WebSocket (JSON)        +------------------+
|   Three.js Client | <============================> |   Game Server    |
|  (Renderer +      |        Bi-directional          |  (Node.js +      |
|   Input Handler)  |                                |   Socket.IO)     |
+-------------------+                                +------------------+
        ^                                                  ^
        |                                                  |
        |                                                  v
        |                                          +------------------+
        |                                          |  Fog of War      |
        |                                          |  Calculation     |
        |                                          |  (Per Player)    |
        |                                          +------------------+
        |
        v
+------------------+
|  Asset Loader    |
|  (Textures,     |
|   Models)        |
+------------------+
```

**Client Modules:**
- `networking.js`: Handles WebSocket connection, message queuing, reconnection.
- `input.js`: Captures DOM events, converts to game intents.
- `state.js`: Client-side representation of game state, handles interpolation and prediction.
- `renderer.js`: Three.js scene setup, animation loop, rendering logic based on `state.js`.
- `main.js`: Entry point, initializes modules and starts render loop.

**Server Modules:**
- `server.js`: Sets up HTTP/Socket.IO server, handles connections.
- `room.js`: Manages a single game room, player list, state updates.
- `physics.js`: Simple movement validation (placeholder for future collision).
- `fogOfWar.js`: Calculates visibility based on player positions and explored areas.

### 8. Dependencies
- **Client:** Three.js (r152+), Socket.IO Client (if using Socket.IO).
- **Server:** Node.js (v18+), Socket.IO, optionally Express for serving static assets.
- **Dev:** ESLint, Jest (for unit tests), webpack/parcel/Vite (for bundling - optional for V1).

### 9. Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Network latency causing jittery movement | High | Implement client-side interpolation and extrapolation; optimize tick rate. |
| Fog of war calculation becoming expensive with many players | Medium | Optimize with spatial hashing or incremental updates; precompute visibility where possible. |
| Three.js version incompatibilities | Low | Pin version; use CDN or locked package.json. |
| Electron portability issues later | Medium | Keep renderer isolated; test in Electron early (even if not V1 focus). |
| Cheating via modified client | Medium (V1 low priority) | Server-authoritative movement validation; future: anti-cheat measures. |

### 10. Success Criteria (V1)
- [ ] Two players can join a room, see each other's avatars move in real-time via WASD/arrow keys.
- [ ] Fog of war correctly hides unexplored areas; explored areas remain visible.
- [ ] Movement feels responsive (<100ms perceived latency) on LAN and simulated WAN (100ms RTT).
- [ ] Client maintains >30 FPS with 10 avatars visible.
- [ ] Server handles 10-player room without dropping ticks under load.
- [ ] Code is structured for easy extraction of renderer for Electron port.
- [ ] PRD and architecture documented; README with setup steps completed.

### 11. Open Questions & Decisions Needed
1. **WebSocket Library:** Use native `ws` + custom protocol, or Socket.IO for features like rooms and reconnection?
   - *Recommendation:* Socket.IO for V1 simplicity; evaluate native ws later for performance.
2. **Player Representation:** Simple colored spheres, or load basic GLTF models?
   - *Recommendation:* Start with spheres for speed; abstract asset loading for easy model swap.
3. **Map Definition:** Hardcoded flat plane, or load from a tilemap/image?
   - *Recommendation:* Flat plane of fixed size (e.g., 1000x1000 units) for V1; add terrain later.
4. **Development Setup:** Bare Node.js/HTML, or use a bundler like Vite?
   - *Recommendation:* Vite for client (hot reload, ES modules); plain Node.js for server.

---
*PRD Version: 0.1*
*Last Updated: $(date)*
*Author: Hermes Agent