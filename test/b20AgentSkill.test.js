import assert from "node:assert/strict";
import test from "node:test";
import { buildB20AgentSkillPreview } from "./b20AgentSkill.js";

test("builds a complete RWA B20 proof-to-policy bundle", () => {
  const preview = buildB20AgentSkillPreview({
    intent:
      "Create a B20 token for a verified RWA community. Max supply 1000000. Only verified members can mint.",
    token: {
      variant: "ASSET",
      name: "Verified RWA Community",
      symbol: "VRWA",
      maxSupply: "1000000",
      initialAdmin: "0x1111111111111111111111111111111111111111"
    },
    roles: {
      minter: "0x2222222222222222222222222222222222222222",
      pauser: "0x3333333333333333333333333333333333333333",
      metadata: "0x4444444444444444444444444444444444444444",
      compliance: "0x5555555555555555555555555555555555555555",
      operator: "0x6666666666666666666666666666666666666666"
    }
  });

  assert.equal(preview.ok, true);
  assert.equal(preview.tokenConfig.variant, "ASSET");
  assert.equal(preview.tokenConfig.supplyCap, "1000000");
  assert.equal(preview.policyConfig.length, 4);
  assert.equal(
    preview.policyConfig.find((policy) => policy.scope === "MINT_RECEIVER_POLICY")?.type,
    "ALLOWLIST"
  );
  assert.equal(preview.proofRequirements.provider, "AI2Human Network");
  assert.ok(preview.deploymentPlan.initCallsPlan.some((item) => item.call === "updatePolicy"));
});

test("asks for real role wallets when only an intent is supplied", () => {
  const preview = buildB20AgentSkillPreview({
    intent: "Create a B20 token for verified members with proof before mint."
  });

  assert.equal(preview.ok, false);
  assert.ok(preview.missingInputs.includes("token.initialAdmin"));
  assert.ok(preview.missingInputs.includes("roles.MINT_ROLE"));
});
