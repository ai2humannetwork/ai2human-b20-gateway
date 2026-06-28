# AI2Human B20 Agent Skill

Use this skill when an agent or builder wants to design a B20 token system on Base with roles, policies, supply caps, freeze controls, mint eligibility, and AI2Human proof inputs.

This skill does not broadcast transactions or custody keys. It produces a B20 configuration bundle that a builder can review, simulate, encode with Base tooling, and deploy through the B20Factory precompile after Beryl/B20 activation.

For a real Base Sepolia deployment, this repo now includes Foundry scripts:

```text
b20-contracts/script/CreateAI2HumanB20.s.sol
b20-contracts/script/MintAI2HumanB20.s.sol
scripts/deploy-b20-base-sepolia.sh
```

The scripts require Base Foundry (`base-forge` and `base-cast`) plus a funded Base Sepolia deployer key. The skill should still preview and review the config before any broadcast.

## One-Line Setup

Read this file, collect the token intent, generate a B20 configuration preview, then review the role, policy, proof, and deployment checklist before any onchain action.

Preview endpoint:

```text
https://ai2human.io/api/agent/b20/preview
```

Machine-readable manifest:

```text
https://ai2human.io/agent/b20/manifest.json
```

Human-readable demo:

```text
https://ai2human.io/agent/b20
```

OpenClaw test prompt:

```text
https://ai2human.io/agent/b20/openclaw-test.md
```

Example request:

```text
https://ai2human.io/agent/b20/examples/rwa-community-token.json
```

## What This Skill Does

The B20 Agent Skill turns a natural-language token request into:

- B20 token config
- roles config
- policy config
- AI2Human proof requirements
- deployment checklist
- optional human verification task template

Core framing:

```text
B20 gives tokens native rules.
AI2Human gives those rules verifiable inputs.
```

## Use Cases

Use this skill for:

- verified community tokens
- RWA or tokenized asset access lists
- local stablecoin or issuer policy planning
- agent-created token systems that need role, mint, or allowlist checks
- proof-based membership, role assignment, reward, or compliance workflows

Do not use this skill for:

- evading compliance
- hiding beneficial ownership
- fake attestations
- token launches with invented admins, roles, policy owners, or proof sources
- broadcasting transactions without human review and simulation

## B20 Facts the Skill Must Preserve

B20 is Base's native token standard. It is ERC-20 compatible but implemented as Rust precompiles and deployed through the singleton B20Factory precompile.

B20 supports:

- `ASSET`: configurable 6-18 decimals, plus Asset-only capabilities such as operator-controlled multiplier, announcements, batch mint, and extra metadata.
- `STABLECOIN`: fixed 6 decimals and a self-declared fiat currency code.

B20 base roles:

- `DEFAULT_ADMIN_ROLE`
- `MINT_ROLE`
- `BURN_ROLE`
- `BURN_BLOCKED_ROLE`
- `PAUSE_ROLE`
- `UNPAUSE_ROLE`
- `METADATA_ROLE`

Asset variant also supports:

- `OPERATOR_ROLE`

B20 policy scopes:

- `TRANSFER_SENDER_POLICY`
- `TRANSFER_RECEIVER_POLICY`
- `TRANSFER_EXECUTOR_POLICY`
- `MINT_RECEIVER_POLICY`

Policies are managed through the PolicyRegistry as `ALLOWLIST` or `BLOCKLIST` policies. Every policy ID must be validated with `policyExists(policyId)` before writing it into a B20 token scope.

Every B20 policy scope defaults to `ALWAYS_ALLOW` unless constrained during bootstrap `initCalls`, so the skill should never treat a raw B20 deployment as restricted by default.

## Input Pattern

Ask for exact values. Do not invent live admins, policy owners, token names, supply caps, or verification terms.

```json
{
  "intent": "Create a B20 token for a verified RWA community. Max supply 1000000. Only verified members can mint. Admin can freeze risky addresses. Require AI2Human proof before role assignment.",
  "token": {
    "variant": "ASSET",
    "name": "Verified Community Asset",
    "symbol": "VCA",
    "decimals": 18,
    "maxSupply": "1000000",
    "initialAdmin": "0x..."
  },
  "roles": {
    "minter": "0x...",
    "pauser": "0x...",
    "metadata": "0x...",
    "compliance": "0x..."
  },
  "proof": {
    "required": true,
    "requiredFor": ["mint eligibility", "role assignment", "allowlist membership"],
    "tasks": [
      "Verify member eligibility.",
      "Collect document or community membership proof.",
      "Review proof before role assignment."
    ]
  }
}
```

## Preview Before Building

```bash
curl -s https://ai2human.io/agent/b20/examples/rwa-community-token.json | \
curl https://ai2human.io/api/agent/b20/preview \
  -H "Content-Type: application/json" \
  -d @-
```

Expected response includes:

- `tokenConfig`
- `rolesConfig`
- `policyConfig`
- `proofRequirements`
- `deploymentPlan`
- `missingInputs`
- `nextQuestions`
- `warnings`

If `missingInputs` is not empty, ask the requester for the exact values before continuing.

## Base Sepolia Testnet Deployment

After preview approval, a builder can deploy the testnet B20 artifact with:

```bash
cp b20-contracts/.env.b20.example b20-contracts/.env.b20
# Fill PRIVATE_KEY and ACCOUNT_ADDRESS with a funded Base Sepolia deployer.
./scripts/deploy-b20-base-sepolia.sh
```

The deployment script:

- builds the B20 scripts with `base-forge`
- deploys an `ASSET` B20 through `B20Factory`
- grants B20 roles to the configured admin
- sets the supply cap
- mints an optional test balance
- verifies `balanceOf` with `base-cast`

## How To Interpret The Output

### tokenConfig

Defines the B20 variant, name, symbol, decimals, supply cap, admin, contract metadata URI, salt hint, and B20Factory creation method.

### rolesConfig

Maps B20 roles to intended controller wallets. If any role says `REQUESTER_REQUIRED`, stop and ask the requester for a real wallet.

### policyConfig

Maps Base B20 policy scopes to allowlist or blocklist policies. For RWA, stablecoin, and verified community flows, mint receiver policy usually becomes an allowlist fed by AI2Human proof.

### proofRequirements

Defines what AI2Human must verify before an account receives a role, allowlist membership, or mint eligibility. The output includes a memo-ready `bytes32` proof hash pattern for B20 memo-bearing operations.

### deploymentPlan

Provides a checklist and `initCallsPlan`. This is not encoded calldata. A builder should encode it with Base tooling, simulate it, and deploy only after the B20 feature is active.

## Safe Operating Rules

- Treat this skill as proof-to-policy infrastructure, not a blind token deployer.
- Always preview and review before deployment.
- Never request or expose private keys.
- Never invent policy IDs. Create or attach real PolicyRegistry IDs and validate them.
- Never claim a policy is enforced unless it is attached to a B20 policy scope.
- Always identify which AI2Human proof controls mint eligibility, role assignment, or policy membership.

## Official References

- Base B20 docs: `https://docs.base.org/base-chain/specs/upgrades/beryl/b20`
- Base Standard Library: `https://github.com/base/base-std`
- AI2Human Network: `https://ai2human.io`
