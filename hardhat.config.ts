import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-toolbox";
import { execSync } from "child_process";
import path from "path";


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
};

task("compile", "Compiles the entire project and exports ABI")
  .setAction(async (args, hre, runSuper) => {
    await runSuper(args);

    // const zodScript = path.resolve(__dirname, "scripts/generateZodFromTypechain.ts");
    // try {
    //   console.log("📦 Generating Zod schemas...");
    //   execSync(`npx ts-node ${zodScript}`, { stdio: "inherit" });
    // } catch (err) {
    //   console.error("❌ Failed to generate Zod schemas: " + err.toString());
    // }

    const rustakeExportPath = path.resolve(__dirname, "scripts/rustake/exportAbi.ts");
    try {
      console.log("📤 Exporting ABI to RUSTAKE...");
      execSync(`npx ts-node ${rustakeExportPath}`, { stdio: "inherit" });
    } catch (err) {
      console.error("❌ Failed to export ABI to RUSTAKE: " + err.toString());
    }
  });

export default config;
