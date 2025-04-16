import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
// import chokidar from "chokidar";

// // Custom chokidar options
// const chokidarOptions = {
//   usePolling: true,         // Use polling instead of native file system events
//   interval: 1000,           // Polling interval in ms
//   binaryInterval: 1000,     // Polling interval for binary files
// };

const config: HardhatUserConfig = {
  solidity: "0.8.28", // Specify desired Solidity version
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545", // Default URL for Hardhat node
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  // watch: {
  //   enable: true,
  //   chokidarOptions: chokidarOptions, // Pass custom chokidar options
  // },
};

export default config;
