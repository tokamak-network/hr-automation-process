# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in the Tokamak Hiring System, please report it responsibly.

**Do NOT open a public issue.**

Instead, email: **security@tokamak.network**

We will respond within 48 hours and work with you to resolve the issue.

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | ✅ Active |

## Security Considerations

- API keys and tokens are stored in `.env` (never committed)
- Database contains candidate information — handle with care
- LinkedIn/GitHub API access is rate-limited and logged
- User authentication is header-based (MVP) — production should use wallet signatures
