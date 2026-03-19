# PRD 1: Backend Foundation and Room Runtime

## Decomposed Iterative Tasks

- [ ] Service Boot
   - [x] Create startup script for development
   - [x] Create compiled production build path
   - [x] Support environment-based port configuration
   - [x] Fail loudly on invalid startup configuration

- [ ] Room Registration
   - [x] Register canonical Colyseus room type named `openmoba`
   - [x] Cap active clients at 10 players
   - [x] Make room discoverable through Colyseus join/create flows

- [ ] Session Lifecycle
   - [x] Allow clients to connect and join room successfully
   - [x] Handle disconnect and leave events without crashing
   - [x] Leave room in valid state when player disconnects
   - [x] Structure for reconnect behavior to be added later

- [ ] HTTP Service Surface
   - [x] Expose health endpoint
   - [x] Make health endpoint suitable for local verification and deployment
   - [x] Structure for future debug/admin endpoints

- [ ] Project Structure
   - [x] Isolate backend under `apps/server` in monorepo
   - [x] Use TypeScript
   - [x] Isolate room definitions from server bootstrap logic
   - [x] Organize for clean addition of simulation code, schemas, and state

- [ ] Testability
   - [x] Make backend foundation testable in automated way
   - [x] Verify health endpoint responds successfully
   - [x] Verify Colyseus client can join registered room

- [ ] Portability
   - [x] Ensure backend protocol doesn't assume browser client
   - [x] Ensure Browser and Electron clients can connect with same contract

- [ ] Reliability
   - [x] Ensure deterministic service startup and shutdown
   - [x] Ensure room join flow works locally without manual setup

- [ ] Maintainability
   - [x] Keep bootstrap code small and separate from gameplay logic
   - [x] Ensure initial naming/structure supports adding more rooms/services

- [ ] Observability
   - [ ] Log startup success and bound port information
   - [x] Expose enough information to diagnose service health
