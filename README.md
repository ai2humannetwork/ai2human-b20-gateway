# AI2Human B20 Gateway

B20 proof gateway connecting Base token rules with AI2Human human verification.

## Why This Exists

B20 gives tokens programmable rules. AI2Human adds a human verification layer before sensitive token actions such as mint eligibility, allowlist membership, or role assignment.

The gateway helps an agent or issuer turn a natural-language request into:

- B20 token config
- role config
- policy config
- proof requirements
- deployment checklist
- optional AI2Human verification task template

## Example

```text
Create a B20 token for a verified RWA community.
Max supply 1,000,000.
Only verified members can mint.
Require AI2Human proof before role assignment.
```

Output:

```text
token config -> roles -> policies -> proof requirements -> deployment plan
```

## Base Sepolia Test Evidence

The current product has already tested B20-style issuance and mint flow on Base Sepolia.

- Token: `VRWA`
- B20 token address: `0xb20000000000000000000012301fA16F1D998b29`
- Mint tx: `0xafe105c85c0874d7b726556f39cdaf1d9cfa4afadb3745bec899b77bd2d0d72a`
- Recipient: `0x72d39aaf15299BE7F1541D0587584499040570a2`

## Usage

```bash
npm install
npm test
```

## Status

Testnet gateway seed extracted from the live AI2Human app.

## Links

- Website: https://ai2human.work
- X: https://x.com/ai2humannetwork
- B20 page: https://ai2human.work/agent/b20

