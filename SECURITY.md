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

1. **Zero Server-Side Key Storage**: API keys are stored exclusively in the user's browser LocalStorage and are never transmitted to any third-party server.
2. **Automatic Credential Sanitization**: All log outputs recursively mask API keys (`sk-***`, `AIzaSy***`), Bearer tokens, and password fields via the `sanitizeData` engine.
3. **Code Sandbox Isolation**: User-submitted JavaScript in Code Nodes executes in an isolated Web Worker sandbox with a 5-second watchdog timeout.
4. **No Telemetry / No Tracking**: PatchCat collects zero analytics, telemetry, or usage data.

### Scope

The following are considered in-scope for security reports:

- XSS vulnerabilities in the canvas or panel components
- API key leakage through logs, network requests, or storage
- Code sandbox escape in the JavaScript execution environment
- CSRF or injection vulnerabilities in the FastAPI backend
- Dependency vulnerabilities with known CVEs

### Out of Scope

- CORS restrictions when using HTTP Request nodes (this is a browser security feature, not a vulnerability)
- Issues that require physical access to the user's machine
- Social engineering attacks

Thank you for helping keep PatchCat and its users safe! 🐱🛡️
