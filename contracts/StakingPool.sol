// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

enum RewardModelType {
    FLAT,   // Flat reward model (based on a constant rate)
    TIERED, // Tiered reward model (based on lock duration)
    DYNAMIC // Dynamic reward model (based on time and multiplier increase)
}

contract StakingPool {
    IERC20 public stakingToken;
    address public owner;

    uint256 public totalStaked;  // Total amount of tokens currently staked
    RewardModelType public rewardModelType;

    // Mapping to track each user's stake information (amount, start time, lock duration)
    mapping(address => StakeInfo) public stakeInfo;

    struct StakeInfo {
        uint256 amount;
        uint256 startTimestamp;
        uint256 lockDuration;
    }

    // Reward tier model (different lock durations with associated reward multipliers)
    struct RewardTier {
        uint256 lockDuration;  // Lock duration in seconds
        uint256 multiplier;    // Multiplier (e.g., 150 means 150% == 1.5x reward)
    }

    RewardTier[] public rewardTiers;

    // Forfeiture parameters for early unstaking
    bool public forfeitPrincipalOnEarlyUnstake; // Whether to forfeit principal if unstaked early
    uint256 public forfeitPrincipalPercent;     // Percent of principal forfeited (e.g., 100 means 1%)

    bool public autoDistributeRewards; // Flag to automatically distribute rewards when claimed
    uint256 public baseRewardRate;     // Base reward rate for rewards (e.g., 100 means 1%)

    // Dynamic reward rate struct for the dynamic model
    struct DynamicRewardRate {
        uint256 period;                        // Period in seconds for dynamic reward
        uint256 multiplierIncrementPercentage; // Percentage increment for each period
    }

    DynamicRewardRate public dynamicRewardRate; // Holds the dynamic reward rate parameters

    // Event declarations
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, bool early, uint256 forfeited);
    event RewardsClaimed(address indexed user, uint256 reward);

    constructor(
        IERC20 _stakingToken,
        RewardModelType _rewardModelType,
        RewardTier[] memory _rewardTiers,
        bool _forfeitPrincipalOnEarlyUnstake,
        uint256 _forfeitPercent,
        bool _autoDistributeRewards,
        uint256 _baseRewardRate,
        DynamicRewardRate memory _dynamicRewardRate
    ) {
        stakingToken = _stakingToken;
        owner = msg.sender;
        rewardModelType = _rewardModelType;

        // Set reward tiers if applicable
        for (uint256 i = 0; i < _rewardTiers.length; i++) {
            rewardTiers.push(_rewardTiers[i]);
        }

        // Set forfeiture behavior and percent
        forfeitPrincipalOnEarlyUnstake = _forfeitPrincipalOnEarlyUnstake;
        forfeitPrincipalPercent = _forfeitPercent;

        // Set auto-distribution flag and base reward rate
        autoDistributeRewards = _autoDistributeRewards;
        baseRewardRate = _baseRewardRate;

        // Set dynamic reward rate if applicable
        dynamicRewardRate = _dynamicRewardRate;
    }

    // Stake function where users lock their tokens for a specified duration
    function stake(uint256 amount, uint256 lockDuration) external {
        require(amount > 0, "Amount must be greater than zero");
        require(stakeInfo[msg.sender].amount == 0, "Already staked");

        // Store stake info for the user
        stakeInfo[msg.sender] = StakeInfo({
            amount: amount,
            startTimestamp: block.timestamp,
            lockDuration: lockDuration
        });

        totalStaked += amount;

        // Transfer staking tokens from user to the contract
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Emit Staked event
        emit Staked(msg.sender, amount, lockDuration);
    }

    // Unstake function for users to unlock their tokens and claim rewards if applicable
    function unstake() external {
        StakeInfo memory info = stakeInfo[msg.sender];
        require(info.amount > 0, "Nothing staked");

        bool early = block.timestamp < info.startTimestamp + info.lockDuration;
        uint256 forfeited = 0;
        uint256 amountToReturn = info.amount;

        // Apply forfeiture of principal if unstaked early
        if (early && forfeitPrincipalOnEarlyUnstake) {
            forfeited = (amountToReturn * forfeitPrincipalPercent) / 10000;
            amountToReturn -= forfeited;
        }

        totalStaked -= info.amount;
        delete stakeInfo[msg.sender];

        // Transfer remaining amount to the user
        require(stakingToken.transfer(msg.sender, amountToReturn), "Transfer failed");

        // Emit Unstaked event
        emit Unstaked(msg.sender, amountToReturn, early, forfeited);
    }

    // Reward calculation function based on selected reward model
    function calculateRewards(address user) public view returns (uint256) {
        StakeInfo memory info = stakeInfo[user];
        if (info.amount == 0) return 0;

        // Flat model reward calculation
        if (rewardModelType == RewardModelType.FLAT) {
            return (info.amount * baseRewardRate) / 10000;
        }

        // Tiered model: calculates multiplier based on lock duration
        else if (rewardModelType == RewardModelType.TIERED) {
            uint256 multiplier = getMultiplierForDuration(info.lockDuration);
            return (info.amount * baseRewardRate * multiplier) / 10000 / 100;
        }

        // Dynamic model: calculates reward based on time elapsed
        else if (rewardModelType == RewardModelType.DYNAMIC) {
            return calculateDynamicRewards(info);
        }

        return 0;
    }

    // Calculate dynamic rewards based on period and multiplier increment.
    function calculateDynamicRewards(
        StakeInfo memory info
    ) public view returns (uint256) {
        uint256 elapsedTime = block.timestamp - info.startTimestamp;
        uint256 periodsElapsed = elapsedTime / dynamicRewardRate.period;

        uint256 dynamicMultiplier = (100 + dynamicRewardRate.multiplierIncrementPercentage) ** periodsElapsed;
        return (info.amount * baseRewardRate * dynamicMultiplier) / 10000 / 100;
    }

    // Get the reward multiplier based on lock duration (tiered reward model).
    function getMultiplierForDuration(
        uint256 duration
    ) public view returns (uint256) {
        uint256 highestMultiplier = 100; // default = 1.0x

        // Iterate through reward tiers and find the highest applicable multiplier
        for (uint256 i = 0; i < rewardTiers.length; i++) {
            if (duration >= rewardTiers[i].lockDuration && rewardTiers[i].multiplier > highestMultiplier) {
                highestMultiplier = rewardTiers[i].multiplier;
            }
        }

        return highestMultiplier;
    }

    // Claim rewards with the option to restake the reward instead of claiming
    function claimRewards(bool restake) external {
        uint256 reward = calculateRewards(msg.sender);
        require(reward > 0, "No rewards");

        if (restake) {
            // Restake rewards (increase amount staked)
            stakeInfo[msg.sender].amount += reward;
            totalStaked += reward;
        } else {
            // Distribute rewards to the user
            require(autoDistributeRewards, "Auto-distribute disabled");
            require(stakingToken.transfer(msg.sender, reward), "Transfer failed");
        }

        // Emit RewardsClaimed event
        emit RewardsClaimed(msg.sender, reward);
    }
}
