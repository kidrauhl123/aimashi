# Single Group Orchestrator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse group chat reply selection into one cloud-side orchestrator and make desktop code only execute explicit desktop-local invocations.

**Architecture:** Cloud conversation messages remain the write authority. A cloud `GroupOrchestrator` sees the complete roster, chooses Fellow targets once, then dispatches each chosen Fellow through either the cloud-hermes adapter or a persisted desktop-local invocation event.

**Tech Stack:** Node.js CommonJS modules, `node:test`, existing cloud SQLite stores, existing Hermes run client, existing desktop local fellow responder.

---

### Task 1: Prove Mixed Runtime Group Routing

**Files:**
- Modify: `tests/cloud-agent-dispatcher.test.js`

- [x] **Step 1: Write failing tests**

Add tests that create a group with Mia as cloud-hermes and 空铃 as desktop-local. A direct "空铃？" message must emit exactly one `conversation.fellow_invocation_requested` event and must not call Mia. A generic message whose conductor decision chooses 空铃 must use a synthetic `group-orchestrator` conductor and then emit the desktop-local invocation.

- [x] **Step 2: Run the targeted test**

Run: `node --test tests/cloud-agent-dispatcher.test.js`

Expected before implementation: the new tests fail because desktop-local group targets are currently filtered out by the cloud dispatcher.

### Task 2: Add the Group Orchestrator Module

**Files:**
- Create: `src/cloud-agent/group-orchestrator.js`
- Modify: `src/cloud-agent/dispatcher.js`

- [x] **Step 1: Implement target resolution**

The module resolves each Fellow member to `{ member, fellowId, ownerId, runtimeKind, binding }`, where `runtimeKind` comes from explicit member metadata first, then enabled cloud-hermes binding, then enabled desktop-local binding.

- [x] **Step 2: Implement one decision path**

The module applies the existing shared policy in this order: human-directed silence, availability silence, acknowledgement silence, explicit mention/direct name/search target, conductor decision. It always evaluates against the complete Fellow roster.

- [x] **Step 3: Use a synthetic conductor**

Generic group dispatch uses a synthetic Fellow identity `{ id: "group-orchestrator", name: "Group Orchestrator" }`, not Mia or any other group member.

### Task 3: Make Runtime Execution an Adapter

**Files:**
- Modify: `src/cloud-agent/dispatcher.js`
- Modify: `scripts/serve-cloud.js`
- Modify: `src/main/social/fellow-runtime-dispatcher.js`
- Modify: `src/main.js`

- [x] **Step 1: Cloud adapter**

For `cloud-hermes` targets, run the existing Hermes invocation path under the target owner id.

- [x] **Step 2: Desktop adapter**

For `desktop-local` targets, broadcast one persisted `conversation.fellow_invocation_requested` event to the Fellow owner with the triggering message, recent messages, members, and runtime config when available.

- [x] **Step 3: Remove duplicate dispatch**

Delete the special mention loop from `scripts/serve-cloud.js`; all group AI dispatch goes through `cloudAgentDispatcher.handleUserMessage`.

- [x] **Step 4: Stop desktop message fan-out**

Remove `mainGroupConductor` from the main runtime dispatcher. Desktop listens to explicit invocation events and Fellow private room events only.

### Task 4: Delete Host-Centric Local Coordination

**Files:**
- Delete: `src/main/social/group-conductor.js`
- Delete or rewrite: `tests/main-group-conductor.test.js`
- Modify: `src/shared/group-fellow-routing.js`
- Modify: static routing tests

- [x] **Step 1: Remove unused host exports**

Delete `hostFellowIdFor` from shared group routing if no callers remain.

- [x] **Step 2: Update static tests**

Static tests must assert that main no longer instantiates a group conductor and that desktop does not respond to generic group `conversation.message_appended` events.

### Task 5: Verify

**Files:**
- Test-only

- [x] **Step 1: Targeted tests**

Run: `node --test tests/cloud-agent-dispatcher.test.js tests/cloud-agent-server-flow.test.js tests/cloud-social-api.test.js tests/main-fellow-runtime-dispatcher.test.js tests/main-cloud-conversation-ai-routing.test.js tests/main-cloud-fellow-routing.test.js`

- [x] **Step 2: Structure check**

Run: `npm run check`

- [x] **Step 3: Runtime sanity**

Restart the foreground Electron app so desktop-local invocation handling uses the new code.

### Task 6: Fix Self Echo Reconciliation

**Files:**
- Modify: `src/renderer/social/social.js`
- Modify: `tests/renderer-social.test.js`

- [x] **Step 1: Reproduce duplicate own bubble**

Add a renderer regression where the optimistic local user message is followed by a `conversation.message_appended` self echo without `turn_id` before the POST response resolves.

- [x] **Step 2: Reconcile the fallback case**

When the echo is from the current user, has no `turn_id`, and matches exactly one pending local message by body and attachments, replace the pending message instead of appending a duplicate.
