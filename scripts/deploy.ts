import hre from "hardhat";
import "@nomicfoundation/hardhat-ethers"; // ⬅️ this is required to augment hre
import { formatEther, parseUnits } from "ethers";
import * as dotenv from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { StakingConfig } from "./types";
import { parseBoolean } from "./utils/parseBoolean";
import { parseRewardTiers, parseDynamicRewardRate } from "./utils/parseRewards";
import { loadStakingConfigDefaults } from "./utils/parseConfig";

dotenv.config();

async function main() {
  // -- Load fallback defaults from schema-based config
  const configDefaults: StakingConfig = await loadStakingConfigDefaults();
  
  // -- CLI and ENV args with fallback to config defaults (except for rewards -- that happens in parseRewards.ts).
  const argv = yargs(hideBin(process.argv))
    .option("principalForfeitEnabled", {
      type: "boolean",
      default: parseBoolean(process.env.PRINCIPAL_FORFEIT_ENABLED, configDefaults.principalForfeitEnabled),
    })
    .option("principalForfeitPercentage", {
      type: "number",
      default: Number(process.env.PRINCIPAL_FORFEIT_PERCENTAGE || configDefaults.principalForfeitPercentage),
    })
    .option("rewardForfeitEnabled", {
      type: "boolean",
      default: parseBoolean(process.env.REWARD_FORFEIT_ENABLED, configDefaults.rewardForfeitEnabled),
    })
    .option("rewardForfeitPercentage", {
      type: "number",
      default: Number(process.env.REWARD_FORFEIT_PERCENTAGE || configDefaults.rewardForfeitPercentage),
    })
    .option("autoRewardAllowed", {
      type: "boolean",
      default: parseBoolean(process.env.AUTO_REWARD_ALLOWED, configDefaults.autoRewardAllowed),
    })
    .option("rewardModelType", {
      type: "number",
      default: Number(process.env.REWARD_MODEL_TYPE || configDefaults.rewardModelType),
    })
    .option("flatRewardRate", {
      type: "number",
      default: Number(process.env.FLAT_REWARD_RATE || configDefaults.flatRewardRate),
    })
    .option("rewardTiers", {
      type: "string",
      default: process.env.REWARD_TIERS,
      description: "JSON array of reward tiers (stringified)",
    })
    .option("dynamicRewardRate", {
      type: "string",
      default: process.env.DYNAMIC_REWARD_RATE,
      description: "JSON object for dynamic reward rate (stringified)",
    }).argv as any;

  const { ethers } = hre;
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const balance = await deployer.provider!.getBalance(deployer.address);
  console.log("Deployer Balance:", formatEther(balance), "ETH");

  // Deploy token
  const Token = await ethers.getContractFactory("ERC20Token");
  const totalSupply = parseUnits("1000000", 18); // 1M tokens
  const token = await Token.deploy("Staking Token", "STK", totalSupply);
  await token.deploymentTransaction()!.wait();
  console.log("Token deployed to:", token.target);

  // Build full config
  const config: StakingConfig = {
    principalForfeitEnabled: argv.principalForfeitEnabled,
    principalForfeitPercentage: argv.principalForfeitPercentage,
    rewardForfeitEnabled: argv.rewardForfeitEnabled,
    rewardForfeitPercentage: argv.rewardForfeitPercentage,
    autoRewardAllowed: argv.autoRewardAllowed,
    rewardModelType: argv.rewardModelType,
    flatRewardRate: argv.flatRewardRate,
    rewardTiers: await parseRewardTiers(argv.rewardTiers, configDefaults.rewardTiers),
    dynamicRewardRate: await parseDynamicRewardRate(argv.dynamicRewardRate, configDefaults.dynamicRewardRate),
  };

  // Deploy staking pool
  const StakingPool = await ethers.getContractFactory("StakingPool");
  const stakingPool = await StakingPool.deploy(
    token.target,                       // The token address to be staked
    config.rewardModelType,             // The selected reward model (FLAT, TIERED, DYNAMIC)
    config.rewardTiers,                 // Array of reward tiers
    config.principalForfeitEnabled,     // Flag to enable forfeiture of principal on early unstake
    config.principalForfeitPercentage,  // Percentage of forfeiture (if any)
    config.autoRewardAllowed,           // Flag to enable auto distribution of rewards
    config.flatRewardRate,              // Base reward rate (used in flat model)
    config.dynamicRewardRate,           // Dynamic reward rate settings
  );
  await stakingPool.deploymentTransaction()!.wait();
  console.log("StakingPool deployed to:", stakingPool.target);
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exit(1);
});
