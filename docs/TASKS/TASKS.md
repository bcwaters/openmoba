# OpenMOBA Development Tasks

## Phase 0: Setup
- [x] Initialize project structure (client/server directories)
- [ ] Set up Git repository with initial commit
- [x] Create .gitignore (already done)
- [x] Set up development environment (Node.js, npm/yarn)
- [x] Initialize client package.json (Three.js, Socket.IO client)
- [x] Initialize server package.json (Node.js, Socket.IO server, Express optional)
- [ ] Configure ESLint for client and server
- [x] Set up basic README with setup instructions

## Phase 1: Core Infrastructure
### 1.1 Server Setup
- [x] Create basic Socket.IO server (server.js) [using Colyseus framework]
- [x] Implement room management (create, join, leave rooms)
- [x] Handle player connections/disconnections
- [ ] Implement heartbeat/ping mechanism
- [x] Set up basic game state structure per room

### 1.2 Client Setup
- [x] Create basic HTML client shell
- [x] Set up Three.js scene (camera, renderer, lighting)
- [x] Implement Socket.IO client connection
- [x] Create basic input handler for WASD/arrow keys
- [x] Implement movement intent messaging to server

### 1.3 Communication
- [x] Define message protocol (move_intent, game_state)
- [x] Implement client-side message queuing
- [x] Implement server-side broadcast to room
- [x] Add basic error handling and reconnection logic

## Phase 2: V1 Mechanics - Movement
### 2.1 Server-Side Movement
- [x] Implement player position tracking
- [x] Validate movement intents (basic boundary checks)
- [x] Update player positions on server tick
- [x] Implement server tick rate (20Hz)

### 2.2 Client-Side Movement
- [ ] Implement client-side interpolation of player positions
- [ ] Add basic prediction for local player movement
- [ ] Smooth rendering of other players' movement
- [ ] Handle latency compensation (basic)

## Phase 3: V1 Mechanics - Fog of War
### 3.1 Fog of War System
- [x] Define fog of war data structure (explored areas per player/team)
- [x] Implement server-side fog of war calculation
- [x] Determine what areas are visible to each player
- [x] Broadcast fog of war state with game state

### 3.2 Client-Side Fog of War Rendering
- [ ] Implement fog of war overlay in Three.js
- [ ] Create mask or shader to hide unexplored areas
- [ ] Update fog of war based on server data
- [ ] Optimize for performance (minimize updates)

## Phase 4: Integration & Polish
### 4.1 End-to-End Testing
- [ ] Test two-player movement synchronization
- [ ] Verify fog of war visibility rules
- [ ] Test connection loss and reconnection
- [x] Validate 10-player room capacity

### 4.2 Performance Optimization
- [ ] Profile client rendering (target 60 FPS)
- [ ] Optimize Three.js scene (geometries, materials)
- [ ] Reduce network message size/frequency
- [ ] Implement client-side frustum culling if needed

### 4.3 Code Quality
- [ ] Write unit tests for networking and state interpolation
- [ ] Run ESLint and fix issues
- [ ] Document API and architecture in README
- [ ] Prepare for Electron portability review

## Phase 5: Deployment Preparation
- [ ] Create development startup scripts
- [ ] Document build process (if using bundler)
- [ ] Create basic production server configuration
- [ ] Write deployment guide for basic hosting

## Optional Enhancements (Post-V1)
- [ ] Add basic terrain/obstacles
- [ ] Implement player avatars with models
- [ ] Add chat system
- [ ] Implement advanced abilities/combat
- [ ] Add persistent player stats
- [ ] Create Electron wrapper
