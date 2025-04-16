import { DynamicRewardRate, RewardTier } from "../types";
import { inferDuration } from "./parseTime";

// -- Parse Reward Tiers from CLI/ENV string (or fallback to configDefaults)
export async function parseRewardTiers(
    input?: string,
    defaultRewardTiers?: RewardTier[]
): Promise<RewardTier[]> {
  if (input) {
    try {
      const parsed = JSON.parse(input);
      const tiers: RewardTier[] = [];

      for (const tier of parsed) {
        const duration = await inferDuration(tier.lockDuration);
        tiers.push({
          lockDuration: duration,
          multiplier: tier.multiplier,
        });
      }

      return tiers;
    } catch (err: any) {
      throw new Error(
        `Failed to parse rewardTiers from CLI or ENV: ${err.message || err}`
      );
    }
  }

  return defaultRewardTiers || [];
}

// -- Parse Dynamic Reward Rate from CLI/ENV string (or fallback to configDefaults)
export async function parseDynamicRewardRate(
  input?: string,
  defaultDynamicRewardRate?: DynamicRewardRate
): Promise<DynamicRewardRate> {
  if (input) {
    try {
      const parsed = JSON.parse(input);
      const duration = await inferDuration(parsed.period);

      return {
        period: duration,
        multiplierIncrementPercentage: parsed.multiplierIncrementPercentage,
      };
    } catch (err: any) {
      throw new Error(
        `Failed to parse dynamicRewardRate from CLI or ENV: ${err.message || err}`
      );
    }
  }

//   const configDefaults: StakingConfig = await loadStakingConfigDefaults();
  return defaultDynamicRewardRate || { period: -1, multiplierIncrementPercentage: 100 };
}
