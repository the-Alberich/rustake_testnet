# hardhat-testnet: Future Enhancements & TODOs

This document outlines tasks, enhancements, and stretch goals for the `hardhat-testnet` project. These items are intended to improve the developer experience, contract interface workflows, and test coverage as the project scales.

## ✅ Completed
- [x] Hardhat project initialization (`npx hardhat`)
- [x] Basic `StakingPool.sol` contract with:
  - [x] `stake(uint256 amount, uint256 lockDuration)`
  - [x] `unstake()`
  - [x] `claimRewards()`
  - [x] `getStakeInfo()` view method
- [x] Compile and deploy contract to local Hardhat network
- [x] Script to export ABI artifact to shared path
  - [x] Export compiled ABI for Rustake integration
- [x] Simple deploy script
- [x] Basic Unit Test framework for `StakingPool`
- [x] Confirm compatibility with `ethers-rs` provider (via Rustake integration test)
- [x] Auto-export ABI to Rustake folder (enhanced UX)

## 🚧 In Progress
- [ ] Improve test coverage for `StakingPool`
- [ ] Add comments and NatSpec-style docstrings to `StakingPool.sol`
- [ ] Track and return stake info per user (initial groundwork)

## 🧭 Planned

### 🧾 Solidity Contract Enhancements
- [ ] Support multiple concurrent stakes per address
  - [ ] Define stake struct with lock duration and amount
  - [ ] Track stake entries in array or mapping
  - [ ] Aggregate rewards based on stake-specific terms
- [ ] Add `previewReward()` method for off-chain simulation
- [ ] Add `withdraw()` method that combines reward claim and unstake
- [ ] Add `adminWithdraw()` for emergency use (configurable access control)
- [ ] Add `updateReward()` modifier or internal call hook to centralize reward logic
- [ ] APY scaling overflow safety

### 🔧 Development Experience & Tooling
- [ ] Auto-run ABI export after `npx hardhat compile` (based on env var setting)
- [ ] Auto-format contract and test files with Prettier/Hardhat plugin
- [ ] Include default `.env` and network config for dev onboarding
- [ ] Add gas reporter and coverage tools
- [ ] Explore integration with TypeChain for TS/JS typed bindings

### 📊 Testing Enhancements
- [ ] Add unit tests for edge cases (e.g., stake 0, invalid durations)
- [ ] Add integration test simulating a full lifecycle (stake → time travel → reward → unstake)
- [ ] Add test scenarios for multiple stakers
- [ ] Validate reward math against expected formula (parameterized tests)

## 💡 Nice-to-Have Ideas
- [ ] Add optional front-running protection (e.g., lock/unlock timestamps)
- [ ] Time travel helper in tests (e.g., custom wrapper for `evm_increaseTime`)
- [ ] Add local faucet for testing ETH balance
- [ ] Add configurable initial parameters (reward rate, lock durations, etc.)
- [ ] Optional upgradeability (proxy pattern) for future-proofing

## ✨ Project Polish / Community
- [ ] Add README with deploy/test instructions and project purpose
- [ ] Document ABI export flow for Rustake consumers
- [ ] Add `CONTRIBUTING.md` for developer guidance
- [ ] Add GitHub repo metadata, topics, and license badge
- [ ] Consider publishing ABI export script as an NPM utility

---

This list is a living document and will be updated as the testnet evolves.
