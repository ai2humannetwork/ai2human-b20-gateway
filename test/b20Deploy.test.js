import test from "node:test";
import assert from "node:assert/strict";
import {
  B20_FACTORY_ADDRESS,
  B20_VARIANT,
  buildB20DeployPlan,
  buildDeploySalt,
  encodeAssetCreateParams,
  encodeCreateB20Call,
  encodeGrantRole,
  B20_ROLES
} from "./b20Deploy.ts";

test("builds an asset deploy plan with role grants and supply cap", () => {
  const plan = buildB20DeployPlan({
    variant: "ASSET",
    name: "Verified RWA Community",
    symbol: "VRWA",
    admin: "0x1111111111111111111111111111111111111111",
    decimals: 18,
    supplyCapTokens: 1_000_000,
    saltText: "test-salt"
  });

  assert.equal(plan.variant, "ASSET");
  assert.equal(plan.symbol, "VRWA");
  assert.equal(plan.decimals, 18);
  assert.equal(plan.initCalls.length, 9);
  assert.match(plan.params, /^0x/);
  assert.match(plan.salt, /^0x/);
});

test("encodeCreateB20Call targets the B20 factory", () => {
  const plan = buildB20DeployPlan({
    variant: "ASSET",
    name: "AI2Human Verified Proof Token",
    symbol: "A2HP",
    admin: "0x31C849603440483Cdf63100586703A5EB19Fa3Ed",
    supplyCapTokens: 1_000_000,
    saltText: "ai2human-b20-base-sepolia-v1"
  });
  const data = encodeCreateB20Call(plan);
  assert.match(data, /^0x/);
  assert.equal(plan.variantCode, B20_VARIANT.ASSET);
  assert.equal(B20_FACTORY_ADDRESS.toLowerCase(), "0xb20f000000000000000000000000000000000000");
});

test("encodeGrantRole uses canonical role hash", () => {
  const call = encodeGrantRole(B20_ROLES.MINT_ROLE, "0x1111111111111111111111111111111111111111");
  assert.match(call, /^0x/);
});

test("buildDeploySalt is deterministic for the same seed", () => {
  const a = buildDeploySalt("same-seed");
  const b = buildDeploySalt("same-seed");
  assert.equal(a.salt, b.salt);
});

test("encodeAssetCreateParams returns canonical bytes", () => {
  const params = encodeAssetCreateParams(
    "My Token",
    "MYT",
    "0x1111111111111111111111111111111111111111",
    18
  );
  assert.match(params, /^0x[a-f0-9]+$/i);
  assert.equal((params.length - 2) / 2, 320);
  assert.equal(params.slice(2, 66), "0000000000000000000000000000000000000000000000000000000000000020");
});
