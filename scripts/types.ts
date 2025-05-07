import { z } from "zod";

// ---------- Zod Schemas ----------
export const rewardTierSchema = z.object({
  stakeDuration: z.string(),
  tierAPY: z.number(),
});

export const dynamicRewardRateSchema = z.object({
  period: z.string(),
  apyIncrementPerPeriod: z.number(),
});

export const stakingConfigInputSchema = z.object({
  principalForfeitEnabled: z.boolean(),
  principalForfeitPercentage: z.number(),
  rewardForfeitEnabled: z.boolean(),
  rewardForfeitPercentage: z.number(),
  autoRewardAllowed: z.boolean(),
  rewardModelType: z.number(),
  baseAnnualPercentageYield: z.number(),
  rewardTiers: z.array(rewardTierSchema),
  dynamicRewardRate: dynamicRewardRateSchema,
  scale: z.number(),
});

// ---------- Type Inference ----------
export type RewardTierInput = z.infer<typeof rewardTierSchema>;
export type DynamicRewardRateInput = z.infer<typeof dynamicRewardRateSchema>;
export type StakingConfigInput = z.infer<typeof stakingConfigInputSchema>;

// These are the parsed versions used at runtime (with durations in seconds)
export type RewardTier = {
  stakeDuration: number;
  tierAPY: number;
};

export type DynamicRewardRate = {
  period: number;
  apyIncrementPerPeriod: number;
};

export type StakingConfig = {
  principalForfeitEnabled: boolean;
  principalForfeitPercentage: number;
  rewardForfeitEnabled: boolean;
  rewardForfeitPercentage: number;
  autoRewardAllowed: boolean;
  rewardModelType: number;
  baseAnnualPercentageYield: number;
  rewardTiers: RewardTier[];
  dynamicRewardRate: DynamicRewardRate;
  scale: number;
};
