import fs from "fs";
import path from "path";

import { stakingConfigInputSchema, StakingConfigInput, StakingConfig } from "../types";
import { inferDuration } from "./parseTime";

// -- Read raw staking config defaults from JSON.
function loadRawStakingConfig(): StakingConfigInput {
  const configPath = path.resolve(__dirname, "../_staking-config-defaults.json");

  if (!fs.existsSync(configPath)) {
    throw new Error("File '_staking-config-defaults.json' not found.");
  }

  const rawData = fs.readFileSync(configPath, "utf-8");
  const parsed = JSON.parse(rawData);
  return stakingConfigInputSchema.parse(parsed);
}

// -- Parse and enrich raw config with durations converted to seconds.
export async function loadStakingConfigDefaults(): Promise<StakingConfig> {
  const raw = loadRawStakingConfig();

  const rewardTiers = await Promise.all(
    raw.rewardTiers.map(async (tier) => ({
      lockDuration: await inferDuration(tier.lockDuration),
      multiplier: tier.multiplier,
    }))
  );

  const dynamicRewardRate = {
    period: await inferDuration(raw.dynamicRewardRate.period),
    multiplierIncrementPercentage:
      raw.dynamicRewardRate.multiplierIncrementPercentage,
  };

  return {
    ...raw,
    rewardTiers,
    dynamicRewardRate,
  };
}
