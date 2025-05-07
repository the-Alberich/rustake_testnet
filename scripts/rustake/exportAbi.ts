import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const artifactPath =
  process.env.STAKING_POOL_ARTIFACT_PATH ??
  "./artifacts/contracts/StakingPool.sol/StakingPool.json";

const outputAbiPath =
  process.env.RUSTAKE_ABI_OUTPUT_PATH ??
  "../rustake/src/import/artifacts/contracts/staking_pool/abi.json";

function main() {
  const resolvedArtifactPath = path.resolve(artifactPath);
  const resolvedOutputPath = path.resolve(outputAbiPath);

  if (!fs.existsSync(resolvedArtifactPath)) {
    console.error("❌ Artifact not found at:", resolvedArtifactPath);
    process.exit(1);
  }

  const artifactContent = fs.readFileSync(resolvedArtifactPath, "utf-8");
  const artifactJson = JSON.parse(artifactContent);

  if (!artifactJson.abi) {
    console.error("❌ ABI field not found in the artifact.");
    process.exit(1);
  }

  const abi = artifactJson.abi;

  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(resolvedOutputPath, JSON.stringify(abi, null, 2));

  console.log("✅ ABI successfully exported to:", resolvedOutputPath);
}

main();
