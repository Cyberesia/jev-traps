# Security policy

Jev Traps is security tooling, not a guarantee of safety.

## Reporting vulnerabilities in Jev Traps

Please open a GitHub security advisory rather than a public issue when the report could enable bypass, exfiltration, remote execution, or disclosure of private registry submissions.

## Registry evidence rules

Public registry entries should contain only the minimum evidence needed to reproduce a finding. Payloads are redacted and rendered inert. Never publish:

- API keys, cookies, access tokens, passwords, or personal data;
- authenticated/private pages or intranet addresses;
- live JavaScript exploit payloads;
- URLs carrying session tokens or sensitive query parameters.

A trap finding does not by itself prove that a website was compromised. Use factual labels such as `observed` or `confirmed agent trap` unless there is independent evidence of compromise.

## Current limitations and supported releases

The 0.1.x line is experimental. There is no security SLA or guarantee that a clean scan means safe content. For a sensitive vulnerability use the repository's private reporting channel once the maintainer enables it; do not include a working exploit in a public issue.

The static HTML parser and sanitizer are lightweight; do not use the sanitizer as an XSS filter. `safeSnapshot` withholds non-allow pages and omits raw titles, but cannot certify all allowed content. Treat raw report evidence as untrusted diagnostic data.

Image inspection uses a fallible vision model before Jev classification. It can miss low-visibility text, adversarial perturbations and previously unseen techniques. A returned region is approximate. No built-in pixel sanitizer exists. Failed or incomplete image scans must not release the original image.

The local URL scanner is not a production SSRF boundary. Host validation does not prevent DNS rebinding between validation and connection. Use a disposable isolated runtime and enforced egress policy; never expose it as a public endpoint. The public registry has no remote scan route and disables submissions in production until explicitly configured.
