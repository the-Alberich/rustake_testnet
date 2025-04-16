import { z } from "zod";

// ---------- Zod Schemas ----------
export const rewardTierSchema = z.object({
  lockDuration: z.string(),
  multiplier: z.number(),
});

export const dynamicRewardRateSchema = z.object({
  period: z.string(),
  multiplierIncrementPercentage: z.number(),
});

export const stakingConfigInputSchema = z.object({
  principalForfeitEnabled: z.boolean(),
  principalForfeitPercentage: z.number(),
  rewardForfeitEnabled: z.boolean(),
  rewardForfeitPercentage: z.number(),
  autoRewardAllowed: z.boolean(),
  rewardModelType: z.number(),
  flatRewardRate: z.number(),
  rewardTiers: z.array(rewardTierSchema),
  dynamicRewardRate: dynamicRewardRateSchema,
});

// ---------- Type Inference ----------
export type RewardTierInput = z.infer<typeof rewardTierSchema>;
export type DynamicRewardRateInput = z.infer<typeof dynamicRewardRateSchema>;
export type StakingConfigInput = z.infer<typeof stakingConfigInputSchema>;

// These are the parsed versions used at runtime (with durations in seconds)
export type RewardTier = {
  lockDuration: number;
  multiplier: number;
};

export type DynamicRewardRate = {
  period: number;
  multiplierIncrementPercentage: number;
};

export type StakingConfig = {
  principalForfeitEnabled: boolean;
  principalForfeitPercentage: number;
  rewardForfeitEnabled: boolean;
  rewardForfeitPercentage: number;
  autoRewardAllowed: boolean;
  rewardModelType: number;
  flatRewardRate: number;
  rewardTiers: RewardTier[];
  dynamicRewardRate: DynamicRewardRate;
};
