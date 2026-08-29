# LLM Coach Layer — design & decision

Status: **decided, documented, not yet implemented.**

## Decision
- **BYOK (bring your own key).** Users paste their own LLM provider key. We
  self-host no LLM and pay for no user tokens.
- **Why:** the deterministic engine is ~90% of the product's value; the LLM is a
  thin "coach" layer on top. BYOK keeps server cost near $0 and keeps health
  data + billing in the user's hands — "your key, your data, your bill." For a
  period / diet / relationship app, that is a trust feature, not a compromise.

## Architecture: thin server proxy (chosen)
- New endpoint `POST /api/coach` on the existing FastAPI server.
- Request: `{ provider, api_key, model, messages, context }` where `context` is
  the deterministic engine's output (stretch, cycle day, calendar, recommendations).
- The server forwards to the chosen provider and returns the text. The key is
  used for that request only and is **never written to disk, logged, or stored**.
- **Why not client-direct:** OpenAI and Anthropic block browser-origin API calls
  (no CORS headers). OpenRouter and local Ollama allow it, but one proxy path
  handles every provider uniformly and gives us a place for rate limiting and
  audit later.

## Providers (provider-agnostic)
| Provider  | Base URL                       | Credential          | Notes                                |
|-----------|--------------------------------|---------------------|--------------------------------------|
| OpenAI    | https://api.openai.com/v1      | OpenAI API key      | most common                          |
| Anthropic | https://api.anthropic.com/v1   | Anthropic API key   | own messages format                  |
| OpenRouter| https://openrouter.ai/api/v1   | OpenRouter API key  | one key → many models; CORS-friendly |
| Local     | http://localhost:11434 (or URL)| none (BYO-endpoint) | fully private, runs Ollama           |

OpenAI, OpenRouter, and Ollama (via its `/v1` shim) are OpenAI-compatible.
Anthropic needs its own request shape.

## Key storage
- Default: browser `localStorage` (paste once). XSS risk here is low — vanilla
  JS, no third-party scripts, all output escaped.
- Stricter alternative: in-memory only (re-enter each visit). Decide at build time.

## Product model
- **Free, always-on:** the deterministic engine — the whole app works with no key.
- **Optional unlock:** "connect your own key" enables the coach layer.
- **Later (monetize / mainstream):** add our own hosted model behind a
  subscription, alongside BYOK. BYOK stays for the privacy-conscious.

## Data flow
```
browser → POST /api/coach (provider + key + engine context)
        → provider
        → text
        → browser
```
The server holds the key only for the duration of one request.

## Security requirements (build time)
- Never log `api_key` — FastAPI/uvicorn request logging must redact it.
- Enforce HTTPS in production (keys in transit).
- Consider a per-key request cap later.
- The coach is strictly **additive**: it talks *about* what the engine computes,
  never overrides it. `engine.py` remains the source of truth.

## Implementation sketch (when we build it)
- `coach.py` — a small router mapping provider → request shape + response parse.
- `main.py` — add `POST /api/coach` (pydantic model, redacted logging).
- `static/` — a settings block (provider dropdown, key input, model choice) and
  a "Coach" card in the results.
- `tests/` — mock provider responses; assert the key is never persisted or logged.
