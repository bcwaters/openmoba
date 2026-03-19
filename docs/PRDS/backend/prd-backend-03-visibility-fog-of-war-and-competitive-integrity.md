# PRD 3: Visibility, Fog of War, and Competitive Integrity

Status: Approved
Priority: P0
Scope: Backend
Depends on: PRD 1 and PRD 2

## Purpose

Define the backend systems that make fog of war real in OpenMOBA. This PRD exists to ensure visibility is enforced as a server-side information boundary, not merely rendered as a client-side visual effect.

## Problem Statement

In a competitive game, fog of war cannot be trusted to the client alone. If the backend sends full enemy state to every client and the client simply hides it visually, hidden information can be extracted and abused.

The backend must therefore decide what each player is allowed to know and must avoid exposing unauthorized enemy state whenever possible.

## Goals

1. Make fog of war a server-enforced rule.
2. Compute what each player is allowed to see.
3. Limit enemy information shared with clients outside visibility.
4. Support the first playable version of exploration and threat awareness.
5. Preserve room performance at up to 10 players.
6. Establish trust boundaries that can scale into a more complete MOBA later.

## Non-Goals

This PRD does not include:

- advanced line-of-sight from terrain occlusion
- brush, stealth, invisibility, or detection counters
- replay systems
- anti-cheat software outside the gameplay protocol boundary
- minimap rendering
- spectator mode

## Current Design Assumptions

- each player controls one unit
- the unit has a vision radius
- the game is competitive
- the first map should stay simple to reduce visibility edge cases
- hidden enemy units should ideally be omitted from unauthorized client state rather than merely flagged hidden
- explored-memory is not required for the first implementation unless chosen later

## Functional Requirements

### 1. Vision Model
- The backend must define a vision rule for each player-controlled unit.
- The initial model may use a simple circular reveal radius.
- The initial model does not need terrain or wall-based occlusion.

### 2. Visibility Computation
- On a regular cadence, the backend must determine which entities or map regions are visible to each player.
- The backend must support computing per-player visible sets.
- The backend must be structured so more advanced visibility rules can be added later.

### 3. Information Filtering
- Hidden enemy units should not be fully exposed to unauthorized clients.
- The backend should prefer omission over redaction for hidden enemy state in v1.
- Friendly or self-owned entities may have broader visibility as needed.
- The filtering model must be explicit and testable.

### 4. Client Contract
The backend must provide enough information for the client to render:

- the player's current visible area
- currently visible allied and enemy entities
- local player identity and own entity state
- optional debug visibility data for development builds only

### 5. State Changes
- Units entering visibility must become available to the client promptly.
- Units leaving visibility must stop being available as authoritative visible entities.
- Disconnects and deaths later must integrate with the same visibility rules.

### 6. Team Compatibility
- The backend should support a future team-based model such as 5v5.
- Team and ally visibility rules should not require architectural rewrites.
- If early prototypes use free-for-all, the visibility model should still be compatible with later teams.

## Non-Functional Requirements

### Competitive Integrity
- The backend must treat hidden information as restricted information.
- The protocol should minimize information leakage by default.

### Performance
- Visibility computation must remain affordable for 10 players.
- The initial algorithm should favor clarity and predictable behavior.

### Extensibility
- The visibility system should support later additions such as:
  - explored-memory fog
  - terrain occlusion
  - ward or vision-providing entities
  - team-wide shared vision
  - stealth mechanics

## Recommended V1 Approach

Recommended first implementation:

- simple map
- circular vision radius around each player unit
- current visibility only
- no terrain occlusion
- hidden enemy units omitted from unauthorized client state
- optional debug tools to inspect server-calculated visibility during development

This is the smallest approach that still preserves the core competitive requirement.

## Open Questions

1. Should v1 include explored-memory fog, or only current visibility?
2. Will vision be individual per player, team-shared, or both?
3. Should debug visibility payloads exist only in local dev mode?
4. How will visibility filtering be represented in Colyseus state without leaking hidden data?
5. Should the backend compute visible tiles, visible entities, or both?

## Success Metrics

- A client can only observe enemy entities that should be visible according to server rules.
- Moving into range reveals units reliably.
- Moving out of range hides units reliably.
- The visibility system can be explained and tested without ambiguity.

## Acceptance Criteria

1. The backend defines a per-player vision model.
2. The backend computes visible entities or regions on a regular cadence.
3. Hidden enemy units are not fully exposed to unauthorized clients.
4. The system works with up to 10 players in a room.
5. The visibility model remains compatible with a future 5v5 team design.
6. The client receives enough information to render fog of war without becoming the source of truth.

## Decomposition Candidates

This PRD can later be split into smaller PRDs such as:

- vision radius model
- per-player visibility filtering
- team-shared vision
- explored-memory fog
- visibility debugging tools
- terrain occlusion and line-of-sight
- hidden-information testing strategy
