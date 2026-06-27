import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbiParameters,
  toBytes,
  type Address,
  type Hex
} from "viem";

export const B20_FACTORY_ADDRESS = "0xB20f000000000000000000000000000000000000" as const;
export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const DEFAULT_CONTRACT_URI = "https://ai2human.work/agent/b20/manifest.json";

export const B20_VARIANT = {
  ASSET: 0,
  STABLECOIN: 1
} as const;

export const B20_ROLES = {
  DEFAULT_ADMIN_ROLE: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
  MINT_ROLE: keccak256(toBytes("MINT_ROLE")),
  BURN_ROLE: keccak256(toBytes("BURN_ROLE")),
  BURN_BLOCKED_ROLE: keccak256(toBytes("BURN_BLOCKED_ROLE")),
  PAUSE_ROLE: keccak256(toBytes("PAUSE_ROLE")),
  UNPAUSE_ROLE: keccak256(toBytes("UNPAUSE_ROLE")),
  METADATA_ROLE: keccak256(toBytes("METADATA_ROLE")),
  OPERATOR_ROLE: keccak256(toBytes("OPERATOR_ROLE"))
};

const ib20Abi = [
  {
    type: "function",
    name: "updateSupplyCap",
    stateMutability: "nonpayable",
    inputs: [{ name: "newSupplyCap", type: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "updateContractURI",
    stateMutability: "nonpayable",
    inputs: [{ name: "newURI", type: "string" }],
    outputs: []
  },
  {
    type: "function",
    name: "grantRole",
    stateMutability: "nonpayable",
    inputs: [
      { name: "role", type: "bytes32" },
      { name: "account", type: "address" }
    ],
    outputs: []
  },
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    outputs: []
  }
] as const;

export const b20FactoryAbi = [
  {
    type: "function",
    name: "createB20",
    stateMutability: "payable",
    inputs: [
      { name: "variant", type: "uint8" },
      { name: "salt", type: "bytes32" },
      { name: "params", type: "bytes" },
      { name: "initCalls", type: "bytes[]" }
    ],
    outputs: [{ name: "token", type: "address" }]
  },
  {
    type: "function",
    name: "getB20Address",
    stateMutability: "view",
    inputs: [
      { name: "variant", type: "uint8" },
      { name: "sender", type: "address" },
      { name: "salt", type: "bytes32" }
    ],
    outputs: [{ name: "token", type: "address" }]
  }
] as const;

export type B20DeployInput = {
  variant: "ASSET" | "STABLECOIN";
  name: string;
  symbol: string;
  admin: Address;
  decimals?: number;
  currency?: string;
  supplyCapTokens: number | string;
  contractUri?: string;
  saltText?: string;
  grantOperatorRole?: boolean;
};

export type B20DeployPlan = {
  variant: "ASSET" | "STABLECOIN";
  variantCode: number;
  name: string;
  symbol: string;
  admin: Address;
  decimals: number;
  currency?: string;
  supplyCapRaw: bigint;
  salt: Hex;
  saltText: string;
  params: Hex;
  initCalls: Hex[];
  contractUri: string;
  proofGateNote: string;
};

function normalizeSupplyCapTokens(value: number | string) {
  const numeric = Number(String(value).replace(/,/g, ""));
  if (!Number.isFinite(numeric) || numeric <= 0) return 1_000_000;
  return numeric;
}

export function encodeAssetCreateParams(name: string, symbol: string, initialAdmin: Address, decimals: number) {
  return encodeAbiParameters(
    parseAbiParameters("(uint8 version, string name, string symbol, address initialAdmin, uint8 decimals)"),
    [{ version: 1, name, symbol, initialAdmin, decimals }]
  );
}

export function encodeStablecoinCreateParams(
  name: string,
  symbol: string,
  initialAdmin: Address,
  currency: string
) {
  return encodeAbiParameters(
    parseAbiParameters("(uint8 version, string name, string symbol, address initialAdmin, string currency)"),
    [{ version: 1, name, symbol, initialAdmin, currency: currency.toUpperCase() }]
  );
}

export function encodeGrantRole(role: Hex, account: Address) {
  return encodeFunctionData({
    abi: ib20Abi,
    functionName: "grantRole",
    args: [role, account]
  });
}

export function encodeUpdateSupplyCap(newSupplyCap: bigint) {
  return encodeFunctionData({
    abi: ib20Abi,
    functionName: "updateSupplyCap",
    args: [newSupplyCap]
  });
}

export function encodeUpdateContractUri(newUri: string) {
  return encodeFunctionData({
    abi: ib20Abi,
    functionName: "updateContractURI",
    args: [newUri]
  });
}

export function encodeMint(to: Address, amount: bigint) {
  return encodeFunctionData({
    abi: ib20Abi,
    functionName: "mint",
    args: [to, amount]
  });
}

export function buildDeploySalt(seed?: string) {
  const saltText = seed?.trim() || `ai2human-b20-${Date.now()}`;
  return {
    saltText,
    salt: keccak256(toBytes(saltText))
  };
}

export function buildB20DeployPlan(input: B20DeployInput): B20DeployPlan {
  const variant = input.variant === "STABLECOIN" ? "STABLECOIN" : "ASSET";
  const variantCode = variant === "STABLECOIN" ? B20_VARIANT.STABLECOIN : B20_VARIANT.ASSET;
  const name = input.name.trim();
  const symbol = input.symbol.trim().toUpperCase();
  const admin = input.admin;
  const decimals = variant === "STABLECOIN" ? 6 : Math.max(6, Math.min(18, Number(input.decimals || 18)));
  const currency = (input.currency || "USD").trim().toUpperCase();
  const supplyCapTokens = normalizeSupplyCapTokens(input.supplyCapTokens);
  const supplyCapRaw = BigInt(supplyCapTokens) * BigInt(10) ** BigInt(decimals);
  const contractUri = input.contractUri?.trim() || DEFAULT_CONTRACT_URI;
  const { salt, saltText } = buildDeploySalt(input.saltText);

  if (!name) throw new Error("Token name is required.");
  if (!symbol) throw new Error("Token symbol is required.");

  const params =
    variant === "STABLECOIN"
      ? encodeStablecoinCreateParams(name, symbol, admin, currency)
      : encodeAssetCreateParams(name, symbol, admin, decimals);

  const initCalls: Hex[] = [
    encodeGrantRole(B20_ROLES.MINT_ROLE, admin),
    encodeGrantRole(B20_ROLES.BURN_ROLE, admin),
    encodeGrantRole(B20_ROLES.BURN_BLOCKED_ROLE, admin),
    encodeGrantRole(B20_ROLES.PAUSE_ROLE, admin),
    encodeGrantRole(B20_ROLES.UNPAUSE_ROLE, admin),
    encodeGrantRole(B20_ROLES.METADATA_ROLE, admin)
  ];

  if (variant === "ASSET" && input.grantOperatorRole !== false) {
    initCalls.push(encodeGrantRole(B20_ROLES.OPERATOR_ROLE, admin));
  }

  initCalls.push(encodeUpdateSupplyCap(supplyCapRaw));

  if (contractUri) {
    initCalls.push(encodeUpdateContractUri(contractUri));
  }

  return {
    variant,
    variantCode,
    name,
    symbol,
    admin,
    decimals,
    currency: variant === "STABLECOIN" ? currency : undefined,
    supplyCapRaw,
    salt,
    saltText,
    params,
    initCalls,
    contractUri,
    proofGateNote:
      "After deploy, route mint/allowlist eligibility through AI2Human proof tasks before updating B20 policies or minting to new wallets."
  };
}

export function encodeCreateB20Call(plan: B20DeployPlan) {
  return encodeFunctionData({
    abi: b20FactoryAbi,
    functionName: "createB20",
    args: [plan.variantCode, plan.salt, plan.params, plan.initCalls]
  });
}

export function buildExplorerAddressUrl(address: string, chainId = BASE_SEPOLIA_CHAIN_ID) {
  if (chainId === BASE_SEPOLIA_CHAIN_ID) {
    return `https://sepolia.basescan.org/address/${address}`;
  }
  return `https://basescan.org/address/${address}`;
}

export function buildExplorerTxUrl(txHash: string, chainId = BASE_SEPOLIA_CHAIN_ID) {
  if (chainId === BASE_SEPOLIA_CHAIN_ID) {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  }
  return `https://basescan.org/tx/${txHash}`;
}
