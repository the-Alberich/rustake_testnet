import { ethers } from "hardhat";
import { expect } from "chai";
import { ERC20Token, StakingPool } from "../typechain-types";

describe("StakingPool", function () {
  let stakingPool: StakingPool;
  let token: ERC20Token;
  let owner: any, addr1: any, addr2: any;

  const initialSupply = ethers.parseUnits("1000000", 18);
  const userStakeAmount = ethers.parseUnits("100", 18);
  const rewardPercent = 10;

  beforeEach(async () => {
    [owner, addr1, addr2] = await ethers.getSigners();

    // Deploy ERC20 token
    const Token = await ethers.getContractFactory("ERC20Token");
    token = await Token.deploy("Staking Token", "STK", initialSupply) as ERC20Token;
    await token.deploymentTransaction()!.wait();

    // Deploy staking pool
    const StakingPool = await ethers.getContractFactory("StakingPool");
    stakingPool = await StakingPool.deploy(token.target) as StakingPool;
    await stakingPool.deploymentTransaction()!.wait();

    // Distribute tokens to users
    await token.transfer(addr1.address, userStakeAmount);
    await token.transfer(addr2.address, userStakeAmount);
  });

  it("Should deploy and set the token address", async () => {
    expect(await stakingPool.stakingToken()).to.equal(token.target);
  });

  it("Should allow deposit of staking tokens", async () => {
    await token.connect(addr1).approve(stakingPool.target, userStakeAmount);
    await stakingPool.connect(addr1).deposit(userStakeAmount);

    const stake = await stakingPool.stakes(addr1.address);
    expect(stake).to.equal(userStakeAmount);

    const totalStaked = await stakingPool.totalStaked();
    expect(totalStaked).to.equal(userStakeAmount);
  });

  it("Should allow withdrawal of staked tokens", async () => {
    await token.connect(addr1).approve(stakingPool.target, userStakeAmount);
    await stakingPool.connect(addr1).deposit(userStakeAmount);

    await stakingPool.connect(addr1).withdraw(userStakeAmount / BigInt(2));
    const stake = await stakingPool.stakes(addr1.address);
    expect(stake).to.equal(userStakeAmount / BigInt(2));
  });

  it("Should calculate 10% rewards correctly", async () => {
    await token.connect(addr1).approve(stakingPool.target, userStakeAmount);
    await stakingPool.connect(addr1).deposit(userStakeAmount);

    const reward = await stakingPool.calculateRewards(addr1.address);
    const expected = userStakeAmount * BigInt(rewardPercent) / BigInt(100);
    expect(reward).to.equal(expected);
  });

  it("Should claim rewards and increase staked amount", async () => {
    await token.connect(addr1).approve(stakingPool.target, userStakeAmount * BigInt(2)); // enough for reward as well
    await stakingPool.connect(addr1).deposit(userStakeAmount);
  
    const expectedReward = await stakingPool.calculateRewards(addr1.address); // ✅ Capture before claiming
    await stakingPool.connect(addr1).claimRewards();
  
    const newStake = await stakingPool.stakes(addr1.address);
    const expectedStake = userStakeAmount + expectedReward;
  
    expect(newStake).to.equal(expectedStake);
    expect(expectedReward).to.equal(userStakeAmount * BigInt(rewardPercent) / BigInt(100));
  });
});
