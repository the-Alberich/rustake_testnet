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

    /// @dev Scale factor for fixed-point APY values
    uint256 public immutable scale;

    /// @dev Seconds per year (approximate, ignores leap years)
    uint256 public constant SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

    uint256 public totalStaked;  // Total amount of tokens currently staked

    RewardModelType public rewardModelType;

    // Mapping to track each user's stake information
    mapping(address => StakeInfo) public stakeInfo;

    struct StakeInfo {
        uint256 principalAmount;
        uint256 startTimestamp;
        uint256 lockDuration;
        bool rewardsClaimed;
    }

    /// @notice Reward tier model: once `stakeDuration` has elapsed,
    ///         any stake will earn `tierAPY` (scaled by SCALE).
    struct RewardTier {
        uint256 stakeDuration;  // Duration in seconds to unlock this tier APY
        uint256 tierAPY;        // APY (scaled by SCALE) applied after duration
    }
    RewardTier[] public rewardTiers;

    // Forfeiture parameters for early unstaking
    bool public forfeitPrincipalOnEarlyUnstake;  // Whether to forfeit principal if unstaked early
    uint256 public forfeitPrincipalPercent;      // Percent of principal forfeited

    bool public autoDistributeRewards;         // Flag to automatically distribute rewards when claimed

    /// @notice Base Annual Percentage Yield, scaled by SCALE.
    ///         e.g. to represent 5.5%, pass 0.055 * SCALE.
    ///         so 0.055 * 10 ^ 18 => 0.055 * SCALE => (5.5%) [where SCALE is 1e18]
    uint256 public baseAnnualPercentageYield;

    /// @notice Dynamic reward rate: every `period` seconds,
    ///         APY increases by `apyIncrementPerPeriod` (scaled by SCALE).
    struct DynamicRewardRate {
        uint256 period;                 // Seconds between increments
        uint256 apyIncrementPerPeriod;  // APY increment, scaled by SCALE
    }
    DynamicRewardRate public dynamicRewardRate;

    // Event declarations
    event Staked(address indexed user, uint256 amount, uint256 lockDuration);
    event Unstaked(address indexed user, uint256 amount, bool early, uint256 forfeited);
    event RewardsClaimed(address indexed user, uint256 reward);

    constructor(
        IERC20 _stakingToken,
        uint256 _scale,
        RewardModelType _rewardModelType,
        RewardTier[] memory _rewardTiers,
        bool _forfeitPrincipalOnEarlyUnstake,
        uint256 _forfeitPercent,
        bool _autoDistributeRewards,
        uint256 _baseAnnualPercentageYield,
        DynamicRewardRate memory _dynamicRewardRate
    ) {
        stakingToken = _stakingToken;
        owner = msg.sender;

        scale = _scale;

        rewardModelType = _rewardModelType;

        // Set reward tiers if applicable.
        for (uint256 i = 0; i < _rewardTiers.length; i++) {
            rewardTiers.push(_rewardTiers[i]);
        }

        // Set forfeiture behavior and percent.
        forfeitPrincipalOnEarlyUnstake = _forfeitPrincipalOnEarlyUnstake;
        forfeitPrincipalPercent = _forfeitPercent;

        // Set auto-distribution flag and base reward rate.
        autoDistributeRewards = _autoDistributeRewards;
        baseAnnualPercentageYield = _baseAnnualPercentageYield;

        // Set dynamic reward rate if applicable.
        dynamicRewardRate = _dynamicRewardRate;
    }

    // Stake function where users lock their tokens for a specified duration.
    function stake(uint256 amount, uint256 lockDuration) external returns (
        address staker,
        bytes32 stakeId,
        uint256 stakedAmount,
        uint256 stakeTimestamp,
        uint256 lockEndTimestamp
    ) {
        require(amount > 0, "Staked amount must be > 0.");
        require(lockDuration > 0, "Stake lock duration must be > 0.");

        // In the future we can support multiple stakes per user, but for now just one at a time.
        require(stakeInfo[msg.sender].principalAmount == 0, "Already staked.");

        // Transfer the staking tokens to this contract.
        require(stakingToken.transferFrom(msg.sender, address(this), amount), "Transfer failed.");

        // Generate a unique stake ID.
        stakeId = keccak256(abi.encodePacked(msg.sender, amount, block.timestamp));
        stakeInfo[msg.sender] = StakeInfo({
            principalAmount: amount,
            startTimestamp: block.timestamp,
            lockDuration: lockDuration,
            rewardsClaimed: false
        });

        totalStaked += amount;
        emit Staked(msg.sender, amount, lockDuration);

        return (
            msg.sender,
            stakeId,
            amount,
            block.timestamp,
            block.timestamp + lockDuration
        );
    }

    // Unstake function for users to unlock their tokens and claim rewards if applicable.
    function unstake() external {
        StakeInfo memory info = stakeInfo[msg.sender];
        require(info.principalAmount > 0, "Nothing staked");

        (
            uint256 principalReturn,
            uint256 rewardReturn,
            uint256 principalForfeited,
            uint256 rewardForfeited
        ) = calculateTotalPayout(msg.sender, block.timestamp);

        uint256 totalReturn = 0;

        if (principalReturn > 0) {
            totalReturn += principalReturn;
        }

        // Add reward into return if enabled.
        if (rewardReturn > 0 && autoDistributeRewards) {
            totalReturn += rewardReturn;
        }

        // Transfer return.
        if (totalReturn > 0) {
            require(stakingToken.transfer(msg.sender, totalReturn), "Unstake transfer failed.");
            totalStaked -= info.principalAmount;
            delete stakeInfo[msg.sender];
        }

        emit Unstaked(
            msg.sender,
            principalReturn,
            block.timestamp < info.startTimestamp + info.lockDuration,
            principalForfeited + rewardForfeited
        );
    }

    /// @notice Calculates accrued reward (excluding principal) up to `currentTime`.
    function calculateRewards(StakeInfo memory info, uint256 currentTime) public view returns (uint256) {
        if (info.principalAmount == 0) return 0;

        uint256 principal = info.principalAmount;

        if (rewardModelType == RewardModelType.FLAT) {
            // rewardPerYear = principal * (baseAPY / 100) / scale
            // reward = rewardPerYear * elapsedSeconds / SECONDS_PER_YEAR
            uint256 rewardPerYear = principal * baseAnnualPercentageYield / 100 / scale;
            return (rewardPerYear * (currentTime - info.startTimestamp)) / SECONDS_PER_YEAR;
        }
        else if (rewardModelType == RewardModelType.TIERED) {
            uint256 elapsed = currentTime - info.startTimestamp;
            uint256 tierAPY = getTierAPYFromStakeTimeElapsed(elapsed);

            uint256 rewardPerYear = principal * tierAPY / 100 / scale;
            return (rewardPerYear * elapsed) / SECONDS_PER_YEAR;
        }
        else if (rewardModelType == RewardModelType.DYNAMIC) {
            uint256 elapsed      = currentTime - info.startTimestamp;
            uint256 periods      = elapsed / dynamicRewardRate.period;
            uint256 dynamicAPY   = baseAnnualPercentageYield +
                                   (dynamicRewardRate.apyIncrementPerPeriod * periods);
            uint256 rewardPerYear = principal * dynamicAPY / 100 / scale;
            return (rewardPerYear * elapsed) / SECONDS_PER_YEAR;
        }

        return 0;
    }

    // Calculate reward forfeiture (if early unstake).
    function calculateRewardForfeiture(address user, uint256 currentTime) public view returns (uint256) {
        StakeInfo memory info = stakeInfo[user];
        if (info.principalAmount <= 0) return 0;

        bool early = currentTime < info.startTimestamp + info.lockDuration;
        if (!early) return 0;

        return calculateRewards(info, currentTime);
    }

    // Calculate principal forfeiture (if early unstake).
    function calculatePrincipalForfeiture(address user, uint256 currentTime) public view returns (uint256) {
        StakeInfo memory info = stakeInfo[user];
        if (info.principalAmount <= 0) return 0;

        bool early = currentTime < info.startTimestamp + info.lockDuration;
        if (!early || !forfeitPrincipalOnEarlyUnstake) return 0;

        return (info.principalAmount * forfeitPrincipalPercent) / 100;
    }

    // Calculate full payout details at a given timestamp.
    function calculateTotalPayout(address user, uint256 currentTime)
        public
        view
        returns (
            uint256 principalReturn,
            uint256 rewardReturn,
            uint256 principalForfeited,
            uint256 rewardForfeited
        )
    {
        StakeInfo memory info = stakeInfo[user];
        if (info.principalAmount == 0) {
            return (0, 0, 0, 0);
        }

        principalForfeited = calculatePrincipalForfeiture(user, currentTime);
        principalReturn = info.principalAmount - principalForfeited;

        if (!info.rewardsClaimed) {
            uint256 reward = calculateRewards(info, currentTime);
            rewardForfeited = calculateRewardForfeiture(user, currentTime);
            rewardReturn = reward - rewardForfeited;
        } else {
            rewardForfeited = 0;
            rewardReturn = 0;
        }
    }

    // Get the reward percentage based on time staked (tiered reward model).
    // Assumes reward tiers should monotonically increase percentage over time,
    // but does not assume tiers are stored in chronological order.
    function getTierAPYFromStakeTimeElapsed(uint256 timeElapsed) public view returns (uint256) {
        if (rewardTiers.length == 0) return 0;

        // Iterate through reward tiers and find the highest applicable reward percentage.
        uint256 highestTierAPY = 0;
        for (uint256 i = 0; i < rewardTiers.length; i++) {
            RewardTier memory tier = rewardTiers[i];
            if (timeElapsed >= tier.stakeDuration && tier.tierAPY > highestTierAPY) {
                highestTierAPY = tier.tierAPY;
            }
        }

        return highestTierAPY;
    }

    // Claim rewards with the option to restake the reward instead of claiming.
    function claimRewards(bool restake) external {
        StakeInfo storage info = stakeInfo[msg.sender];
        require(!info.rewardsClaimed, "Rewards already claimed.");

        uint256 reward = calculateRewards(info, block.timestamp);
        require(reward > 0, "No rewards to claim.");

        if (restake) {
            // Create a new stake (not currently supported).
            revert("Restake disabled until multi-stake supported.");
        } else {
            // Distribute rewards to the user.
            require(stakingToken.transfer(msg.sender, reward), "Transfer failed.");
            info.rewardsClaimed = true;
        }

        // Emit RewardsClaimed event.
        emit RewardsClaimed(msg.sender, reward);
    }

    // Get status and details of user's current stake.
    function getStakeInfo(address user) external view returns (
        uint256 principalAmount,
        uint256 startTimestamp,
        uint256 lockDuration,
        bool rewardClaimed,
        uint256 rewardReturn,
        uint256 rewardForfeited,
        uint256 principalForfeited,
        RewardModelType rewardModel,
        uint256 baseAPY,
        DynamicRewardRate memory dynamicRate,
        RewardTier[] memory tiers
    ) {
        StakeInfo memory info = stakeInfo[user];

        principalAmount = info.principalAmount;
        startTimestamp = info.startTimestamp;
        lockDuration = info.lockDuration;
        rewardClaimed = info.rewardsClaimed;

        rewardReturn = calculateRewards(info, block.timestamp);
        rewardForfeited = calculateRewardForfeiture(user, block.timestamp);
        principalForfeited = calculatePrincipalForfeiture(user, block.timestamp);

        rewardModel = rewardModelType;
        baseAPY = baseAnnualPercentageYield;

        dynamicRate = dynamicRewardRate;

        tiers = new RewardTier[](rewardTiers.length);
        for (uint256 i = 0; i < rewardTiers.length; i++) {
            tiers[i] = rewardTiers[i];
        }
    }
}
