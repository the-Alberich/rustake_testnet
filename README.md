# rustake_testnet

Built with 💙 by a full-stack engineer learning in public.


This repository contains the local Ethereum testnet setup for the [`rustake`](https://github.com/the-Alberich/rustake) project. It uses [Hardhat](https://hardhat.org/) to spin up a local blockchain environment and deploy the `StakingPool` smart contract, allowing devs to test staking, unstaking, and rewards interactions against a real Ethereum-like network.


## 📦 Features

- Hardhat local testnet with pre-funded accounts
- Deployment script for the `StakingPool` smart contract
- Auto-generates ABI and address artifacts for easy integration
- Ideal for pairing with [`rustake`](https://github.com/the-Alberich/rustake), the Axum-based Rust backend, or set up your own service and use the testnet to explore smart contracts!


## 🚀 Getting Started

### 1. Clone the Repository

```bash / zsh
git clone https://github.com/the-Alberich/rustake_testnet.git
cd rustake_testnet
```

### 2. Install Dependencies

```bash / zsh
npm install
```

### 3. Start the Local Testnet

```bash / zsh
npx hardhat node
```
This will launch a local Ethereum testnet on `http://localhost:8545` with 20 funded accounts. You can view the private keys in the terminal output—these are useful for testing transactions through the backend.

### 4. Deploy the Contract

In a separate terminal:

```bash / zsh
npx hardhat run scripts/deploy.ts --network localhost
```
This will deploy the `StakingPool` contract and print the deployed contract address to the console.


## 🧰 Directory Structure

```dir
.
├── contracts/
│   └── StakingPool.sol        # Core staking contract
├── scripts/
│   └── deploy.ts              # Script to deploy the contract to localnet
├── artifacts/                 # Generated ABI and bytecode
├── hardhat.config.ts          # Project configuration
└── README.md
```


## 🔁 Integration with rustake

Once deployed, copy the `artifacts/contracts/StakingPool.sol/StakingPool.json` ABI file into the `rustake` backend:

```bash / zsh
cp artifacts/contracts/StakingPool.sol/StakingPool.json ../rustake/src/import/artifacts/contracts/StakingPool.sol/
```

Then, update your .env in rustake:

```bash / zsh
ETH_PROVIDER_URL=http://localhost:8545
DEFAULT_SIGNER_KEY=<one of the private keys from Hardhat node output>
CONTRACT_ADDRESS=<contract address from deploy.ts script output>
```


## 🛠️ Requirements

- Node.js >= 18.x
- Hardhat
- TypeScript

Install Hardhat globally (optional):

```bash / zsh
npm install -g hardhat
```


## 🧪 Testing Tips

Use Postman or `curl` to hit endpoints in the `rustake` backend.
    - stake / unstake / get rewards handlers are implemented there and can be used to validate the smart contract is working as expected once the testnet and `rustake` backend are successfully deployed.

Use Hardhat's pre-funded accounts for signing transactions.
    - import via `rustake` .env file or CLI options when starting up `rustake` backend.

The `StakingPool` contract includes:
    - stake(uint256 amount, uint256 lockDuration)
    - unstake()
    - calculateRewards(address) view returns (uint256)


## 📝 License

MIT


## 🤝 Related Projects

[`rustake`](https://github.com/the-Alberich/rustake): Rust/Axum backend API for staking


## 🙌 Contributions

Contributions, ideas, and issues are welcome!
