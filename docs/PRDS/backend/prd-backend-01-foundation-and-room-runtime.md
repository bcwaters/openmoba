# PRD 1: Backend Foundation and Room Runtime

Status: Draft
Priority: P0
Scope: Backend
Related stack: Node.js, TypeScript, Colyseus, Express

## Purpose

Establish the OpenMOBA backend foundation as a stable, portable multiplayer runtime that can serve either a browser-based client or a future Electron-hosted Three.js client without changing core server behavior.

This PRD defines the baseline service that all later gameplay systems will depend on: process startup, environment configuration, room registration, room lifecycle, player session management, and basic service observability.

## Context

Current project assumptions:

- game genre: MOBA
- game mode: competitive
- camera: top-down
- max players per room: 10
- v1 gameplay focus: one controllable player unit moving through a map with fog of war
- client rendering: fully in Three.js
- client host target: browser first, with possible future Electron app
- backend framework: Colyseus

Because the client may run in a browser or Electron later, the backend must expose a transport and protocol layer that is host-agnostic.

## Problem Statement

The project needs a dependable multiplayer backend skeleton before any gameplay systems can be built. Without a clean foundation, later work on movement, visibility, and match logic will become tightly coupled, difficult to test, and harder to port across client hosts.

## Goals

1. Start a backend service locally and in deployment with minimal configuration.
2. Register at least one canonical Colyseus room for OpenMOBA matches.
3. Allow clients to connect, join, leave, and reconnect safely.
4. Enforce room capacity of 10 players.
5. Provide minimal observability and health checks.
6. Keep the backend independent from browser-specific assumptions.
7. Establish a file/package structure that can scale with later simulation work.

## Non-Goals

This PRD does not include:

- combat systems
- fog-of-war rules
- movement simulation details
- pathfinding
- persistence or accounts
- matchmaking beyond direct room join/create behavior
- production autoscaling

## Users / Stakeholders

- developer building the backend incrementally
- future browser client
- future Electron client
- future automated test runner / CI pipeline

## Functional Requirements

### 1. Service Boot
- The backend must start from a single command in development.
- The backend must expose a compiled production build path.
- The backend must support environment-based port configuration.
- The backend must fail loudly on invalid startup configuration.

### 2. Room Registration
- The backend must register an initial canonical room type named `openmoba`.
- The room must cap active clients at 10.
- The room must be discoverable through Colyseus join or create flows.

### 3. Session Lifecycle
- A client must be able to connect and join the room successfully.
- The backend must handle disconnect and leave events without crashing.
- The backend must leave the room in a valid state when a player disconnects.
- The backend should be structured so reconnect behavior can be added later without major rewrites.

### 4. HTTP Service Surface
- The backend must expose a health endpoint.
- The health endpoint must be suitable for local verification and deployment health checks.
- The backend may later expose debug or admin endpoints, but those are not required in v1 foundation work.

### 5. Project Structure
- The backend must live under `apps/server` in the monorepo.
- The backend must use TypeScript.
- The backend must isolate room definitions from server bootstrap logic.
- The backend must be organized so simulation code, schemas, and state can be added cleanly later.

### 6. Testability
- The backend foundation must be testable in an automated way.
- At minimum, tests must verify:
  - health endpoint responds successfully
  - a Colyseus client can join the registered room

## Non-Functional Requirements

### Portability
- The backend protocol must not assume the client is running in a browser.
- Browser and Electron clients must be able to connect using the same backend room contract.

### Reliability
- Service startup and shutdown must be deterministic.
- Room join flow must work locally without manual setup beyond install and run commands.

### Maintainability
- Bootstrap code should remain small and separate from gameplay logic.
- Initial naming and structure should support adding more rooms and services later.

### Observability
- The backend should log startup success and bound port information.
- The backend should expose enough information to diagnose whether the service is healthy.

## Open Questions

1. Will v1 use direct room joins only, or a lightweight lobby flow?
2. Should reconnect be a Phase 0.5 requirement or wait until simulation state exists?
3. Should backend config include CORS/origin restrictions in the foundation phase?
4. Will there be one room type for all prototypes, or separate room types for test and production modes?

## Success Metrics

- A developer can clone the repo, install dependencies, and start the backend with one command.
- A client can join the `openmoba` room locally without custom manual setup.
- The backend passes automated checks for startup, health, room join, and build.

## Acceptance Criteria

1. `apps/server` exists with isolated bootstrap and room files.
2. A local dev command starts the Colyseus server successfully.
3. A build command compiles the backend successfully.
4. A health endpoint returns a success response.
5. A real Colyseus client test can join the `openmoba` room.
6. Room capacity is limited to 10 clients.
7. The service design remains compatible with both browser and Electron-hosted clients.

## Current Status Snapshot

This PRD is partially implemented already in the repository:

- workspace initialized
- backend app scaffold created
- `openmoba` room registered
- room capacity set to 10
- health endpoint implemented
- automated join test implemented
- TypeScript build passing

Future work should treat this PRD as the baseline contract for all subsequent backend systems.
