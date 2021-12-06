const fs = require('fs');
const path = require('path');
const { ethers } = require('hardhat');
const all = ethers.utils.formatBytes32String("")
const globalLogs = async (factoryAddress) => {
  console.log("factory address", factoryAddress)
  let ABI = require(path.resolve(__dirname, "../abi/contracts/Factory.sol/Factory.json"))
  console.log("FactoryABI", ABI);
  let interface = new ethers.utils.Interface(ABI)
  let events = await ethers.provider.getLogs({
    fromBlock: 0,
    toBlock: 'latest',
    address: factoryAddress,
  }).then((events) => {
    console.log("EVENTS", events)
    return events.map((e) => {
      return interface.parseLog(e).args
    })
  })
  return events;
}
const deploy = async () => {
  const [deployer] = await ethers.getSigners();
  let Factory = await ethers.getContractFactory('Factory');
  let factory = await Factory.deploy()
  await factory.deployed();
  console.log("factory address", factory.address);
  await fs.promises.mkdir(path.resolve(__dirname, "../abi"), { recursive: true }).catch((e) => {})
  await fs.promises.writeFile(path.resolve(__dirname, "../abi/Deployed.json"), JSON.stringify({ address: factory.address }))
  return factory;
}
(async () => {
  let factory = await deploy();
  process.exit(0)
})();
