# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.4.x   | ✅ Currently supported |
| 0.3.x   | ❌ No longer supported |
| 0.2.x   | ❌ No longer supported |
| 0.1.x   | ❌ No longer supported |

## Reporting a Vulnerability

We take security seriously at PatchCat. If you discover a security vulnerability, please report it responsibly.

### How to Report

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please email us at: **guobug@users.noreply.github.com**

Include the following information in your report:
- Description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Suggested fix (if any)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within **48 hours**.
- **Assessment**: We will assess the vulnerability and determine its severity within **7 days**.
- **Resolution**: We aim to release a fix within **30 days** for critical vulnerabilities.
- **Disclosure**: We will coordinate with you on public disclosure timing.

### Security Design Principles

PatchCat is designed with a **Local-First & BYOK (Bring Your Own Key)** security architecture:

1. **Client-Side Key Management**: API keys are stored in the user's browser LocalStorage and sent directly to configured AI provider endpoints, or optionally proxied via the local router Go Gateway strictly to whitelisted upstream AI providers with RFC1918 private IP and SSRF blocking.
2. **Automatic Credential Sanitization**: All log outputs recursively mask API keys (`sk-***`, `AIzaSy***`), Bearer tokens, and password fields via the `sanitizeData` engine.
3. **Code & Expression Sandbox Isolation**: User-submitted JavaScript in Code Nodes and Condition expressions executes in an isolated Web Worker sandbox with an automated watchdog timeout (3–5s), stripped of network APIs (`fetch`, `XMLHttpRequest`, `WebSocket`), DOM, and `localStorage` access.
4. **No Telemetry / No Tracking**: PatchCat collects zero analytics, telemetry, or remote usage tracking data.

### Scope

The following are considered in-scope for security reports:

- XSS vulnerabilities in the visual canvas or panel components
- API key leakage through logs, network requests, or export bundles
- Code sandbox escape in JavaScript execution environments (Code & Condition nodes)
- SSRF, credential leakage, or CORS bypasses in the Go Gateway (`gateway/main.go`)
- CSRF, injection, or authentication vulnerabilities in the FastAPI backend (`server/`)
- Dependency vulnerabilities with known CVEs

### Out of Scope

- CORS restrictions when using HTTP Request nodes (this is a browser security feature, not a vulnerability)
- Issues that require physical access to the user's machine
- Social engineering attacks

Thank you for helping keep PatchCat and its users safe! 🐱🛡️
