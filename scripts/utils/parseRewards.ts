import { DynamicRewardRate, RewardTier } from "../types";
import { inferDuration } from "./parseTime";

// -- Parse Reward Tiers from CLI/ENV string (or fallback to configDefaults)
export async function parseRewardTiers(
  scale: number,
  input?: string,
  defaultRewardTiers?: RewardTier[],
): Promise<RewardTier[]> {
  if (input) {
    try {
      const parsed = JSON.parse(input);
      const tiers: RewardTier[] = [];

      for (const tier of parsed) {
        const duration = await inferDuration(tier.stakeDuration);
        tiers.push({
          stakeDuration: duration,
          tierAPY: tier.tierAPY * scale,
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
  scale: number,
  input?: string,
  defaultDynamicRewardRate?: DynamicRewardRate
): Promise<DynamicRewardRate> {
  if (input) {
    try {
      const parsed = JSON.parse(input);
      const duration = await inferDuration(parsed.period);

      return {
        period: duration,
        apyIncrementPerPeriod: parsed.apyIncrementPerPeriod * scale,
      };
    } catch (err: any) {
      throw new Error(
        `Failed to parse dynamicRewardRate from CLI or ENV: ${err.message || err}`
      );
    }
  }

  return defaultDynamicRewardRate || { period: -1, apyIncrementPerPeriod: 0 };
}
