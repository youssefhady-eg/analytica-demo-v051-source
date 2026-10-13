# Security Policy

## Reporting a vulnerability

Please report suspected vulnerabilities privately — do not open a public issue.

Use GitHub's [private vulnerability reporting](../../security/advisories/new)
for this repository, or contact the maintainer directly.

Include: what you found, how to reproduce it, and the impact you believe it has.
We aim to acknowledge reports within a few days.

## Scope and model

Analytica is a **static, client-side demo**. There is no server, no database,
and no data leaves the browser except in one opt-in path:

- **Level 2 ("live" Analyst, BYOK).** When a user enables it and pastes their
  own API key, the app sends already-computed aggregate metrics — never raw
  CSV rows — to the endpoint the user configures (OpenAI-compatible
  chat-completions). The key is held in React state only: never persisted,
  never sent anywhere except that endpoint.

Consequences worth knowing:

- Uploaded CSVs are parsed entirely in the browser. They are not uploaded.
- The app ships as static files (`out/`); there is no attack surface from a
  running backend, but also no server-side secret to leak.
- Dependencies are kept current via Dependabot (`.github/dependabot.yml`).

## Supported versions

This is a prototype/demo; only the current `main` branch is supported.
