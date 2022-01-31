/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('dotenv').config()
require('@nomiclabs/hardhat-waffle')
require('hardhat-abi-exporter');
require("hardhat-gas-reporter");
require('hardhat-contract-sizer');
require("@nomiclabs/hardhat-etherscan");
const fs = require('fs')
const path = require('path')
task("deploy", "deploys the contract", async (args, hre) => {
  const [deployer] = await hre.ethers.getSigners();
  let Factory = await hre.ethers.getContractFactory('Factory');
  let factory = await Factory.deploy();
  await factory.deployed();
  console.log("factory address", factory.address);
  await fs.promises.mkdir(path.resolve(__dirname, "./deployments"), { recursive: true }).catch((e) => {})
  await fs.promises.writeFile(path.resolve(__dirname, `./deployments/${hre.network.name}.json`), JSON.stringify({ address: factory.address }))
  return factory;
})
task("v", "verify on etherscan", async (args, hre) => {
  console.log("x")
  const FACTORY_ABI = require(path.resolve(__dirname, "./abi/contracts/Factory.sol/Factory.json"));
  const FACTORY_JSON = require(path.resolve(__dirname, `./deployments/${hre.network.name}.json`));
  let factoryAddress = FACTORY_JSON.address
  console.log("verify factory", factoryAddress)
  try {
    await hre.run("verify:verify", {
      address: factoryAddress
    });
  } catch (e) {
    console.log("already verified")
  }
  const [deployer] = await ethers.getSigners();
  let contract = new ethers.Contract(factoryAddress, FACTORY_ABI, deployer)
  let implementation = await contract.implementation()
  console.log("verify implementation", implementation)
  try {
    await hre.run("verify:verify", {
      address: implementation
    })
  } catch (e) {
    console.log("already verified")
  }
})
module.exports = {
//  solidity: "0.8.4",
  gasReporter: {
    currency: "USD",
//    gasPrice: 80,
//    gasPrice: 150,
    coinmarketcap: "abb5abcf-5b1f-443b-873f-3bc21d6019f7",
    enabled: true,
  },
  solidity: {
    version: "0.8.4",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000,
      },
    }
  },
  mocha: {
    timeout: 2000000000
  },
  networks: {
    hardhat: {
      chainId: 1337,
      timeout: 1000 * 60 * 60 * 24, // 1 day
      gas: 12000000,
      blockGasLimit: 0x1fffffffffffff,
      allowUnlimitedContractSize: true,
      //timeout: 1800000
    },
    rinkeby: {
      //gasPrice: 32000000000,
      //gasPrice: 133000000000,
      url: process.env.RINKEBY,
      timeout: 1000 * 60 * 60 * 24, // 1 day
      accounts: [process.env.RINKEBY_PRIVATE_KEY],
    },
    mainnet: {
      //gasPrice: 80000000000,
      //gasPrice: 96000000000,
      timeout: 1000 * 60 * 60 * 24, // 1 day
      url: process.env.MAINNET,
      accounts: [process.env.MAINNET_PRIVATE_KEY],
    }
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY
  }
};
