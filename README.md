<div align="center">

# ESFS: Synchronous byte-aware File and Folder I/O for Adobe ExtendScript (ES3)

## ExtendScript File System = E.S.FS

### Explicit text, BINARY, directory, copy, rename, and best-effort replacement semantics over Adobe File/Folder

[![Live smoke](https://img.shields.io/badge/live%20smoke-20%2F20-success)](#validation)
[![Tests](https://img.shields.io/badge/tests-14%2F14-purple)](#validation)
[![Engine parity](https://img.shields.io/badge/engine%20parity-Illustrator%2030.6%20%2F%20ES%204.5.6-green)](#validation)
[![Adobe: Creative Suite](https://img.shields.io/badge/Adobe%20-Creative%20Suite-red?logo=adobe&logoColor=white)](https://extendscript.docsforadobe.dev/)
[![Engine](https://img.shields.io/badge/ExtendScript-ES3-green)](#compatibility)
[![Runtime size](https://img.shields.io/badge/runtime-17.7%20KiB-orange)](#installation)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL%203.0--or--later-blue)](https://www.gnu.org/licenses/gpl-3.0.html)

</div>

---

## Part Of The Same Toolkit

> Production-grade infrastructure for Adobe ExtendScript.

<table>
<tr>
<td width="50%" valign="top">

### Runtime Primitives

**[ESON](https://github.com/thelabcorner/eson)**  
Strict RFC 8259 JSON for ExtendScript.

**[ESB64](https://github.com/thelabcorner/es-b64)**  
Base64 and UTF-8 utilities.

**[ESARR](https://github.com/thelabcorner/es-arr)**  
ES5+ Array compatibility methods.

**[ESSTR](https://github.com/thelabcorner/es-str)**  
String whitespace and trim methods.

**[ESCHARS](https://github.com/thelabcorner/es-chars)**  
Native bulk byte operations.

**[ESHTTP](https://github.com/thelabcorner/es-http)**  
HTTP transport for ExtendScript automation.

**[ESTIMER](https://github.com/thelabcorner/es-timer)**  
Microsecond timing for ExtendScript automation.

**[ESRAND](https://github.com/thelabcorner/es-rand)**  
Deterministic random streams and sampling for ExtendScript.

**[ESUUID](https://github.com/thelabcorner/es-uuid)**  
RFC 9562 UUID generation, parsing, and conversion for ExtendScript.

**[ESENV](https://github.com/thelabcorner/es-env)**  
Environment and capability detection for ExtendScript.

**[ESPATH](https://github.com/thelabcorner/es-path)**  
Deterministic Windows/POSIX path and RFC 8089 file-URI transformations.

**[ESFS](https://github.com/thelabcorner/es-fs)**  
Synchronous ExtendScript File/Folder I/O with explicit text, BINARY, and replacement semantics.

**[ESHASH](https://github.com/thelabcorner/es-hash)**  
CRC-32/ISO-HDLC and SHA-256 for byte strings and UTF-8 text.

**[ESLOG](https://github.com/thelabcorner/es-log)**  
Structured logging with bounded text and JSONL sinks.

</td>
<td width="50%" valign="top">

### Build & Integration Tools

**[ESPACK](https://github.com/thelabcorner/espack)**  
Self-extracting ExternalObject bundles.

**[ESMIN](https://github.com/thelabcorner/es-min)**  
Minification for shipped JSX bundles.

**[ESABI](https://github.com/thelabcorner/esabi)**  
Modern ExternalObject ABI declarations for native integrations.

**[VectorIPC](https://github.com/thelabcorner/vector-ipc)**  
Bounded local IPC for scripting hosts and native plug-ins.

**[ESTC](https://github.com/thelabcorner/estc)**  
TypeScript-to-ExtendScript build, compatibility, and live-parse tooling.

**[ESDB](https://github.com/thelabcorner/esdb)**  
Native state and durable storage for Adobe tooling.

**[COMTool](https://github.com/thelabcorner/COMTool)**  
Guarded COM, ExtendScript, plug-in, and debugger automation for Adobe desktop apps.

**ESsemble** <sub>coming soon</sub>  
Typed framework, resolver, and composition layer for the ExtendScript toolkit.

**ESOBF** <sub>coming soon</sub>  
Obfuscation for hardened JSX distribution.

</td>
</tr>
</table>

Also from the same team: **[ArcFit.dev](https://arcfit.dev)**, deterministic arc warp for Illustrator.

---

## Table of Contents

- [Why ESFS?](#why-esfs)
- [Features](#features)
- [Get the Release](#get-the-release)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
- [Validation](#validation)
- [Performance](#performance)
- [Security Model](#security-model)
- [Compatibility](#compatibility)
- [Engine quirks that shaped the design](#engine-quirks-that-shaped-the-design)
- [Development](#development)
- [Repository layout](#repository-layout)
- [Credits](#credits)
- [License](#license)

---

## Why ESFS?

Adobe ExtendScript exposes synchronous `File` and `Folder` objects, but production code still has to make encoding, BINARY byte strings, directory behavior, host error propagation, alias behavior, and replacement limits explicit. ESFS defines those contracts while keeping ordinary file operations to one File object and one open/read-or-write/close sequence.

Caller path strings pass unchanged to `new File(path)` / `new Folder(path)`. ESFS does not normalize, decode, join, or canonicalize caller paths. Internal sibling staging is isolated behind `PathAdapter`; no ESPATH API is assumed.

---

## Features

- Explicit UTF-8/default text operations plus caller-selected text encodings.
- Dedicated BINARY operations for byte strings whose UTF-16 code units are exactly 0x00–0xFF.
- Whole-payload reads/writes with no per-byte JS array conversion.
- Separate file/folder existence and stat APIs; no ambiguous generic `exists(path)`.
- One-call `File.copy()` delegation for copy semantics.
- Single-level `createDirectory()` and explicit parent-walking `ensureDirectory()`.
- Immediate file removal and intentionally non-recursive empty-directory removal.
- Leaf-only rename validation.
- Best-effort staged replacement with explicit `atomicity` and `durability` result fields plus rollback attempts.
- Structured `ESFSError` failures with operation/path/detail and rollback/cleanup context.
- Portable Node adapter tests plus separately verified live Adobe behavior.
- Adobe File/Folder remains the default correctness and fallback surface. The preferred native distribution is a self-extracting ESPACK bundle that materializes and adopts an ESABI-backed Windows DLL while leaving the default Adobe methods untouched; binary contents never cross the ExternalObject boundary.

---

## Get the Release

<div align="center">

**All production bundles ship as GitHub release assets — this repo holds
sources. Grab the runnable builds from the
[Releases page](https://github.com/thelabcorner/es-fs/releases).**

[![Latest release](https://img.shields.io/github/v/release/thelabcorner/es-fs?display_name=tag)](https://github.com/thelabcorner/es-fs/releases/latest)
[![Release date](https://img.shields.io/github/release-date/thelabcorner/es-fs)](https://github.com/thelabcorner/es-fs/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/thelabcorner/es-fs/total)](https://github.com/thelabcorner/es-fs/releases)

</div>

**How it works, in three steps:**

1. Open the [Releases page](https://github.com/thelabcorner/es-fs/releases).
2. Pick the **latest stable** tag.
3. Download the asset that matches your use case:

| You are... | Take this release | And this asset |
|---|---|---|
| Using the Adobe File/Folder correctness surface | Latest stable | `ESFS.jsx` |
| Wanting a self-contained Windows x64 accelerated bundle | Latest stable | `ESFS.accel.jsx` or `ESFS.accel.min.jsx` |
| Composing ESFS into an existing ESPACK runtime | Latest stable | `ESFS.facade.jsx` + `ESFS.manifest.json` |
| Deploying the direct native compatibility lane | Latest stable | `ESFSNative.dll` |
| Consuming the portable core from Node tooling | Latest stable | `esfs-core.esm.mjs` |

---

## Installation

```bash
npm install
npm run build
```

The build emits:

- `dist/ESFS.jsx` — ExtendScript facade installed at `$.global.ESFS`.
- `dist/ESFS.accel.jsx` / `ESFS.accel.min.jsx` — self-contained ESPACK manifest-v2 compositions with dependency-first `ESB64@1.3.0 -> ESFS@0.2.0` closure, one persistent loader/control plane, `ESFSNative_v1.dll`, and shared `ESB64Native_v2.dll`.
- `dist/ESFS.facade.jsx` + `ESFS.manifest.json` — loader-free facade and byte-provenanced manifest-v2 composition contract for a shared ESPACK runtime.
- `dist/esfs-core.esm.mjs` — portable core for Node/integration use.
- `dist/types/` — TypeScript declarations.

The current native-gate build of `dist/ESFS.jsx` is 18,936 bytes. The preserved `evidence/final-live-evidence.json` belongs to the earlier 14,651-byte reference artifact whose SHA-256 is `a9d44931e627ed02fdd31fe9ade97bc6a822491a6fe95226e796a0478ae183d1`; that historical evidence remains intentionally immutable.

For the self-contained native distribution, run `npm run native:build && npm run build:accel:strict`, then load `dist/ESFS.accel.jsx`. ESPACK extracts/caches the versioned native payload and ESFS adopts that shared handle. Loading the accelerator does **not** replace `ESFS.copyFile`, `fileExists`, or the other Adobe-backed default methods; native filesystem semantics stay under `ESFS['native']`.

---

## Quick Start

```jsx
ESFS.writeText(
  new File(Folder.userData.fullName + "/settings.txt"),
  "mode=fast\n"
);

var settings = ESFS.readText(
  new File(Folder.userData.fullName + "/settings.txt")
);

// Binary values are strings whose UTF-16 code units are bytes 0x00–0xFF.
var raw = ESFS.readBinary(
  new File(Folder.temp.fullName + "/payload.bin")
);
ESFS.writeBinary(
  new File(Folder.temp.fullName + "/copy.bin"),
  raw
);

var createdFolders = ESFS.ensureDirectory(
  new Folder(Folder.temp.fullName + "/app/cache/v1")
);
var stat = ESFS.statFile(
  new File(Folder.temp.fullName + "/payload.bin")
);
```

Files and folders are separate inputs; ESFS does not guess which one a path denotes.

---

## API

| Operation | Contract |
|---|---|
| `readText(path, {encoding?})` | One `File.open("r")`, one `read()`, and one `close()`. Defaults to UTF-8. Returns the File host's decoded string without ESFS newline rewriting. Adobe's BOM detection remains with File. |
| `writeText(path, text, {encoding?, lineFeed?})` | One `File.open("w")`, one whole-string `write()`, and one `close()`. `open("w")` truncates an existing target. Defaults to UTF-8 and Unix line feeds. ESFS does not add a BOM. |
| `appendText(...)` | One open in append mode, one write, one close. Separate writers are not serialized. |
| `readBinary(path)` / `writeBinary(path, bytes)` / `appendBinary(...)` | File `BINARY` mode, one whole string and no per-byte arrays. If `File.open()` auto-detects a BOM and changes the selected encoding, the reader restores BINARY and seeks back to byte zero. Each write code unit must be in 0x00–0xFF; higher values are rejected. |
| `writeTextReplace(...)` / `writeBinaryReplace(...)` | Write and close a same-folder stage, rename the old target to a backup, then publish the stage. On ordinary failures ESFS attempts to restore the old target. Result states `atomicity: "best-effort"` and `durability: "close-confirmed-only"`. Alias/shortcut targets are rejected. |
| `fileExists` / `folderExists` | One object and one `.exists` query. |
| `statFile` / `statFolder` | Rich metadata only when requested. Missing entries return `exists: false`; file length is read only after existence check and while closed. |
| `copyFile(source, destination)` | Delegates to one `File.copy()` call; no ESFS read/write buffer. |
| `ESFS['native'].load(path?)` / `.status()` / `.unload()` | Direct-DLL compatibility/development lane. The ESPACK artifact adopts its already-loaded handle automatically; `.unload()` detaches from borrowed ESPACK handles without unloading ESPACK's process-wide cache. |
| `ESFS['native'].fileExists(file)` / `.fileSize(file)` | OS-side file-only query using `File.fsName`; returns native filesystem observations and reports Win32 errors distinctly. Native paths must be absolute paths accepted by Windows APIs. |
| `ESFS['native'].copyFile(source, destination)` | OS `CopyFileW` copy with overwrite enabled. Operates on `File.fsName` strings, follows Windows filesystem/reparse-point behavior, and does not claim Adobe alias parity. It throws with the Win32 error code; it does not silently retry through `File.copy()`. |
| `createDirectory(path)` | One `Folder.create()` call for that level; fails if an ancestor is missing. |
| `ensureDirectory(path)` | Walks only missing parents, creates from the first existing ancestor downward, returns number created; 0 when already present. |
| `listDirectory(path, mask?)` | Returns `Folder.getFiles()`'s array directly; `null` means missing, empty array means existing and empty. |
| `removeFile` / `removeEmptyDirectory` | Immediate deletion; folder removal is non-recursive and fails for non-empty folders. |
| `renameFile(path, newLeafName)` | Uses `File.rename` with a leaf name only; path separators are rejected. |

Every false File/Folder method result and thrown host error becomes an `ESFSError` carrying `operation`, `path`, `detail`, and where relevant rollback/cleanup details.

Reads do not perform an `.exists` preflight. Writes rely on the single `open("w")` that creates or truncates the target. Text methods reject BINARY mode so code units cannot be silently truncated; use the dedicated binary methods. Explicit custom text encodings are checked with `File.isEncodingAvailable` and the most recently checked custom encoding is cached by the facade.

### Path adapter boundary

`createESFS()` accepts a `PathAdapter` with only `file`, `folder`, `siblingFile`, `renameSibling`, and `encodingAvailable`. The Adobe adapter uses File/Folder constructors and their documented path/name properties. Caller-supplied strings are never rewritten. Any future ESPATH integration belongs behind this interface.

---

## Validation

| Check | Command | Result |
|---|---|---|
| TypeScript | `npm run typecheck` | pass |
| Build | `npm run build` | pass; 18,936-byte native-gate `dist/ESFS.jsx` |
| Portable ES3 | `npm run estc:static` | emitted facade + benchmark harness pass |
| Portable core | `npm test` | 14/14 tests pass |
| Live parser | `npm run verify:engine` | facade + benchmark harness pass on Illustrator 30.6.0 / ExtendScript 4.5.6 |
| Bound public-API smoke | recorded in `evidence/final-live-evidence.json` | 20/20 assertions pass with clean filesystem cleanup |
| Native backend smoke | `npm run native:live:probe` | 9/9 assertions pass, including actual ABI revision 1 and byte-exact NUL copy |
| Packaged native fallback | `npm run native:release:live` | pass; staged package layout resolves and loads `native/release/ESFSNative.dll` without a manifest |
| ESPACK byte/provenance contract | `npm run accel:contract` | pass; payload + ESB64Native bytes match build inputs, the bundle contains the current sibling ESB64 runtime byte-for-byte, and the npm whitelist exposes only the stable raw DLL |
| Accelerator static + live parse | `npm run estc:accel:live` | 3/3 artifacts pass ES3 static checks and live compile-only parsing |
| Full accelerator behavior | `npm run accel:live` | 11/11 checks pass: adoption, binary-copy parity, default Adobe semantics, ownership, detach/re-adopt |
| Minified accelerator behavior | `npm run accel:live:min` | same 11/11 live checks pass on the conservative minified artifact |

Historical reference evidence is captured in `evidence/final-live-evidence.json` against Illustrator 30.6.0 / ExtendScript 4.5.6. That earlier 14,651-byte artifact passed the 20/20 public-API smoke and File I/O benchmark. The new native-enabled worktree is validated separately so the original evidence is not rewritten to imply it covered code that did not yet exist.

The raw native lane and ESPACK lane have separate gates. `npm run native:build` validates the immutable `deps/esabi/ESABI_PIN`, emits a content-addressed x64 DLL, writes `dist/native/ESFSNative.current`, and refreshes the stable `dist/native/release/ESFSNative.dll` that also feeds the ESPACK payload. `npm run build:accel:strict` composes against the current sibling ESB64 runtime + ESB64Native v2, emits the manifest/facade/full/minified artifacts, and fails rather than silently skipping missing accelerator inputs. The live accelerator probes additionally prove borrowed-handle ownership: detaching ESFS does not invalidate ESPACK's cached library, and re-adoption sees the same handle.

The two older `evidence/run-*.json` files are preserved control-plane failures from before a runnable local COMTool path was available; they never dispatched the probe.

---

## Performance

`tests/benchmark-file-io.jsx` compares ESFS's whole-payload `writeBinary()` path (one underlying `File.write`) with direct 16 KiB substring/write chunks at 1 KiB, 64 KiB, and 1 MiB.

It discards two warmups, records seven samples, uses ESTIMER when already loaded or a primed single-delta `$.hiresTimer` lane otherwise, validates file length outside the timed window, and verifies the exact payload outside timing. Both lanes perform one equivalent BINARY code-unit validation scan; payload construction is outside the timed window.

For each timed write, the harness reports one File object, one BINARY code-unit validation scan, two property assignments (`encoding`, `lineFeed`), one open, one close, zero existence probes, and either one whole write or `ceil(bytes / 16384)` chunk writes.

Live Illustrator 30.6.0 / ExtendScript 4.5.6 medians from `evidence/final-live-evidence.json`:

| Payload | ESFS whole write | 16 KiB chunked | Host writes | Whole-write latency advantage |
|---:|---:|---:|---:|---:|
| 1 KiB | 243 µs | 239 µs | 1 vs 1 | -1.7% (effectively tied) |
| 64 KiB | 729 µs | 813 µs | 1 vs 4 | 10.3% |
| 1 MiB | 8,376 µs | 9,681 µs | 1 vs 64 | 13.5% |

The measured gain grows with avoided host write calls: at 1 KiB both lanes issue one write and are effectively tied; by 1 MiB the one-write ESFS path is 13.5% lower latency than 64 chunk writes under the same validation-scan contract.

### Optional ESABI native copy lane

Measured live on Illustrator 30.6.0 / ExtendScript 4.5.6 on 2026-09-28. The benchmark uses the same source file for Adobe `File.copy()` and native `CopyFileW`, with two warmups and seven timed samples per lane. Exact content is verified outside the timed region, and the native DLL is unloaded at the end.

| Payload | Adobe `File.copy()` observed medians | Native `CopyFileW` observed medians | Observed native speedup |
|---:|---:|---:|---:|
| 64 KiB | 344–391 µs | 300–317 µs | 1.15–1.23× |
| 1 MiB | 1,809–2,055 µs | 557–568 µs | 3.18–3.69× |

The 64 KiB difference is small; the 1 MiB result is a clear win for the native copy lane on this host. This does **not** cause automatic routing: `ESFS['native'].copyFile()` remains explicit because Win32 reparse-point/alias semantics are not identical to Adobe `File.copy()`. Live testing also exposed that a previously constructed Adobe `File` object can retain stale metadata after an out-of-band Win32 mutation, so post-native inspection reconstructs the `File` from `.fsName`.

---

## Security Model

ESFS is an intentional filesystem mutation primitive. Callers choose File/Folder targets; write, append, copy, rename, replace, and remove operations can change persistent data immediately.

The base `ESFS.jsx` does not load native code. The self-extracting `ESFS.accel.jsx` intentionally materializes and adopts native code during evaluation, but the native methods still receive only Adobe `File.fsName` paths (UTF-8 text); no binary payload is sent through ExternalObject strings. Native APIs can have OS path, alias, and reparse-point behavior different from Adobe File/Folder, so accelerator activation never rewires the default API's semantics. Because native Win32 calls mutate paths outside Adobe's File object, a previously constructed `File` instance can retain stale metadata; reconstruct `new File(file.fsName)` before inspecting metadata after a native mutation. Replacement remains **best effort**, not crash-atomic; no native replacement or fsync/durability claim is made.

ESPACK owns libraries it materializes and caches. ESFS tracks that ownership explicitly: direct `ESFS['native'].load()` handles are unloadable by ESFS, while an ESPACK-adopted handle is borrowed and `ESFS['native'].unload()` only detaches local state.

Alias/shortcut targets are rejected by staged replacement because Adobe's operation-specific alias behavior differs between open/copy and rename/remove.

---

## Compatibility

| Target | Status |
|---|---|
| Conservative ExtendScript ES3 | ESTC static pass |
| Adobe Illustrator 30.6.0 / ExtendScript 4.5.6 | historical 20/20 default-API smoke + current 9/9 native probe pass |
| File/Folder hosts | runtime requires Adobe `File` and `Folder` support |
| Node portable core | Node >=20 development/test tooling |
| Optional native backend | Windows x64 ExternalObject DLL, ESABI 0.3.1 LONG32; not loaded by default |
| ESPACK accelerator | Full + minified bundles live-verified with ESB64Native v2 extraction and ESFSNative v1 adoption |

`Illustrator/2022` Types-for-Adobe is the compile-time baseline, not proof of Illustrator 2022 runtime behavior. Runtime claims are scoped to the explicitly named live host above.

---

## Engine quirks that shaped the design

### ESFS-specific live findings

- **Regex-literal parser hazard:** the initial `renameFile` separator regex passed modern Acorn/JS but Illustrator 30.6.0 rejected the literal. The shipped implementation now uses simple separator checks; the rebuilt artifact is the one proven by final live evidence.
- **BINARY BOM behavior:** `File.open()` can auto-detect a BOM and change `encoding`; the BINARY reader restores BINARY and rewinds to byte zero before reading.
- **Alias semantics are operation-specific:** Adobe File open/copy can resolve aliases while rename/remove act on the alias itself. Staged replacement therefore refuses alias targets.
- **Directory recursion is explicit:** `ensureDirectory()` creates path segments itself rather than treating undocumented parent-creation behavior as portable.

### Inherited evidence

The following are prior measurements from sibling libraries, not ESFS measurements. Unless otherwise stated, their live results apply to Illustrator 30.6.0 / ExtendScript 4.5.6.

| Source | Relevant evidence | ESFS design consequence |
|---|---|---|
| [ESARR](https://github.com/thelabcorner/es-arr/blob/main/README.md#why-esarr) | Variable-index array reads became severely superlinear; a 512-element traversal was about 0.13 ms versus about 0.8 s at 32k. | Filesystem operations stay independent of JS byte arrays; each File property is read only when its contract needs it. |
| [ESB64](https://github.com/thelabcorner/es-b64/blob/main/README.md#performance) | Array writes measured about 15–25 µs each in its fixtures; a 47K-write byte pipeline took about 1.7 s. | BINARY I/O moves one whole byte string through one read/write rather than an array-of-bytes pipeline. |
| [ESON](https://github.com/thelabcorner/eson/blob/main/README.md#performance) | In its measured settings workload, a plain key/value text reader was about 2–4× faster to parse and 13–17× faster to write than ESON JSON. | ESFS stays an I/O primitive rather than taking a JSON dependency. |
| [ESSTR](https://github.com/thelabcorner/es-str/blob/main/README.md#why-esstr) | `charAt()` returned an empty string for U+0000 on the measured engine. | Binary strings rely on File BINARY semantics; ESFS does not use `charAt` or per-byte conversion. |
| [ESCHARS](https://github.com/thelabcorner/es-chars/blob/main/README.md#why-eschars) | A pure-JSX per-unit transform pattern wedged at inputs >=128 KiB after two reproductions. | ESFS avoids JS per-unit binary transforms; its native lane keeps payload bytes OS/file-side and is enabled only explicitly where live end-to-end evidence supports it. |
| [ESTIMER](https://github.com/thelabcorner/es-timer/blob/main/README.md#why-estimer) | `$.hiresTimer` is a delta clock; the first read is not a useful sample. | The benchmark prefers ESTIMER and otherwise primes the raw delta timer immediately before each write. |
| [ESPACK](https://github.com/thelabcorner/espack/blob/main/README.md#features) | A sibling live test round-tripped all 256 byte values, including NUL, through File `BINARY` mode. | This stayed inherited context; ESFS separately validated NUL, 0x80, and 0xFF in its own live smoke. |

---

## Development

```bash
npm run typecheck
npm run build
npm run estc:static
npm test
npm run verify
npm run verify:engine
npm run benchmark:static
npm run native:build
npm run build:accel:strict
npm run accel:contract
npm run estc:accel:live
npm run accel:live
npm run accel:live:min
npm run native:build:check
# In Illustrator after building the DLL:
npm run native:live:probe
npm run native:release:live
npm run native:benchmark
npm run release:gate
```

### Native ABI pin

The optional DLL uses ESABI **0.3.1**, ABI revision 1, Windows x64 LONG32 at immutable release commit `65c9c3ce627a26a89d6bf90547678841df0cf981`. The required ESABI headers and license are vendored under `deps/esabi/` with `ESABI_PIN`; the build validates that provenance before compiling. Development DLL names are content-addressed from source + ESABI headers + pin + build recipe + MSVC identity so a newly built generation never needs to overwrite a DLL still mapped by Illustrator. A separate stable `native/release/ESFSNative.dll` copy is packaged for deployment and is used only when the development manifest is absent. Live probes confirmed that `ExternalObject.unload()` does not guarantee an immediate Windows file unlock, so cleanup of loaded generations is deliberately deferred/best-effort.

### Rollout metadata

- Package: `esfs` 0.2.0; role: runtime primitive; license: GPL-3.0-or-later.
- Build pins: esbuild 0.28.2 and TypeScript 5.9.3; Node >=20.
- ESTC is consumed from the adjacent local `../extendscript-toolchain` checkout and is not a production runtime dependency.
- Canonical hard edge: `extendscript-toolchain -> esfs` (`build-toolchain`).
- Canonical validation back-edge: `esfs -> extendscript-toolchain` (`release-test-only`) via the workspace-audit manifest.
- Canonical native ABI edge: `esabi -> esfs` (`native-abi`), evidenced by `deps/esabi/ESABI_PIN`, `native/esfs_native.c`, and `scripts/build-native.ps1`.
- Canonical accelerator edges: `espack -> esfs` and `esb64 -> esfs` (`composed-bundle`); both feed the tracked release composition and therefore require recompose/retest on upstream release propagation.
- Canonical rollout phase: 1 (`1-bootstrap-and-independent`) after ESTC foundation phase 0.
- ESTC workspace audit includes `dist/ESFS.jsx` and passes it with zero ESFS warnings/errors.
- GitHub repository: [thelabcorner/es-fs](https://github.com/thelabcorner/es-fs).

---

## Repository layout

```text
esfs/
├─ evidence/                    Preserved live/control-plane evidence
├─ scripts/build.mjs            Core/declaration/JSX + ESPACK accelerator composition
├─ scripts/build-native.ps1     Pinned-ESABI Windows DLL build
├─ deps/esabi/                  Immutable ESABI 0.3.1 header snapshot + pin
├─ native/                      ESABI-backed Win32 source
├─ src/                         Core, Adobe adapter, facade, and types
├─ tests/                       Portable tests, adapter, live probes/benchmarks
├─ extendscript.estc.config.mjs ESTC build profile
├─ package.json
└─ README.md
```

Generated `dist/` output is intentionally ignored.

---

## Credits

- [Docs for Adobe — File object](https://extendscript.docsforadobe.dev/file-system-access/file-object/) for open modes, encoding, BINARY, read/write, copy/rename/remove, and metadata semantics.
- [Docs for Adobe — Folder object](https://extendscript.docsforadobe.dev/file-system-access/folder-object/) for create, `getFiles`, parent, metadata, and empty-folder removal.
- [Docs for Adobe — Using File and Folder objects](https://extendscript.docsforadobe.dev/file-system-access/using-file-and-folder-objects/) for path representation and object usage.
- [ESTC](https://github.com/thelabcorner/estc) and [COMTool](https://github.com/thelabcorner/COMTool) for portable and live-engine validation.

---

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

---

<p align="center"><small>ESFS: explicit synchronous File/Folder I/O contracts for Adobe ExtendScript.</small></p>
