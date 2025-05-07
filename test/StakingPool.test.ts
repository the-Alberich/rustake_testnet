import { ethers } from "hardhat";
import { Signer } from "ethers";
import { expect } from "chai";
import "@nomicfoundation/hardhat-chai-matchers";

import { ERC20Token, StakingPool } from "../typechain-types";

enum RewardModelType {
  FLAT,
  TIERED,
  DYNAMIC,
}

describe("StakingPool", function () {
  let stakingPool: StakingPool;
  let token: ERC20Token;
  let owner: Signer, addr1: Signer, addr2: Signer;
  let ownerAddress: string, addr1Address: string, addr2Address: string;

  const scale = 1e6;
  const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

  const initialSupply = ethers.parseUnits("1000000000", 18);
  const userStakeAmount = ethers.parseUnits("100", 18);
  const baseAnnualPercentageYield = BigInt(1.2 * scale); // 1.2%

  const rewardTiers = [
    { stakeDuration: 60 * 60 * 24 * 7, tierAPY: 0.5 * scale }, // 1 week
    { stakeDuration: 60 * 60 * 24 * 30, tierAPY: 1 * scale }, // 1 month
    { stakeDuration: 60 * 60 * 24 * 90, tierAPY: 2.1 * scale }, // 3 months
  ];

  const dynamicRewardRate = {
    period: 60 * 60 * 24 * 7, // 1 week
    apyIncrementPerPeriod: 2 * scale, // 2% per period
  };

  // Debug Logging
  async function debugLogStakingPool() {
    console.log(`\n=== Staking Pool Configuration ===`);

    const rewardModelTypeEnum = ["FLAT", "TIERED", "DYNAMIC"];

    const _rewardModelType = await stakingPool.rewardModelType();
    console.log(`Reward Model Type: ${rewardModelTypeEnum[Number(_rewardModelType)] ?? _rewardModelType}`);

    const _baseAnnualPercentageYield = await stakingPool.baseAnnualPercentageYield();
    console.log(`Base Reward Rate: ${_baseAnnualPercentageYield}%`);

    const _dynamicRewardRate = await stakingPool.dynamicRewardRate();
    console.log(`Dynamic Reward Rate:`);
    console.log(`  Period: ${_dynamicRewardRate.period} seconds`);
    console.log(`  Multiplier Increment: ${_dynamicRewardRate.apyIncrementPerPeriod}%`);

    // Try to log up to 10 reward tiers.
    // A bit convoluted in that it actually checks 11 tiers, but only prints 10.
    // However it's nice to know if there are more tiers not being printed.
    for (let i = 0; i < 11; i++) {
      try {
        const tier = await stakingPool.rewardTiers(i);
        if (i == 0)
          console.log(`Reward Tiers:  [`);
        if (i < 10)
          console.log(`  Tier ${i + 1}: Duration = ${tier.stakeDuration.toString()} sec, Reward = ${tier.tierAPY.toString()}%`);
        else
          console.log(`  ...`);
          console.log(`]`);
      } catch (err: any) {
        // Break if out-of-bounds
        if (err.message.includes("out-of-bounds") || err.message.includes("array index out of bounds")) {
          if (i == 0) console.log(`Reward Tiers:  []`);
          else console.log(`]`);
          break;
        } else throw err;
      }
    }

    const autoDistribute = await stakingPool.autoDistributeRewards();
    console.log(`Auto Distribute Rewards: ${autoDistribute}`);

    const forfeitPrincipal = await stakingPool.forfeitPrincipalOnEarlyUnstake();
    console.log(`Forfeit Principal on Early Unstake: ${forfeitPrincipal}`);

    const percentForfeit = await stakingPool.forfeitPrincipalPercent();
    console.log(`Principal Percent Forfeit on Early Unstake: ${percentForfeit.toString()}%`);

    console.log(`==================================\n`);
  }

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();
    ownerAddress = await owner.getAddress();
    addr1Address = await addr1.getAddress();
    addr2Address = await addr2.getAddress();

    // Deploy ERC20 token
    const Token = await ethers.getContractFactory("ERC20Token");
    token = await Token.deploy("Staking Token", "STK", initialSupply) as ERC20Token;
    await token.deploymentTransaction()!.wait();

    // Distribute tokens to users
    await token.transfer(addr1Address, userStakeAmount);
    await token.transfer(addr2Address, userStakeAmount);
  });

  async function deployStakingPool(
    model: RewardModelType,
    baseRate?: bigint,
    tiers: { stakeDuration: number; tierAPY: bigint }[] = [{ stakeDuration: 0, tierAPY: BigInt(0) }],
    dynamicConfig = { period: 0, apyIncrementPerPeriod: 0 }
  ): Promise<StakingPool> {
    const StakingPoolFactory = await ethers.getContractFactory("StakingPool");
    stakingPool = await StakingPoolFactory.deploy(
      token.target,
      scale,
      model,
      tiers,
      model === RewardModelType.DYNAMIC,
      model === RewardModelType.DYNAMIC ? dynamicConfig.period : 0,
      model !== RewardModelType.FLAT, // useTiers flag
      baseRate ?? 0,
      dynamicConfig
    ) as StakingPool;

    await stakingPool.deploymentTransaction()!.wait();

    // Prefund rewards
    const rewardBuffer = ethers.parseUnits("1000", 18);
    await token.transfer(stakingPool.target, rewardBuffer);

    return stakingPool;
  }

  async function stakeTokens(signer: Signer, amount: bigint, lockDuration: number) {
    const signerAddress = await signer.getAddress();
    await token.connect(signer).approve(stakingPool.target, amount);
    await stakingPool.connect(signer).stake(amount, lockDuration);
  }

  async function increaseTime(seconds: number) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
  }

  describe("FLAT Reward Model", function () {
    beforeEach(async () => {
      stakingPool = await deployStakingPool(RewardModelType.FLAT, baseAnnualPercentageYield);
    });

    describe("Deployment", function () {
      it("Should set the correct staking token address.", async () => {
        expect(await stakingPool.stakingToken()).to.equal(token.target);
      });

      it("Should set the correct reward model type.", async () => {
        expect(await stakingPool.rewardModelType()).to.equal(RewardModelType.FLAT);
      });
    });

    describe("Staking", function () {
      it("Should allow users to stake tokens.", async () => {
        const lockDuration = 60 * 60 * 24 * 30;
        await stakeTokens(addr1, userStakeAmount, lockDuration);

        const info = await stakingPool.stakeInfo(addr1Address);
        expect(info.principalAmount).to.equal(userStakeAmount);
        expect(info.lockDuration).to.equal(lockDuration);
      });

      it("Should not allow staking zero amount.", async () => {
        const lockDuration = 60 * 60 * 24 * 30;
        await expect(
          stakingPool.connect(addr1).stake(0, lockDuration)
        ).to.be.revertedWith("Staked amount must be > 0.");
      });

      it("Should not allow staking with zero lock duration.", async () => {
        await expect(
          stakingPool.connect(addr1).stake(userStakeAmount, 0)
        ).to.be.revertedWith("Stake lock duration must be > 0.");
      });

      it("Should not allow multiple stakes from the same user.", async () => {
        const lockDuration = 60 * 60 * 24 * 30;
        await stakeTokens(addr1, userStakeAmount, lockDuration);
        await expect(
          stakingPool.connect(addr1).stake(userStakeAmount, lockDuration)
        ).to.be.revertedWith("Already staked.");
      });
    });

    describe("Unstaking", function () {
      it("Should allow users to unstake after lock duration.", async () => {
        const lockDuration = 60 * 60 * 24 * 30;
        await stakeTokens(addr1, userStakeAmount, lockDuration);
        await increaseTime(lockDuration + 1);

        await stakingPool.connect(addr1).unstake();

        const info = await stakingPool.stakeInfo(addr1Address);
        expect(info.principalAmount).to.equal(0);
      });

      it("Should not allow unstaking if nothing is staked.", async () => {
        await expect(
          stakingPool.connect(addr1).unstake()
        ).to.be.revertedWith("Nothing staked");
      });
    });

    describe("Rewards", function () {
      it("Should calculate flat rewards correctly.", async () => {
        const lockDuration = 60 * 60 * 24 * 30;
        await stakeTokens(addr1, userStakeAmount, lockDuration);
        const timestamp = (await ethers.provider.getBlock("latest"))!.timestamp

        const rawInfo = await stakingPool.stakeInfo(addr1Address);
        const info = {
          principalAmount: rawInfo.principalAmount,
          startTimestamp: rawInfo.startTimestamp,
          lockDuration: rawInfo.lockDuration,
          rewardsClaimed: rawInfo.rewardsClaimed
        };

        const reward = await stakingPool.calculateRewards(info, timestamp);
        const expectedRewardPerYear = (userStakeAmount * baseAnnualPercentageYield) / BigInt(100 * scale);
        const expectedReward = (expectedRewardPerYear * (BigInt(timestamp) - rawInfo.startTimestamp)) / BigInt(SECONDS_PER_YEAR);

        expect(reward).to.equal(expectedReward);
      });

      it("Should allow users to claim rewards once.", async () => {
        const lockDuration = 60 * 60 * 24 * 30;
        await stakeTokens(addr1, userStakeAmount, lockDuration);
        await increaseTime(lockDuration + 1);

        const rawInfo = await stakingPool.stakeInfo(addr1Address);

        const initialBalance = await token.balanceOf(addr1Address);
        const tx = await stakingPool.connect(addr1).claimRewards(false);
        const receipt = await tx.wait();
        const timestamp = (await ethers.provider.getBlock(receipt!.blockNumber))!.timestamp

        const finalBalance = await token.balanceOf(addr1Address);

        const expectedRewardPerYear = (userStakeAmount * BigInt(baseAnnualPercentageYield)) / BigInt(100 * scale);
        const expectedReward = (expectedRewardPerYear * (BigInt(timestamp) - rawInfo.startTimestamp)) / BigInt(SECONDS_PER_YEAR);

        expect(finalBalance - initialBalance).to.equal(BigInt(expectedReward));

        await expect(
          stakingPool.connect(addr1).claimRewards(false)
        ).to.be.revertedWith("Rewards already claimed.");
      });
    });
  });

  // Placeholder for future reward models
  // describe("TIERED Reward Model", ...)
  // describe("DYNAMIC Reward Model", ...)
});
