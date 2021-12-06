const hre = require('hardhat');
const fs = require('fs');
const path = require('path');
const FACTORY_ABI = require(path.resolve(__dirname, "../abi/contracts/Factory.sol/Factory.json"));
const FACTORY_JSON = require(path.resolve(__dirname, "../abi/Deployed.json"));
(async () => {
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
})();
