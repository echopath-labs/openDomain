# Security Policy

OpenDomain is currently early alpha.

## Reporting a Vulnerability

Please report suspected security issues privately by emailing:

```text
chasechou007@gmail.com
```

Include:

- affected version or commit
- reproduction steps
- expected impact
- any suggested mitigation

Please do not open public issues for vulnerabilities until there is a safe
public disclosure path.

## Scope

Security-sensitive areas include:

- parsing untrusted Markdown/front matter
- CLI file path handling
- generated indexes and derived artifacts
- future integrations such as MCP resources, IDE plugins, or external services

OpenDomain source files and generated indexes should not contain secrets.
