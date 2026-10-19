# Docs: Swift `initialize(apiKey: nil)` is described as keyless, but the default environment is .production

**Type:** pull request (docs only)
**Versions checked:** `RunanywhereAI/runanywhere-sdks` main at 259521e299bb28292c8d150b18fc17964f1dcd14.

## What happened
The doc comment at `bindings/swift/Sources/RunAnywhere/Public/RunAnywhere.swift:224` says "`apiKey: nil` runs in keyless local mode", and the root README quick start calls `try RunAnywhere.initialize()`. The default parameter is `environment: .production` (line 229), and `rac_validate_api_key` (`core/src/infrastructure/network/environment.cpp:202`) returns `RAC_VALIDATION_API_KEY_REQUIRED` for an empty key in production. Keyless mode is the `.development` path (`SDKInitParams(forDevelopmentWithAPIKey:)`). I have not built it on a Mac; this is from reading the code, so please correct me if the default is handled elsewhere.

## Proposed diff
```diff
--- a/bindings/swift/Sources/RunAnywhere/Public/RunAnywhere.swift
+++ b/bindings/swift/Sources/RunAnywhere/Public/RunAnywhere.swift
@@ -221,7 +221,8 @@
     /// call returns as soon as local inference is usable.
     ///
     /// - Parameters:
-    ///   - apiKey: `nil` runs in keyless local mode.
+    ///   - apiKey: `nil` runs in keyless local mode when `environment` is
+    ///     `.development`; the default `.production` requires an API key.
     ///   - baseUrl: `nil` uses the default control plane for the environment.
     /// - Throws: `SDKException` when the parameters fail validation or the
     ///   native core cannot start.
--- a/README.md
+++ b/README.md
@@ -128,7 +128,7 @@
 
 // 1. Initialize
 LlamaCPP.register()
-try RunAnywhere.initialize()
+try RunAnywhere.initialize(environment: .development)
 
 // 2. Load a model
 var load = RAModelLoadRequest()
```

## Suggested fix
Document that keyless mode needs `environment: .development` (or make it the default when no key is given).
