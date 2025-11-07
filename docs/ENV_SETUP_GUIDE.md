# Environment Setup Guide for SSO

## Required Environment Variables

### HR System (Root `.env` file)

```env
# RSA Private Key for signing JWT tokens for Payroll SSO
HR_PAYROLL_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC3OA896obA1wwt\nR9CDqGpsgoXH5Pa47XDXH3Aa6F8aiIEAAhQ75b/Us6ZXfbmp9tUrsT8X7Cp+MIwn\nFoCH6lRy1JT0YUdr41m0e+HxjA9eCIvFiZbtJNoQU2Lbt4RK+WGS4buHZAQO1pD0\noKZT25HK+TOjabpnuH9nA5gkaz0/I7J/ugO0UyQ95xh0KDFf3kLURKLHmksAMYIw\n1NDZuZVwFIbLHSVoWWng7f0G6kNIyMzshYfXm/TNjlECAR3B27UoZrBRBmNr1yTu\naGqE7MGWF6lrwflNGkWsudJv8va2ws59cXxxmR/s0NmklUc/vPmM2BmMYZ9YL8pr\nsN+vIU+XAgMBAAECggEALjZTkdhfmLAlAB7G9w45mZjqSVr05/vrpDbnvcGyiyy2\n7NuZYuo2El4lrJenhrkdV2HjehM1PJLeJtXEIYP3POdlkqYer5WugJlmidg74Anj\nxzVG/hV3cvq1SpnlIkv4UmXhOOr/Iwb3lNwYV7pf8YQdhDActiCQ8di0PStXTV8y\n457E/Mz0QVaCmmeObTZU9inisEsjxEskz38ljleeX5j+dxGIF6SVLXPRQ726i9h1\n7w0yjqKVZkdM7SLuIe4kaA3pbxoKppb2I5QYv6y5tO7cfMhs2mrvKos+hXUo/EFy\nWrP96X/d8eSrsyd3M24ULkRawFvE2IpK7E7SBDMMAQKBgQD/JK5W/CRQ94W+53kS\nJM7AtEs7TuZppGrwUis5buKrafVTbJGBXtIjztfRUgboy3iztfBu4VmpPozMr/aQ\nC/7LnW/fMBHx+mdb3zw5LzrucJ+t9s9bUhbIjeDT4ov2Oz93eATWqn+vQC76rNnB\nwFAoVpg8dxwNBgAU2zesVYfhAQKBgQC31Y2R9u/mmSGDaYawJWXkXeDMMjVhsUfe\nfU/X8a6bHUTtDrHQT9QzTMRTi8UuLB1N+C7rnl47r8P735BHkmyoRxBwuNQUQ3ou\nbcN279RO9GWnlbQ9uzXjzq471sjfcTkV+TcdcCioLvYYdUhylvn4wqVxSFb9w9fg\nFRO5i2OYlwKBgQCS2DK6/52LOBqy+Bg3eBXC1UGjXdLBJI8jx7b29DnjPDWlEQxh\nsAgz8b1GzPYLD+hlTiaWOn7XKJfyyqeW2kCIQhF8G/eIFH1eZAoOQ3+gchOFFVLc\nlU9lmDq42F+DlS/++4WVY0XfwIoJXmhp2dyIiuZNjqQHXte3KUBOoF93AQKBgQCb\nYTv8kKxqyymBalM2VRXPNO4JibKG9RHa4y32RsefQdj9STtP5/littMGDpBGG3FV\ncp0t97iMWF6daHQJmqCOhypFLGPNEM+XqJzazZE0fuvg/u7Ocor1Fr87wqob+hYX\nFYLZNfCXXsIRIChw+l0kPlkZ69vjN4IiW45FeKRg1wKBgQCzHg6w2hfxfhUc91rt\nuLMd0CsJpHU9eMsgwBjh5ouigek3z+IDla1yND18BfoFvqgdhntm4E6T303OxWih\n07oXLpPxvsWfuuLk8H3R0pom+JXc8J4bwk32+2Cnbc3n/em9pkAP5H+dUwOdfEbX\n889uiftu+8Ro403hZQU3ygceKg==\n-----END PRIVATE KEY-----\n"

# Payroll Integration
PAYROLL_INTEGRATION_ENABLED=true
PAYROLL_BASE_URL=http://localhost:3002
PAYROLL_API_URL=http://localhost:4000
```

### Payroll System (Docker Compose or `.env`)

The `docker-compose.yml` already has the environment variable configured:
```yaml
- HR_PAYROLL_JWT_PUBLIC_KEY=${HR_PAYROLL_JWT_PUBLIC_KEY}
```

You need to either:

**Option 1: Add to `.env` file (recommended)**
Create a `.env` file in the root directory with:
```env
HR_PAYROLL_JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtzgPPeqGwNcMLUfQg6hq\nbIKFx+T2uO1w1x9wGuhfGoiBAAIUO+W/1LOmV325qfbVK7E/F+wqfjCMJxaAh+pU\nctSU9GFHa+NZtHvh8YwPXgiLxYmW7STaEFNi27eESvlhkuG7h2QEDtaQ9KCmU9uR\nyvkzo2m6Z7h/ZwOYJGs9PyOyf7oDtFMkPecYdCgxX95C1ESix5pLADGCMNTQ2bmV\ncBSGyx0laFlp4O39BupDSMjM7IWH15v0zY5RAgEdwdu1KGawUQZja9ck7mhqhOzB\nlhepa8H5TRpFrLnSb/L2tsLOfXF8cZkf7NDZpJVHP7z5jNgZjGGfWC/Ka7DfryFP\nlwIDAQAB\n-----END PUBLIC KEY-----\n"
```

**Option 2: Set directly in docker-compose.yml**
Replace `${HR_PAYROLL_JWT_PUBLIC_KEY}` with the actual key value.

## Quick Setup Steps

1. **Generate Keys** (if not already done):
   ```bash
   node scripts/generate-rsa-keys.js
   ```

2. **Copy Keys to .env file**:
   - Copy the private key to root `.env` as `HR_PAYROLL_JWT_PRIVATE_KEY`
   - Copy the public key to root `.env` as `HR_PAYROLL_JWT_PUBLIC_KEY`

3. **Restart Services**:
   ```bash
   docker-compose restart api payroll-api
   ```

4. **Verify Setup**:
   ```bash
   # Check HR API has private key
   docker exec <hr-api-container> env | grep HR_PAYROLL_JWT_PRIVATE_KEY
   
   # Check Payroll API has public key
   docker exec <payroll-api-container> env | grep HR_PAYROLL_JWT_PUBLIC_KEY
   ```

## Testing SSO

1. Login to HR system
2. Click "Payroll" link in sidebar
3. Should redirect to Payroll app with SSO token
4. Should automatically log in to Payroll

## Troubleshooting

### SSO Not Working

1. **Check keys are set**:
   ```bash
   docker-compose exec payroll-api env | grep HR_PAYROLL_JWT_PUBLIC_KEY
   docker-compose exec api env | grep HR_PAYROLL_JWT_PRIVATE_KEY
   ```

2. **Check server logs**:
   ```bash
   docker-compose logs payroll-api | grep -i sso
   docker-compose logs api | grep -i payroll
   ```

3. **Verify token format**:
   - Keys must include `\n` for newlines when in .env file
   - Keys must start with `-----BEGIN` and end with `-----END`

### Server Crashing

- Check database connection
- Verify `payroll_employee_view` exists
- Check all queries use correct column names

