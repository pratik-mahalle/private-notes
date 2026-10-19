# Scripts: download-neurt.sh does not check the tts and ocr archives that engines/neurt/CMakeLists.txt requires

**Type:** pull request
**Versions checked:** `RunanywhereAI/runanywhere-sdks` main at 259521e299bb28292c8d150b18fc17964f1dcd14.

## What happened
The comment above the check in `scripts/build/download-neurt.sh:138-139` says every archive `engines/neurt/CMakeLists.txt` links must be present. The loop at lines 140-143 checks 8 archives; CMake (lines 65-78) requires 10, so `libneurt_rac_tts_ops.a` and `libneurt_rac_ocr_ops.a` are not checked. A partial release missing either would pass the download script and fail later at CMake configure.

## Proposed diff
Not run against a real release; the change only extends the existing existence check.
```diff
--- a/scripts/build/download-neurt.sh
+++ b/scripts/build/download-neurt.sh
@@ -140,7 +140,8 @@
     for lib in libneurt_core.a libneurt_rac_llm_ops.a libneurt_rac_stt_ops.a \
                libneurt_rac_diffusion.a libneurt_rac_embedding_ops.a \
                libneurt_rac_rerank_ops.a libneurt_rac_vlm_ops.a \
-               libneurt_rac_image_embedding_ops.a; do
+               libneurt_rac_image_embedding_ops.a libneurt_rac_tts_ops.a \
+               libneurt_rac_ocr_ops.a; do
         [[ -f "${dest}/lib/${lib}" ]] || { echo "[ERROR] ${slice}: missing ${lib}" >&2; missing=1; }
     done
     [[ -f "${dest}/include/rac_diffusion_coreml.h" ]] \
```

## Suggested fix
Add the two archives to the loop.
