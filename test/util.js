const { CID } = require('multiformats/cid');
const crypto = require('crypto')
const fs = require('fs');
const path = require('path')
const { ethers } = require('hardhat');
class Util {
  all = ethers.utils.formatBytes32String("")
  _cid = "0x" + this.toHexString(CID.parse('bafybeifpcgydc47j67wv7chqzbi56sbnee72kenmn5si66wpkqnghxsbx4').toJSON().hash).slice(4);
  toHexString (bytes) {
    return bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
  }
  async deploy (price) {
    const [_deployer, u1, u2] = await ethers.getSigners();
    this.alice = u1;
    this.bob = u2;
    this.deployer = _deployer;
    let Factory = await ethers.getContractFactory('Factory');
    this.factory = await Factory.deploy()
    await this.factory.deployed();
    await fs.promises.mkdir(path.resolve(__dirname, "../abi"), { recursive: true }).catch((e) => {})
    await fs.promises.writeFile(path.resolve(__dirname, "../abi/Deployed.json"), JSON.stringify({ address: this.factory.address }))
    let signers = await ethers.getSigners();
    this.signers = signers
    this.addresses = signers.map((s) => {
      return s.address
    })
  }
  getFactory (signer) {
    let ABI = require(path.resolve(__dirname, "../abi/contracts/Factory.sol/Factory.json"))
    let contract = new ethers.Contract(this.factory.address, ABI, signer)
    return contract;
  }
  getToken (signer) {
    let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
    let contract = new ethers.Contract(this.token.address, ABI, signer)
    return contract;
  }
  async collections (address) {
    let ABI = require(path.resolve(__dirname, "../abi/contracts/Factory.sol/Factory.json"))
    let _interface = new ethers.utils.Interface(ABI)
    let filter = this.factory.filters.CollectionAdded(null, address)
    filter.fromBlock = 0
    filter.toBlock = 'latest'
    let events = await ethers.provider.getLogs(filter).then((events) => {
      return events.map((e) => {
        return _interface.parseLog(e).args.collection
      })
    })
    return events;
  }
  async clone (address, name, symbol, config, val) {
    if (val) {
      let tx = await this.factory.genesis(address, name, symbol, config, val)
      await tx.wait()
    } else {
      let tx = await this.factory.genesis(address, name, symbol, config)
      await tx.wait()
    }

    let addr = await this.collections(address);

    let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
    this.signer = ethers.provider.getSigner()
    this.token = new ethers.Contract(addr[0], ABI, this.signer)
  }
  async mintedLogs () {
    let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
    let _interface = new ethers.utils.Interface(ABI)
    let events = await ethers.provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: this.token.address
    }).then((events) => {
      return events.map((e) => {
        return _interface.parseLog(e)//.args
      })
    })
    events = events.filter((log) => {
      return log.name == "Transfer" && log.args.from === "0x0000000000000000000000000000000000000000"
    })
    return events;
  }
  async globalLogs () {
    let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
    let _interface = new ethers.utils.Interface(ABI)
    let events = await ethers.provider.getLogs({
      fromBlock: 0,
      toBlock: 'latest',
      address: this.token.address
    }).then((events) => {
      return events.map((e) => {
        return _interface.parseLog(e)//.args
      })
    })
    return events;
  }
  account () {
    let randomAccount;
    while(true) {
      let id = crypto.randomBytes(32).toString('hex');
      let privateKey = "0x"+id;
      let wallet = new ethers.Wallet(privateKey, ethers.provider);
      if (!this.addresses.includes(wallet.address)) {
        randomAccount = wallet
        break;
      }
    }
    return randomAccount;
  }
}
module.exports = Util
