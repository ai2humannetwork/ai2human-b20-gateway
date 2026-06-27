import crypto from "crypto";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const DEFAULT_CHAIN_ID = 8453;
const B20_SCOPES = [
  "TRANSFER_SENDER_POLICY",
  "TRANSFER_RECEIVER_POLICY",
  "TRANSFER_EXECUTOR_POLICY",
  "MINT_RECEIVER_POLICY"
];

function readString(value) {
  return String(value || "").trim();
}

function readObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function readArray(value) {
  return Array.isArray(value) ? value : [];
}

function isAddress(value) {
  const text = readString(value).toLowerCase();
  return /^0x[a-f0-9]{40}$/.test(text) && text !== ZERO_ADDRESS;
}

function normalizeVariant(value) {
  const text = readString(value).toLowerCase();
  if (text === "stablecoin") return "STABLECOIN";
  return "ASSET";
}

function normalizeSymbol(value) {
  return readString(value).replace(/[^a-zA-Z0-9]/g, "").slice(0, 12).toUpperCase();
}

function normalizeDecimals(value, variant) {
  if (variant === "STABLECOIN") return 6;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 18;
  return Math.max(6, Math.min(18, Math.floor(numeric)));
}

function normalizeSupply(value) {
  const text = readString(value || "1000000").replace(/,/g, "");
  const numeric = Number(text);
  if (!Number.isFinite(numeric) || numeric <= 0) return "1000000";
  return String(numeric);
}

function normalizeAddressList(value) {
  return readArray(value)
    .map((item) => readString(item))
    .filter(isAddress);
}

function firstAddress(...values) {
  for (const value of values) {
    if (isAddress(value)) return readString(value);
  }
  return "";
}

function inferUseCase(input) {
  const text = [
    input.intent,
    input.prompt,
    readObject(input.token).useCase,
    input.useCase
  ]
    .map(readString)
    .join(" ")
    .toLowerCase();
  if (text.includes("stable") || text.includes("local currency") || text.includes("local stablecoin")) {
    return "local-stablecoin";
  }
  if (text.includes("rwa") || text.includes("real world") || text.includes("real-world") || text.includes("equity")) {
    return "rwa-community";
  }
  if (text.includes("community") || text.includes("member") || text.includes("allowlist")) {
    return "verified-community";
  }
  return "general-token-system";
}

function defaultProofTasks(useCase) {
  if (useCase === "local-stablecoin") {
    return [
      "Verify issuer identity and public entity profile.",
      "Collect proof of reserve or attestation reference.",
      "Verify jurisdiction, currency code, and policy owner.",
      "Return a structured proof hash for mint eligibility and role assignment."
    ];
  }
  if (useCase === "rwa-community") {
    return [
      "Verify member or issuer eligibility.",
      "Collect document, location, entity, or community membership proof.",
      "Review proof before role assignment or mint allowlist update.",
      "Return a structured proof hash that can be attached to a memo or policy update."
    ];
  }
  return [
    "Verify account eligibility.",
    "Collect task completion or membership proof.",
    "Review proof before mint or role assignment.",
    "Return a structured proof hash for downstream B20 policy usage."
  ];
}

function buildProofRequirements(input, token, useCase) {
  const proof = readObject(input.proof);
  const tasks = readArray(proof.tasks).map(readString).filter(Boolean);
  const required = proof.required !== false;
  const requiredFor = readArray(proof.requiredFor).map(readString).filter(Boolean);
  return {
    required,
    provider: "AI2Human Network",
    proofType: readString(proof.proofType) || "structured_verification_bundle",
    requiredFor: requiredFor.length
      ? requiredFor
      : ["mint eligibility", "role assignment", "allowlist membership"],
    tasks: tasks.length ? tasks : defaultProofTasks(useCase),
    output: {
      proofHash: "bytes32 memo-ready proof hash",
      reviewedAccount: "wallet or entity address reviewed by AI2Human",
      verdict: "approved | rejected | needs_review",
      reviewer: "AI2Human verifier or policy operator",
      evidenceUri: "off-chain proof bundle URI"
    },
    suggestedMemoUse:
      "Use mintWithMemo or transferWithMemo to attach proofHash to token operations when a proof-linked audit trail is needed.",
    optionalTaskTemplate: {
      routeTo: "AI2Human",
      intent: "create_b20_human_verification_task",
      requesterName: readString(input.requesterName) || "B20 issuer agent",
      requesterHandle: readString(input.requesterHandle) || "@ai2humannetwork",
      title: `Verify eligibility for ${token.symbol} B20 access`,
      blockedHumanStep:
        "A verifier must review eligibility evidence before the B20 role, allowlist, or mint permission is granted.",
      completionLoop: "agent request -> human or agent verification -> structured proof -> policy update -> token action"
    }
  };
}

function buildRoles(input, initialAdmin, variant) {
  const roles = readObject(input.roles);
  const minter = firstAddress(roles.minter, roles.mintRole, initialAdmin);
  const pauser = firstAddress(roles.pauser, roles.pauseRole, initialAdmin);
  const metadata = firstAddress(roles.metadata, roles.metadataRole, initialAdmin);
  const burner = firstAddress(roles.burner, roles.burnRole, initialAdmin);
  const compliance = firstAddress(roles.compliance, roles.complianceOfficer, initialAdmin);
  const config = [
    {
      role: "DEFAULT_ADMIN_ROLE",
      assignee: initialAdmin || ZERO_ADDRESS,
      reason: initialAdmin ? "Controls role grants, policy updates, and supply-cap changes." : "Admin-less launch requested."
    },
    { role: "MINT_ROLE", assignee: minter || "REQUESTER_REQUIRED", reason: "Required for mint and mintWithMemo." },
    { role: "BURN_ROLE", assignee: burner || "REQUESTER_REQUIRED", reason: "Required for caller-side burns." },
    {
      role: "BURN_BLOCKED_ROLE",
      assignee: compliance || "REQUESTER_REQUIRED",
      reason: "Required for burnBlocked when a policy-blocked account must be seized."
    },
    { role: "PAUSE_ROLE", assignee: pauser || "REQUESTER_REQUIRED", reason: "Required to pause transfer, mint, or burn features." },
    { role: "UNPAUSE_ROLE", assignee: pauser || "REQUESTER_REQUIRED", reason: "Required to unpause features." },
    { role: "METADATA_ROLE", assignee: metadata || "REQUESTER_REQUIRED", reason: "Required for name, symbol, contractURI, and metadata updates." }
  ];

  if (variant === "ASSET") {
    config.push({
      role: "OPERATOR_ROLE",
      assignee: firstAddress(roles.operator, roles.operatorRole, initialAdmin) || "REQUESTER_REQUIRED",
      reason: "Asset-only role for multiplier updates and announcements."
    });
  }

  return config;
}

function normalizePolicyMode(raw, fallbackType) {
  const text = readString(raw).toLowerCase();
  if (text.includes("allow")) return "ALLOWLIST";
  if (text.includes("block")) return "BLOCKLIST";
  return fallbackType;
}

function buildPolicies(input, useCase) {
  const policies = readObject(input.policies);
  const defaults =
    useCase === "rwa-community" || useCase === "local-stablecoin"
      ? {
          TRANSFER_SENDER_POLICY: "BLOCKLIST",
          TRANSFER_RECEIVER_POLICY: "ALLOWLIST",
          TRANSFER_EXECUTOR_POLICY: "BLOCKLIST",
          MINT_RECEIVER_POLICY: "ALLOWLIST"
        }
      : {
          TRANSFER_SENDER_POLICY: "BLOCKLIST",
          TRANSFER_RECEIVER_POLICY: "BLOCKLIST",
          TRANSFER_EXECUTOR_POLICY: "BLOCKLIST",
          MINT_RECEIVER_POLICY: "ALLOWLIST"
        };

  return B20_SCOPES.map((scope) => {
    const raw = readObject(policies[scope] || policies[scope.toLowerCase()] || {});
    const type = normalizePolicyMode(raw.type || raw.mode, defaults[scope]);
    const accounts = normalizeAddressList(raw.accounts || raw.members);
    return {
      scope,
      type,
      defaultBehavior:
        type === "ALLOWLIST"
          ? "Denied by default; verified accounts must be added before the scoped action works."
          : "Authorized by default; blocked accounts are denied.",
      policyId: raw.policyId != null ? String(raw.policyId) : "CREATE_OR_ATTACH_POLICY_ID",
      initialAccounts: accounts,
      proofInput:
        scope === "MINT_RECEIVER_POLICY" || type === "ALLOWLIST"
          ? "AI2Human proof should approve accounts before they are added."
          : "AI2Human proof can flag accounts before they are blocked.",
      validation: "Before updatePolicy, validate policyExists(policyId)."
    };
  });
}

function buildToken(input) {
  const tokenInput = readObject(input.token);
  const useCase = inferUseCase(input);
  const variant = normalizeVariant(tokenInput.variant || input.variant || (useCase === "local-stablecoin" ? "STABLECOIN" : "ASSET"));
  const symbol = normalizeSymbol(tokenInput.symbol || input.symbol || "A2HB20");
  const name = readString(tokenInput.name || input.name) || "AI2Human Verified B20";
  const decimals = normalizeDecimals(tokenInput.decimals || input.decimals, variant);
  const currency = variant === "STABLECOIN" ? normalizeSymbol(tokenInput.currency || input.currency || "USD") : undefined;

  return {
    variant,
    name,
    symbol,
    decimals,
    currency,
    supplyCap: normalizeSupply(tokenInput.maxSupply || tokenInput.supplyCap || input.maxSupply || input.supplyCap),
    initialAdmin: readString(tokenInput.initialAdmin || input.initialAdmin),
    useCase,
    contractURI: readString(tokenInput.contractURI || input.contractURI) || "REQUESTER_METADATA_URI",
    saltHint:
      readString(tokenInput.salt || input.salt) ||
      crypto.createHash("sha256").update(`${name}:${symbol}:${useCase}:${variant}`).digest("hex").slice(0, 16)
  };
}

function buildInitCallsPlan(token, roleConfig, policyConfig, proofRequirements) {
  const calls = [
    {
      call: "updateSupplyCap",
      purpose: `Set max supply to ${token.supplyCap}.`,
      gatedBy: "DEFAULT_ADMIN_ROLE"
    },
    {
      call: "updateContractURI",
      purpose: "Attach off-chain issuer metadata.",
      gatedBy: "METADATA_ROLE"
    },
    ...roleConfig
      .filter((item) => item.role !== "DEFAULT_ADMIN_ROLE")
      .map((item) => ({
        call: "grantRole",
        role: item.role,
        assignee: item.assignee,
        purpose: item.reason
      })),
    ...policyConfig.map((item) => ({
      call: "updatePolicy",
      scope: item.scope,
      policyId: item.policyId,
      purpose: `Attach ${item.type} policy to ${item.scope}.`
    }))
  ];

  if (proofRequirements.required) {
    calls.push({
      call: "mintWithMemo or policy membership update after proof approval",
      purpose: "Use AI2Human proofHash as memo or review anchor for proof-linked token actions.",
      memo: "bytes32 proofHash"
    });
  }

  return calls;
}

function buildMissingInputs(token, roleConfig, proofRequirements) {
  const missing = [];
  if (!token.name) missing.push("token.name");
  if (!token.symbol) missing.push("token.symbol");
  if (!isAddress(token.initialAdmin)) missing.push("token.initialAdmin");
  for (const role of roleConfig) {
    if (role.assignee === "REQUESTER_REQUIRED") missing.push(`roles.${role.role}`);
  }
  if (proofRequirements.required && proofRequirements.tasks.length === 0) missing.push("proof.tasks");
  if (token.variant === "STABLECOIN" && !token.currency) missing.push("token.currency");
  return [...new Set(missing)];
}

function buildQuestions(missingInputs) {
  const labels = {
    "token.initialAdmin": "What admin wallet should control B20 role grants, policy updates, and supply-cap changes?",
    "token.name": "What token name should the B20 token use?",
    "token.symbol": "What ticker symbol should the B20 token use?",
    "token.currency": "What fiat currency code should the stablecoin variant declare?"
  };
  return missingInputs.map((field) => ({
    field,
    question: labels[field] || `Please provide ${field}.`
  }));
}

export function buildB20AgentSkillPreview(input = {}) {
  const token = buildToken(input);
  const useCase = token.useCase;
  const initialAdmin = isAddress(token.initialAdmin) ? token.initialAdmin : "";
  const roleConfig = buildRoles(input, initialAdmin, token.variant);
  const policyConfig = buildPolicies(input, useCase);
  const proofRequirements = buildProofRequirements(input, token, useCase);
  const initCallsPlan = buildInitCallsPlan(token, roleConfig, policyConfig, proofRequirements);
  const missingInputs = buildMissingInputs(token, roleConfig, proofRequirements);
  const warnings = [
    "This endpoint generates a B20 configuration bundle only. It does not broadcast a transaction or custody keys.",
    "B20 deployment should use Base's B20Factory precompile and base-std after the Beryl upgrade is active.",
    "Validate policyExists(policyId) before writing any PolicyRegistry ID to a B20 scope.",
    "Every unattended B20 deployment defaults scopes to ALWAYS_ALLOW unless constrained in initCalls."
  ];

  if (token.variant === "STABLECOIN" && token.decimals !== 6) {
    warnings.push("Stablecoin variant forces 6 decimals.");
  }

  return {
    ok: missingInputs.length === 0,
    dryRun: true,
    intent: "create_b20_agent_skill_config",
    generatedAt: new Date().toISOString(),
    sourceDocs: [
      "https://docs.base.org/base-chain/specs/upgrades/beryl/b20",
      "https://github.com/base/base-std"
    ],
    chain: {
      network: "base",
      chainId: Number(input.chainId || DEFAULT_CHAIN_ID),
      activation: "Beryl / B20 feature must be active before deployment."
    },
    tokenConfig: {
      variant: token.variant,
      name: token.name,
      symbol: token.symbol,
      decimals: token.decimals,
      currency: token.currency,
      supplyCap: token.supplyCap,
      initialAdmin: token.initialAdmin || "REQUESTER_REQUIRED",
      contractURI: token.contractURI,
      saltHint: token.saltHint,
      factory: {
        method: "createB20(variant, salt, params, initCalls)",
        params: "ABI-encoded variant-specific create params with leading version byte.",
        addressDerivation: "[10-byte B20 prefix][1-byte variant][9-byte keccak256(deployer, salt)]"
      }
    },
    rolesConfig: roleConfig,
    policyConfig,
    proofRequirements,
    deploymentPlan: {
      initCallsPlan,
      checklist: [
        "Choose ASSET or STABLECOIN variant.",
        "Set initialAdmin or intentionally choose admin-less launch.",
        "Create or attach PolicyRegistry policies for allowlist/blocklist scopes.",
        "Grant MINT, PAUSE, UNPAUSE, METADATA, and compliance roles to real wallets.",
        "Set supply cap before issuer minting.",
        "Attach AI2Human proof requirements to mint eligibility, role assignment, or policy membership.",
        "Generate encoded params and initCalls with base-std / Base Foundry.",
        "Run simulation, then broadcast createB20 only after Beryl activation."
      ]
    },
    missingInputs,
    nextQuestions: buildQuestions(missingInputs),
    warnings,
    publicSummary:
      "B20 gives tokens native rules. AI2Human gives those rules verifiable proof inputs for eligibility, roles, policies, and monitored token actions."
  };
}
