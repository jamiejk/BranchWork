# Search & background tasks

BranchWork splits model work into two lanes. The **main model** runs
explorations and drafting. The **background model** handles everything that
runs often, in bulk, or unattended — source extraction after an exploration,
entity extraction, build-out suggestions, and generating web search queries.

Configure both under ⚙ Models:

- *Main model* — top bar picker (✦)
- *Background tasks* — ⚙ Models → "Background tasks (extraction & search queries)".
  Leave it on "Same as main model" to use one model for everything.

## Using a local model for background work

The background lane is intentionally low-stakes: JSON replies with lenient
parsers and hard caps (≤6 sources, ≤5 entities per run). A small local model
works well here — it keeps costs at zero, works offline, and runs without rate
limits.

Any OpenAI-compatible endpoint works, including:

- Ollama (`http://localhost:11434/v1`) — e.g. Gemma 2/3 9B–27B
- llama.cpp `llama-server` on any LAN host
- A cloud API if you prefer

Setup: ⚙ Models → add the endpoint + key (dummy value is fine for local
servers), add the model, then select it under *Background tasks*.

## The headless DuckDuckGo browser

Build-out ("web search" from a card's context menu) does real web lookups via
`ddgr` — a terminal DuckDuckGo client driven headlessly by the dev server.

Requirements:

1. **`ddgr` installed on the machine running the dev server** (not the
   browser). Debian/Ubuntu: `sudo apt install ddgr`. Fedora:
   `sudo dnf install ddgr`.
2. No API key needed — DuckDuckGo html endpoints are free; `ddgr --np`
   disables pager prompts so output stays machine-readable.
3. The model generates 3–4 diverse queries per card; each runs as a
   `ddgr -n 3` call (15s timeout). Results are deduped against sources already
   in the graph before new nodes are created.

Debugging: if searches silently return nothing, check `/tmp/ddgr-debug.log` on
the server host, then run `ddgr --np -n 3 "test query"` by hand — most issues
are rate limiting (DuckDuckGo throttles aggressive automated queries) or a
missing binary.

## Why two models?

Extraction/query-generation fires after every exploration. Pointing that at a
large paid model multiplies cost for structured output a small model handles
fine. Keeping the split explicit lets you run e.g. a frontier cloud model for
exploration while Gemma answers the housekeeping locally — provenance is
recorded per-run either way, so every generated card shows which model made it.
