# Security Policy

## Supported Versions

Only the latest version of the MCP Browser Agent is actively maintained and receives security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.7.x   | :white_check_mark: |
| < 0.7.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in the MCP Browser Agent, please follow these steps:

1. **Do not disclose the vulnerability publicly** until it has been addressed by the maintainers.
2. Email the details to [your-email@example.com] with "MCP Browser Agent Security Vulnerability" in the subject line.
3. Include a detailed description of the vulnerability and steps to reproduce it if possible.
4. You can expect an initial response within 48 hours acknowledging receipt of your report.
5. We will keep you informed about the progress of addressing the vulnerability.
6. Once the vulnerability is fixed, we will credit you (if desired) in the release notes.

## Prohibited Uses and Security Warnings

The MCP Browser Agent is a powerful tool that provides Claude with autonomous browser control capabilities. Due to its nature, there are significant security implications to be aware of:

### Prohibited Uses

The MCP Browser Agent must NOT be used for:

- **Unauthorized Data Collection**: Scraping data from websites without permission or in violation of terms of service.
- **Privacy Invasion**: Capturing screenshots or data containing personal information without proper consent.
- **Security Exploitation**: Executing malicious code, performing XSS attacks, or exploiting vulnerabilities.
- **Automated Abuse**: Credential stuffing, brute force attacks, spam creation, or DDoS attacks.
- **Authentication Bypass**: Circumventing authentication systems or accessing unauthorized content.
- **Social Engineering**: Creating deceptive content or conducting phishing campaigns.
- **API Abuse**: Overwhelming services with excessive requests or manipulating APIs without authorization.
- **Impersonation**: Interacting with websites while impersonating real users for deceptive purposes.
- **Scraping Restrictions**: Users must respect robots.txt files and website scraping policies.

### Security Implications

Users should be aware of the following security implications:

1. **Browser Context Exposure**: The browser instance controlled by the MCP Agent can execute arbitrary JavaScript, potentially exposing the host system to risks.
2. **Credential Security**: Any credentials used within the browser session could potentially be exposed through logs or screenshots.
3. **Network Exposure**: The agent can make HTTP requests to any endpoint, potentially accessing internal network resources.
4. **Resource Consumption**: Automated browsing can consume significant system resources, especially with multiple concurrent sessions.
5. **Data Leakage**: Screenshots and logs may contain sensitive information that should be handled securely.

### Security Best Practices

To mitigate these risks:

- Use the agent in an isolated environment whenever possible.
- Never expose the agent to untrusted inputs or instructions.
- Regularly review browser logs and screenshots to monitor usage.
- Do not use the agent with sensitive accounts or on networks containing sensitive information.
- Limit the agent's access to specific domains when possible.
- Treat the browser instance as potentially compromised - do not use it for personal or sensitive activities.

## Legal Compliance

The user is solely responsible for ensuring their use of this tool complies with:
- Website terms of service and usage policies
- Data protection regulations (such as GDPR, CCPA, etc.)
- Computer fraud and abuse laws
- Intellectual property rights

## Disclaimer

The developers of the MCP Browser Agent assume no liability for any misuse, damage, or legal consequences arising from the use of this tool. Users assume all responsibility and risk associated with deploying and using this agent.