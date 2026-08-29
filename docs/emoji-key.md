# Emoji-key identity — decisions (held, not built)

Status: decided at a high level, build deferred.

## Decisions (Lisa, 2026-08-13)
- No logins. Unlock = **passkey + emoji sequence (both)**.
- Emoji: **user-chosen, max 3** (memorable over maximum entropy).
- Recovery: **email** allowed as a fallback.
- Data location: **server blob store** (vault), rate-limited, per-account size cap, delete-by-ID.

## Flagged trade-off (reconcile before build)
"Choose 3 emoji + email recovery" is a friendly login, not strong end-to-end
encryption. If email can restore access to *data*, the server holds (or can
re-derive) a key, which weakens the "we literally can't read your data" claim.
Decide: (a) email recovers the *account* but not the data (forgot emoji = data
loss), or (b) email recovers data too (server escrows a recovery key — weaker
privacy). The passkey stays the strong anchor either way.
