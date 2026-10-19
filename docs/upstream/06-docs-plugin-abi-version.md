# Docs: AGENTS.md says RAC_PLUGIN_API_VERSION = 9u, the header says 14u

**Type:** pull request (docs only)
**Versions checked:** `RunanywhereAI/runanywhere-sdks` main at 259521e299bb28292c8d150b18fc17964f1dcd14.

## What happened
`AGENTS.md:152` says `RAC_PLUGIN_API_VERSION = 9u`. `core/include/rac/plugin/rac_plugin_entry.h:119` defines `14u`. `core/AGENTS.md` (heading at line 111 and the sentence at line 117) also describes 9 as current; I left that one alone since it is a history section and you may prefer to rewrite it. `docs/ARCHITECTURE.md` no longer exists on main.

## Proposed diff
```diff
--- a/AGENTS.md
+++ b/AGENTS.md
@@ -149,7 +149,7 @@
 - **Two-phase init**: every SDK does Phase 1 (sync: register adapter, load native libs,
   configure logging) then Phase 2 (async: authenticate, register device, fetch model
   assignments, discover downloaded models).
-- **Plugin ABI**: `RAC_PLUGIN_API_VERSION = 9u`; a version mismatch is an immediate
+- **Plugin ABI**: `RAC_PLUGIN_API_VERSION = 14u`; a version mismatch is an immediate
   rejection. Each vtable has 10 active primitive slots and 7 reserved. NULL slot = not
   supported. `rerank_ops` (wire value 11) was promoted from `reserved_slot_2` in ABI v8;
   wire value 6, retired in ABI v4, stays permanently retired — never reuse it. See
```

## Suggested fix
Update the number in AGENTS.md (or point to the header as the single source of truth).
