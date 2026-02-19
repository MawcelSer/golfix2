# Security Review

## Description

Structured security vulnerability scanning workflow following OWASP guidelines and project security rules.

## When to Use

- Before every commit (auto-triggered via security-reviewer agent)
- During code review
- After adding new endpoints or user-facing features
- When handling authentication/authorization changes

## Checklist

### Input Validation
- [ ] All user inputs validated with schema library (Zod, Joi, etc.)
- [ ] File uploads validated (type, size, content)
- [ ] URL parameters sanitized

### Injection Prevention
- [ ] SQL: Parameterized queries only
- [ ] XSS: HTML output escaped/sanitized
- [ ] Command: No shell injection vectors
- [ ] LDAP/NoSQL: Queries sanitized

### Authentication & Authorization
- [ ] Auth required on all protected routes
- [ ] Authorization checked (not just authentication)
- [ ] Tokens have appropriate expiry
- [ ] Password hashing uses bcrypt/argon2

### Data Protection
- [ ] Secrets in environment variables only
- [ ] Error messages don't expose internals
- [ ] Logs don't contain sensitive data
- [ ] HTTPS enforced

### Rate Limiting
- [ ] Public endpoints rate-limited
- [ ] Login attempts throttled
- [ ] API keys have usage limits
