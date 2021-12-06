const { MerkleTree } = require('merkletreejs');
const { CID } = require('multiformats/cid');
const keccak256 = require('keccak256');
const crypto = require('crypto')
const fs = require('fs');
const { expect } = require('chai')
const path = require('path');
const { ethers } = require('hardhat');
const InviteList = require('invitelist');
var deployer;
var factory;
var token;
var signer;
var alice;
var bob;
var addresses;
const FACTORIA = "0x502b2FE7Cc3488fcfF2E16158615AF87b4Ab5C41"
const all = ethers.utils.formatBytes32String("")
const toHexString = (bytes) => bytes.reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '');
let _cid = "0x" + toHexString(CID.parse('bafybeifpcgydc47j67wv7chqzbi56sbnee72kenmn5si66wpkqnghxsbx4').toJSON().hash).slice(4);
const deploy = async (price) => {
  const [_deployer, u1, u2] = await ethers.getSigners();
  alice = u1;
  bob = u2;
  deployer = _deployer;
  let Factory = await ethers.getContractFactory('Factory');
  //factory = await Factory.deploy(all, all, (price ? "" + price : 0))
  factory = await Factory.deploy()
  //factory = await Factory.deploy(all, all, {
  //  price: (price ? "" + price : 0),
  //  referral: 0
  //})
  await factory.deployed();
  await fs.promises.mkdir(path.resolve(__dirname, "../abi"), { recursive: true }).catch((e) => {})
  await fs.promises.writeFile(path.resolve(__dirname, "../abi/Deployed.json"), JSON.stringify({ address: factory.address }))
//  console.log("factory address", factory.address)
  let signers = await ethers.getSigners();
  addresses = signers.map((s) => {
    return s.address
  })
}
const getFactory = (signer) => {
  let ABI = require(path.resolve(__dirname, "../abi/contracts/Factory.sol/Factory.json"))
  let contract = new ethers.Contract(factory.address, ABI, signer)
  return contract;
}
const getToken = (signer) => {
  let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
  let contract = new ethers.Contract(token.address, ABI, signer)
  return contract;
}
const collections = async (address) => {
  let ABI = require(path.resolve(__dirname, "../abi/contracts/Factory.sol/Factory.json"))
  let interface = new ethers.utils.Interface(ABI)
  let filter = factory.filters.CollectionAdded(null, address)
  filter.fromBlock = 0
  filter.toBlock = 'latest'
  let events = await ethers.provider.getLogs(filter).then((events) => {
    return events.map((e) => {
      return interface.parseLog(e).args.collection
    })
  })
  return events;
}
const clone = async (address, name, symbol, config, val) => {
  if (val) {
    let tx = await factory.genesis(address, name, symbol, config, val)
    await tx.wait()
  } else {
    let tx = await factory.genesis(address, name, symbol, config)
    await tx.wait()
  }

  let addr = await collections(address);

  let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
  signer = ethers.provider.getSigner()
  token = new ethers.Contract(addr[0], ABI, signer)

}
const mintedLogs = async () => {
  let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
  let interface = new ethers.utils.Interface(ABI)
  let events = await ethers.provider.getLogs({
    fromBlock: 0,
    toBlock: 'latest',
    address: token.address
  }).then((events) => {
    return events.map((e) => {
      return interface.parseLog(e)//.args
    })
  })
  events = events.filter((log) => {
    return log.name == "Transfer" && log.args.from === "0x0000000000000000000000000000000000000000"
  })
  return events;
}
const globalLogs = async () => {
  let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
  let interface = new ethers.utils.Interface(ABI)
  let events = await ethers.provider.getLogs({
    fromBlock: 0,
    toBlock: 'latest',
    address: token.address
  }).then((events) => {
    return events.map((e) => {
      return interface.parseLog(e)//.args
    })
  })
  return events;
}
const account = () => {
  let randomAccount;
  while(true) {
    let id = crypto.randomBytes(32).toString('hex');
    let privateKey = "0x"+id;
    let wallet = new ethers.Wallet(privateKey, ethers.provider);
    if (!addresses.includes(wallet.address)) {
      randomAccount = wallet
      break;
    }
  }
  return randomAccount;
}

const address = () => {
  let randomAddress;
  while(true) {
    let id = crypto.randomBytes(32).toString('hex');
    let privateKey = "0x"+id;
    let wallet = new ethers.Wallet(privateKey);
    if (!addresses.includes(wallet.address)) {
      randomAddress = wallet.address
      break;
    }
  }
  return randomAddress;
}

describe('factory', () => {
  it('invite only factory', async () => {
    // 1. Deploy Factory
    await deploy()
    let deployerFactory = getFactory(deployer)
    let deployerAddress = deployer.address
    tx = await deployerFactory.genesis(
      deployerAddress,
      "test",                                                                 // collection name
      "T",                                                                    // collection symbol
      { placeholder: "ipfs://placeholder", supply: 10000, base: "ipfs://", permanent: false },  // collection config
      { value: 0 }                                                            // payment
    )
    await tx.wait()
    let addr = await collections(deployerAddress);
    let ABI = require(path.resolve(__dirname, "../abi/contracts/F0.sol/F0.json"))
    signer = ethers.provider.getSigner()
    token = new ethers.Contract(addr[0], ABI, signer)
    let name = await token.name()
    let symbol = await token.symbol()
    expect(name).to.equal("test")
    expect(symbol).to.equal("T")
  })
})
describe("token", () => {
  it('deploy with start time', async () => {
    await deploy();
    const config = {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    }
    const invite = {
      start: 0,
      price: 0,
      limit: 3,
    }
    await clone(deployer.address, "test", "T", config)
    let tx = await token.setInvite(all, _cid, invite)
    await tx.wait()


    // get config
    let c = await token.config()
    // config should have been set to the new config
    expect(c.placeholder).to.equal(config.placeholder)
    expect(c.supply).to.equal(config.supply)
    expect(c.base).to.equal(config.base)

    // get "Invited" logs
    let logs = await globalLogs()
    let invitedLogs = logs.filter((log) => {
      return log.name == "Invited"
    })
    // One "Invited" event
    expect(invitedLogs.length).to.equal(1)
    // The invite key should be "all"
    expect(invitedLogs[0].args.key).to.equal(all)

    // get invite for "all" condition
    let r = await token.invite(all)

    // the invite should be equal to the original invite condition
    expect(r.start).to.equal(invite.start)
    expect(r.price).to.equal(invite.price)
    expect(r.limit).to.equal(invite.limit)
    expect(r.cid).to.equal(invite.cid)
  })
//  it('deploy with 0 limit invite shouldnt create an invite object', async () => {
//    await deploy();
//    const config = {
//      placeholder: "ipfs://placeholder",
//      supply: 10000,
//      base: "ipfs://"
//    }
//    const invite = {
//      start: 0,
//      price: 0,
//      limit: 0,
//      cid: "cid"
//    }
//    // deploy
//    await clone("test", "T", all, invite, config)
//
//    // get "Invited" logs
//    let logs = await globalLogs()
//    let invitedLogs = logs.filter((log) => {
//      return log.name == "Invited"
//    })
//    // There should be no "Invited" event
//    expect(invitedLogs.length).to.equal(0)
//
//    // Get invites for "all"
//    let i = await token.invite(all)
//    // none should exist
//    expect(i.price).to.equal(0)
//    expect(i.start).to.equal(0)
//    expect(i.limit).to.equal(0)
//    expect(i.cid).to.equal("")
//  })
  it('calling invite should create an invite object', async () => {
    await deploy();
    const config = {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    }
    const invite = {
      start: 0,
      price: 0,
      limit: 0,
    }
    // Deploy (limit is 0, so no invite should be created)
    await clone(deployer.address, "test", "T", config)

    let tx = await token.setInvite(all, _cid, invite)
    await tx.wait()

    // Make a second invite
    const invite2 = {
      start: Date.now(),
      price: 1,
      limit: 2,
    }
    tx = await token.setInvite(all, _cid, invite2)
    await tx.wait()

    // Get invited logs
    let logs = await globalLogs()
    let invitedLogs = logs.filter((log) => {
      return log.name == "Invited"
    })
    // There should be one invite (because the deployment did not create an invite)
    expect(invitedLogs.length).to.equal(2)
    expect(invitedLogs[0].args.key).to.equal(all)

    // get invites for "all" condition
    let i = await token.invite(all)
    expect(i.price).to.equal(invite2.price)
    expect(i.start).to.equal(invite2.start)
    expect(i.limit).to.equal(invite2.limit)
  })
  it('normal mint', async () => {
    await deploy();
    const config = {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    }
    const invite = {
      start: 0,
      price: 0,
      limit: 3,
    }
    await clone(deployer.address, "test", "T", config)

    let tx = await token.setInvite(all, _cid, invite)
    await tx.wait()

    let c = await token.invite(all)
    //let tx = await token.mint(alice.address, all, [], [1,2,3])
    let aliceToken = getToken(alice)
    tx = await aliceToken.mint({
      key: all,
      proof: []
    }, 3)
    await tx.wait()
    // token 1, 2, 3 should be owned by alice
    let owner = await token.ownerOf(1)
    expect(owner).to.equal(alice.address)
    owner = await token.ownerOf(2)
    expect(owner).to.equal(alice.address)
    owner = await token.ownerOf(3)
    expect(owner).to.equal(alice.address)

    // token 4 doesn't exist
    tx = token.ownerOf(4)
    await expect(tx).to.be.revertedWith("ERC721: owner query for nonexistent token")
  })
  it('normal single mint', async () => {
    await deploy();
    const invite = {
      start: 0,
      price: 0,
      limit: 3,
    }
    const config = {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    }
    await clone(deployer.address, "test", "T", config)
    let tx = await token.setInvite(all, _cid, invite)
    await tx.wait()
    let c = await token.invite(all)
    expect(c.limit).to.equal(3)
    //let tx = await token.mint(alice.address, all, [], [1])
    let aliceToken = getToken(alice)
    tx = await aliceToken.mint({
      key: all,
      proof: [],
    }, 1)
    await tx.wait()
    let owner = await token.ownerOf(1)
    expect(owner).to.equal(alice.address)
  })
  it('should never exceed total supply', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let tx = await token.setInvite(all, _cid, {
      start: 0,
      price: 0,
      limit: 10000,
    })
    await tx.wait()

    let aliceToken = getToken(alice)

    tx = aliceToken.mint({
      key: all,
      proof: [],
    }, 11)

    await expect(tx).to.be.revertedWith("sold out")

  })
  it('compare single mint vs multiple mint', async () => {
    await deploy();
    const invite = {
      start: 0,
      price: 0,
      limit: 10000,
//      cid: "bafy",
    }
    const config = {
      placeholder: "ipfs://placeholder",
      supply: 100000,
      //supply: 10,
      base: "ipfs://"
    }
    await clone(deployer.address, "test", "T", config)
    let tx = await token.setInvite(all, _cid, invite)
    await tx.wait()

    let logs = await globalLogs() 
    let lastLog = logs[logs.length-1];
    let hex = "1220" + lastLog.args.cid.slice(2)


    const hexes = hex.match(/../g)
    let bytes = new Uint8Array(hexes.map(b => parseInt(b, 16)))

    const actual_cid = CID.decode(bytes).toV1().toString()

    let expected_cid = 'bafybeifpcgydc47j67wv7chqzbi56sbnee72kenmn5si66wpkqnghxsbx4'
    expect(actual_cid).to.equal(expected_cid)



    tx = await token.setInvite(all, _cid, invite)
    await tx.wait()

    let aliceToken = getToken(alice)

    for(let i=1; i<=30; i++) {
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, i)
//      tx = await aliceToken.mint(all, [], i)
      let receipt = await tx.wait()
      let gasUsed = receipt.gasUsed
      console.log("gas", gasUsed.toString(), i)
    }
  })
  it('minting transaction must send the right amount', async () => {
    await deploy();
    const invite = {
      start: 0,
      price: "" + Math.pow(10, 18),
      limit: 3,
    }
    const config = {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    }
    // not sending money should fail
    await clone(deployer.address, "test", "T", config)
    let tx = await token.setInvite(all, _cid, invite)
    await tx.wait()
    //let tx = token.mint(alice.address, all, [], [1])
    let aliceToken = getToken(alice)
    tx = aliceToken.mint({
      account: alice.address,
      key: all,
      proof: [],
    }, 1)
    await expect(tx).to.be.revertedWith("wrong amount")

    // send more than enough should fail
//    tx = token.mint(alice.address, all, [], [1], {
//      value: "" + Math.pow(10, 19)
//    })

    tx = aliceToken.mint({
      account: alice.address, 
      key: all,
      proof: [],
    }, 1, {
      value: "" + Math.pow(10, 19)
    })
    await expect(tx).to.be.revertedWith("wrong amount")

    // send less than enough should fail
//    tx = token.mint(alice.address, all, [], [1], {
//      value: "" + Math.pow(10, 17)
//    })
    tx = aliceToken.mint({
      key: all,
      proof: [],
    }, 1, {
      value: "" + Math.pow(10, 17)
    })
    await expect(tx).to.be.revertedWith("wrong amount")

    // correct amount should go through without error
//    tx = await token.mint(alice.address, all, [], [1], {
//      value: "" + Math.pow(10, 18)
//    })
    tx = await aliceToken.mint({
      key: all,
      proof: [],
    }, 1, {
      value: "" + Math.pow(10, 18)
    })
    let owner = await token.ownerOf(1)
    expect(owner).to.equal(alice.address)
  })
  describe('tokenURI', () => {
    it('tokenURI should return placeholder until baseURI is set', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "",
        permanent: false
      }
      await clone(deployer.address, "test", "T", config)
      let tokenURI = await token.tokenURI(1)
      expect(tokenURI).to.equal(config.placeholder)
    })
    it('tokenURI should return the hardcoded placeholder even when placeholder isnt set', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "",
        supply: 10000,
        base: "",
        permanent: false
      }
      await clone(deployer.address, "test", "T", config)
      const defaultPlaceholder = "ipfs://bafkreieqcdphcfojcd2vslsxrhzrjqr6cxjlyuekpghzehfexi5c3w55eq";
      let tokenURI = await token.tokenURI(1)
      expect(tokenURI).to.equal(defaultPlaceholder)
    })
    it('tokenURI should return correctly after the baseURI is set', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: true
      }
      await clone(deployer.address, "test", "T", config)
      let tokenURI = await token.tokenURI(1)
      expect(tokenURI).to.equal("ipfs://bafy/1.json")
    })
    it('tokenURI should error if trying to get a tokenId above total supply', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: true
      }
      await clone(deployer.address, "test", "T", config)

      // Trying to get above supply should fail
      let tokenURI = token.tokenURI(10001)
      await expect(tokenURI).to.be.revertedWith("wrong tokenId")

      // trying to get the exact total supply should work
      tokenURI = await token.tokenURI(10000)
      expect(tokenURI).to.equal("ipfs://bafy/10000.json")
    })
    it('tokenURI should error if trying to get 0', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: true
      }
      await clone(deployer.address, "test", "T", config)
      let tokenURI = token.tokenURI(0)
      await expect(tokenURI).to.be.revertedWith("wrong tokenId")
    })
  })
  describe("setting permanent", () => {
    it("even when frozen, you can still send invites", async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: true
      }
      let tx = await clone(deployer.address, "test", "T", config)

      // trying to mint should fail because no invite has been created
      //tx = token.mint(alice.address, all, [], [1])
      let aliceToken = getToken(alice)
      tx = aliceToken.mint({
        key: all,
        proof: [],
      }, 1)
      await expect(tx).to.be.revertedWith("mint limit")

      // update the invite for all so the limit is no longer 0
      tx = await token.setInvite(all, _cid, {
        price: 0,
        limit: 1,
        start: 0,
      })

      // now can mint for free up to 1
      //tx = await token.mint(alice.address, all, [], [1])
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, 1)
      let owner = await token.ownerOf(1)
      expect(owner).to.equal(alice.address)

    })
    it('if made permanent during deployment, can not revert permanence', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: true
      }
      let tx = await clone(deployer.address, "test", "T", config)

      // try to send a new invite for "all" with a different limit. should fail
      tx = token.setConfig({
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: false 
      })
      await expect(tx).to.be.revertedWith("permanent")


    })
    it('if made permanent during deployment, cannot change the configuration anymore', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: true
      }
      let tx = await clone(deployer.address, "test", "T", config)

      // try to send a new invite for "all" with a different limit. should fail
      tx = token.setConfig({
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: true,
      })
      await expect(tx).to.be.revertedWith("permanent")

    })
    it('can update the configuration if not made permanent', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/"
      }
      let tx = await clone(deployer.address, "test", "T", config)

      let c = await token.config()
      expect(c.supply).to.equal(10)

      // increase the supply to 10000
      tx = await token.setConfig({
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://bafy/",
        permanent: false
      })

      // should go through and the total supply should be changed
      c = await token.config()
      expect(c.supply).to.equal(10000)
      
    })
    it('making permanent later should work', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
        cid: "",
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }
      let tx = await clone(deployer.address, "test", "T", config)

      let c = await token.config()
      expect(c.supply).to.equal(10)

      // update to a new config, AND make it permanent
      const config2 = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://5678/",
        permanent: true
      }
      tx = await token.setConfig(config2)

      // now try to change the config again, should fail
      const config3 = {
        placeholder: "ipfs://placeholder",
        supply: 1,
        base: "ipfs://5678/",
        permanent: true
      }
      tx = token.setConfig(config3)
      await expect(tx).to.be.revertedWith('permanent')

    })
  })
  describe("The InviteList", () => {
    it('client side list verification', async () => {
      await deploy();
      // Create a list made up of signers addresses
      let signers = await ethers.getSigners();
      const list = new InviteList(signers.map((s) => {
        return s.address
      }))
      // get merkle root
      let key = list.root()
      // get proof
      let proof = list.proof(alice.address)
      // verify that alice belongs to the list using proof
      let isvalid = list.verify(alice.address, proof)
      expect(isvalid).to.equal(true)
      let randoAccount = account()
      let randoAddress = randoAccount.address
      isvalid = list.verify(randoAddress, proof)
      expect(isvalid).to.equal(false)
    })
    it('airdrop', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 0,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }
      let tx = await clone(deployer.address, "test", "T", config)


      // Create a list made up of signers addresses
      let signers = await ethers.getSigners();
      const list = new InviteList(signers.map((s) => {
        return s.address
      }))
      // get merkle root
      let key = list.root()

      // AIRDROP: invite the list to mint at most 1 for FREE
      tx = await token.setInvite(key, _cid, {
        price: 0,
        limit: 1,
        start: 0,
      })
      await tx.wait()

      let i = await token.invite(key)
      expect(i.price).to.equal(0)
      expect(i.start).to.equal(0)
      expect(i.limit).to.equal(1)

      // get proof for alice
      let proof = list.proof(alice.address)

      // try minting with alice address
      //tx = await token.mint(alice.address, key, proof, [1])
      let aliceToken = getToken(alice)
      tx = await aliceToken.mint({
        key,
        proof
      }, 1)
      await tx.wait()

      let owner = await token.ownerOf(1)
      expect(owner).to.equal(alice.address)
    })
    it('merkle drop try with wrong proof shouldnt work', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 2,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }

      let signers = await ethers.getSigners();
      const list = new InviteList(signers.map((s) => {
        return s.address
      }))
      let key = list.root()

      // deploy with invite "key"
      let tx = await clone(deployer.address, "test", "T", config)

      tx = await token.setInvite(key, _cid, invite)
      await tx.wait()

      // Get alice's merkle proof
      let aliceProof = list.proof(alice.address)
      // Try to mint to Bob using Alice's merkle proof should fail
      //tx = token.mint(bob.address, key, aliceProof, [1, 2])
      let bobToken = getToken(bob)
      tx = token.mint({
        key,
        proof: aliceProof
      }, 2)
      await expect(tx).to.be.revertedWith('wrong proof');

      // Get bob's merkle proof
      let bobProof = list.proof(bob.address)
      //tx = await token.mint(bob.address, key, bobProof, [1, 2])
      tx = await bobToken.mint({
        key: key,
        proof: bobProof,
      }, 2)
      await tx.wait()

      owner = await token.ownerOf(2)
      expect(owner).to.equal(bob.address)

    })
    it("trying to mint with someone elses list shouldnt work", async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 16),
        limit: 3,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }

      let signers = await ethers.getSigners();
      const list = new InviteList(signers.map((s) => {
        return s.address
      }))
      let key = list.root()

      // deploy with invite "key"
      let tx = await clone(deployer.address, "test", "T", config)

      tx = await token.setInvite(key, _cid, invite)
      await tx.wait()

      // try to mint with "all" condition shouldn't work
      //tx = token.mint(alice.address, all, [], [1])
      let aliceToken = getToken(alice)
      tx = aliceToken.mint({
        key: all,
        proof: [],
      }, 1)
      // should revert with "mint limit" because by default it's all zero
      await expect(tx).to.be.revertedWith("mint limit")
    })
    it("submit merkle root with empty proof should fail if not 'all' condition", async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 16),
        limit: 3,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }

      let signers = await ethers.getSigners();
      const list = new InviteList(signers.map((s) => {
        return s.address
      }))

      // deploy with invite "key"
      let tx = await clone(deployer.address, "test", "T",  config)

      tx = await token.setInvite(list.root(), _cid, invite)
      await tx.wait()

      // try to mint with the right key, but incorrect amouht should fail
      //tx = token.mint(alice.address, list.root(), [], [1])
      let aliceToken = getToken(alice)
      tx = aliceToken.mint({
        key: list.root(),
        proof: [],
      }, 1)
      // should revert with "mint limit" because by default it's all zero
      await expect(tx).to.be.revertedWith("wrong proof")

    })
    it("submit merkle root with empty proof should work if 'all' condition", async () => {
      await deploy();
      const invite = {
        start: 0,
        price: 0,
        limit: 3,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }

      // deploy with invite "key"
      let tx = await clone(deployer.address, "test", "T", config)

      tx = await token.setInvite(all, _cid, invite)
      await tx.wait()

      // try to mint with the right key, but incorrect amouht should fail
      //tx = await token.mint(alice.address, all, [], [1])
      let aliceToken = getToken(alice)
      tx = await aliceToken.mint({
        key: all,
        proof: []
      }, 1)
      // should revert with "mint limit" because by default it's all zero
      let o = await token.ownerOf(1)
      expect(o).to.equal(alice.address)

    })
    it("presale with non zero amount payment", async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 16),
        limit: 3,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }

      let signers = await ethers.getSigners();
      const list = new InviteList(signers.map((s) => {
        return s.address
      }))

      // deploy with invite "key"
      let tx = await clone(deployer.address, "test", "T", config)

      tx = await token.setInvite(list.root(), _cid, invite)
      await tx.wait()

      // try to mint with the right key, but incorrect amouht should fail
      //tx = token.mint(alice.address, list.root(), list.proof(alice.address), [1])
      let aliceToken = getToken(alice)
      tx = aliceToken.mint({
        key: list.root(),
        proof: list.proof(alice.address)
      }, 1)
      // should revert with "mint limit" because by default it's all zero
      await expect(tx).to.be.revertedWith("wrong amount")


      // correct amount should work
//      tx = await token.mint(alice.address, list.root(), list.proof(alice.address), [1], {
//        value: "" + Math.pow(10, 16)
//      })
      tx = await aliceToken.mint({
        key: list.root(),
        proof: list.proof(alice.address)
      }, 1, {
        value: "" + Math.pow(10, 16)
      })

      let o = await token.ownerOf(1)
      expect(o).to.equal(alice.address)

      // try to mint with "key" condition only goes through if the merkle proof matches
    })
    it('multiple whitelist batches', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 16),
        limit: 0,
      }
      // initial supply is 10
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10,
        base: "ipfs://bafy/",
        permanent: false
      }
      let tx = await clone(deployer.address, "test", "T", config)

      tx = await token.setInvite(all, _cid, invite)
      await tx.wait()

      let signers = await ethers.getSigners();
      addresses = signers.map((s) => {
        return s.address
      })
      let giveaway = signers.slice(0, 3);
      let presale = signers.slice(3);
      let giveawayAddresses = addresses.slice(0, 3);
      let presaleAddresses = addresses.slice(3);

      let giveawayInviteList = new InviteList(giveawayAddresses);
      let presaleInviteList = new InviteList(presaleAddresses)

      /***************************************************************
      *
      * Phase 1. Giveaway
      *
      ***************************************************************/
      // 1.1. Set a Giveaway whitelist
      tx = await token.setInvite(giveawayInviteList.root(), _cid, {
        start: 0,
        price: 0,
        limit: 3,
      })
      await tx.wait()
      // 1.2. try to mint with an account not on the list
      let randoAccount = account()
      let randoAddress = randoAccount.address
      let proof = await giveawayInviteList.proof(randoAddress)
      //tx = token.mint(randomAddress, giveawayInviteList.root(), proof, [1])
      let randoToken = getToken(randoAccount)
      tx = randoToken.mint({
        key: giveawayInviteList.root(),
        proof
      }, 1)
      await expect(tx).to.be.revertedWith("wrong proof")
      // 1.3. try to mint with an account on the giveaway list
      proof = await giveawayInviteList.proof(giveawayAddresses[1])
      //tx = await token.mint(giveaway[1], giveawayInviteList.root(), proof, [1])
      let giveawayToken = getToken(giveaway[1])
      tx = await giveawayToken.mint({
        key: giveawayInviteList.root(),
        proof
      }, 1)
      await tx.wait()

      let owner = await token.ownerOf(1)
      expect(owner).to.equal(giveawayAddresses[1])

      /***************************************************************
      *
      * Phase 2. Presale
      *
      ***************************************************************/
      // 2.1. Set a Presale whitelist and update the price
      tx = await token.setInvite(presaleInviteList.root(), _cid, {
        start: 0,
        price: "" + Math.pow(10, 18),
        limit: 3,
      })
      await tx.wait()
      let giveawayInvite = await token.invite(giveawayInviteList.root())
      expect(giveawayInvite.price).to.equal(0)
      let presaleInvite = await token.invite(presaleInviteList.root())
      expect(presaleInvite.price.toString()).to.equal(Math.pow(10, 18).toString())
      // 2.2. Try to mint with an account not on the presale list
      randoAccount = account()
      randoAddress = randoAccount.address
      proof = await giveawayInviteList.proof(randoAddress)
//      tx = token.mint(randomAddress, presaleInviteList.root(), proof, [2, 3], {
//        value: "" + Math.pow(10, 18) * 2,
//      })
      tx = randoToken.mint({
        key: presaleInviteList.root(),
        proof
      }, 2, {
        value: "" + Math.pow(10, 18) * 2,
      })
      await expect(tx).to.be.revertedWith("wrong proof")
      // 2.3. Try to mint with an account on the presale but incorrect amount
      proof = await presaleInviteList.proof(presaleAddresses[1])
//      tx = token.mint(presale[1], presaleInviteList.root(), proof, [2, 3], {
//        value: "" + Math.pow(10, 18),
//      })
      let presaleToken = getToken(presale[1])
      tx = presaleToken.mint({
        key: presaleInviteList.root(),
        proof
      }, 2, {
        value: "" + Math.pow(10, 18),
      })
      await expect(tx).to.be.revertedWith("wrong amount")
      // 2.4. Try to mint with an account on the presale, but referencing a wrong merkle root (givawayInviteList instead of presaleInviteList)
//      tx = token.mint(presale[1], giveawayInviteList.root(), proof, [2, 3], {
//        value: 0
//      })
      tx = presaleToken.mint({
        key: giveawayInviteList.root(),
        proof
      }, 2, {
        value: 0
      })
      await expect(tx).to.be.revertedWith("wrong proof")
      // 2.5. Try to mint with an account on the presale with correct amount
//      tx = await token.mint(presale[1], presaleInviteList.root(), proof, [2, 3], {
//        value: "" + Math.pow(10, 18) * 2,
//      })
      tx = await presaleToken.mint({
        key: presaleInviteList.root(),
        proof
      }, 2, {
        value: "" + Math.pow(10, 18) * 2,
      })
      await tx.wait()
      owner = await token.ownerOf(2)
      expect(owner).to.equal(presaleAddresses[1])
      // 2.6. Giveaway users should still be able to mint
      proof = await giveawayInviteList.proof(giveawayAddresses[2])
      //tx = await token.mint(giveaway[2], giveawayInviteList.root(), proof, [4,5,6])
      let giveawayToken2 = getToken(giveaway[2])
      tx = await giveawayToken2.mint({
        key: giveawayInviteList.root(),
        proof
      }, 3)
      await tx.wait()
      owner = await token.ownerOf(4)
      expect(owner).to.equal(giveawayAddresses[2])

    })
  })
  describe('withdraw', () => {
    it('default: owner can withdraw', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 15),
        limit: 3,
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
      await clone(deployer.address, "test", "T", config)
      let tx = await token.setInvite(all, _cid, invite)
      await tx.wait()
      let c = await token.invite(all)
      let aliceToken = getToken(alice)
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, 3, {
        value: "" + Math.pow(10, 15) * 3
      })
      await tx.wait()
      let owner = await token.ownerOf(1)
      expect(owner).to.equal(alice.address)

      let contractBalance = await ethers.provider.getBalance(token.address);
      expect(contractBalance).to.equal(Math.pow(10, 15) * 3)


      let oldBalance = await ethers.provider.getBalance(deployer.address);
      let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      expect(factoriaBalanceBefore).to.equal(0)
      tx = await token.withdraw()
      let r = await tx.wait()

      let spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
      let expectedBalance = oldBalance
        .sub(spentEth)
        .add(ethers.BigNumber.from(Math.pow(10, 15)).mul(3))
        .sub(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).div(100))

      balance = await ethers.provider.getBalance(deployer.address);
      expect(balance).to.equal(expectedBalance)

      contractBalance = await ethers.provider.getBalance(token.address);
      expect(contractBalance).to.equal(0)

      let factoriaBalance = await ethers.provider.getBalance(FACTORIA);
      expect(factoriaBalance).to.equal(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).div(100))


    })
    it('1 ETH cap fee', async () => {

      const makeMoney = async (cost, count) => {
        await deploy();
        await clone(deployer.address, "test", "T", {
          placeholder: "ipfs://placeholder",
          supply: 10000,
          base: "ipfs://"
        })
        let tx = await token.setInvite(all, _cid, {
          start: 0,
          price: "" + cost,
          limit: 10000000,
        })
        await tx.wait()
        let c = await token.invite(all)
        let aliceToken = getToken(alice)
        // alice mints to contract
        tx = await aliceToken.mint({
          key: all,
          proof: [],
        }, count, {
          value: ethers.BigNumber.from("" + cost).mul(count).toString()
        })

        // contract balance
        let contractBalance = await ethers.provider.getBalance(token.address);

        // deployer withdraws from contract
        let oldBalance = await ethers.provider.getBalance(deployer.address);
        tx = await token.withdraw()
        let r = await tx.wait()
        let spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
        let newBalance = await ethers.provider.getBalance(deployer.address);
        return {
          spent: spentEth,
          before: oldBalance,
          after: newBalance
        }
      }

      // A. 0.1ETH * 2000 => 200 ETH revenue => 1 ETH capped fee
      let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      let r = await makeMoney(Math.pow(10, 17), 2000)
      let factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);
      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (200ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 20)).mul(2))
        // minus fee (1ETH capped)
        .sub(ethers.BigNumber.from("" + Math.pow(10, 18)))
      )

      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 18)))
      )

      // B. 0.1ETH * 100 => 10 ETH revenue => 0.1 ETH fee
      factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      r = await makeMoney(Math.pow(10, 17), 100)
      factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);
      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (200ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 19)))
        // minus fee (0.1ETH)
        .sub(ethers.BigNumber.from("" + Math.pow(10, 17)))
      )

      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)))
      )




    })
    it('multiple withdrawals', async () => {
      const setup = async () => {
        await deploy();
        await clone(deployer.address, "test", "T", {
          placeholder: "ipfs://placeholder",
          supply: 10000,
          base: "ipfs://"
        })
      }
      const invite = async (cost) => {
        let tx = await token.setInvite(all, _cid, {
          start: 0,
          price: "" + cost,
          limit: 10000000,
        })
        await tx.wait()
      }
      const makeMoney = async (cost, count) => {
        let aliceToken = getToken(alice)
        // alice mints to contract
        tx = await aliceToken.mint({
          key: all,
          proof: [],
        }, count, {
          value: ethers.BigNumber.from("" + cost).mul(count).toString()
        })

        // contract balance
        let contractBalance = await ethers.provider.getBalance(token.address);

        // deployer withdraws from contract
        let oldBalance = await ethers.provider.getBalance(deployer.address);
        tx = await token.withdraw()
        let r = await tx.wait()
        let spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
        let newBalance = await ethers.provider.getBalance(deployer.address);
        return {
          spent: spentEth,
          before: oldBalance,
          after: newBalance
        }
      }


      // Withdraw multiple times

      // deploy
      await setup()
      await invite(Math.pow(10, 17))

      // Step 1. 0.1ETH * 100 => 10 ETH revenue => 0.1 ETH fee
      factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      r = await makeMoney(Math.pow(10, 17), 100)
      factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (10ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 19)))
        // minus fee (0.1ETH)
        .sub(ethers.BigNumber.from("" + Math.pow(10, 17)))
      )

      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)))
      )

      // Step 2. 0.2ETH * 100 => 20 ETH revenue => 0.2 ETH fee
      await invite(Math.pow(10, 17)*2)

      factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      r = await makeMoney(Math.pow(10, 17)*2, 100)
      factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (20ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(2))
        // minus fee (0.2ETH)
        .sub(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(2))
      )
      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(2))
      )


      // Step 3. 0.6ETH * 100 => 60 ETH revenue => 0.6 ETH fee
      await invite(Math.pow(10, 17)*6)
      factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      r = await makeMoney(Math.pow(10, 17)*6, 100)
      factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (20ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(6))
        // minus fee (0.2ETH)
        .sub(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(6))
      )

      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(6))
      )

      // Step 4. 0.3ETH * 100 => 30 ETH revenue => (1 - 0.2 - 0.1 - 0.6) = 0.1 ETH fee
      await invite(Math.pow(10, 17)*3)
      factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      r = await makeMoney(Math.pow(10, 17)*3, 100)
      factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (20ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(3))
        // minus fee (0.2ETH)
        .sub(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(1))
      )

      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from("" + Math.pow(10, 17)).mul(1))
      )

      // Step 5. 10ETH * 100 => 1000 ETH revenue => 0 fee
      await invite(Math.pow(10, 19))
      factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);
      r = await makeMoney(Math.pow(10, 18)*10, 100)
      factoriaBalanceAfter = await ethers.provider.getBalance(FACTORIA);

      // Final result is equal to
      expect(r.after).to.equal(
        // the Previous balance
        r.before.sub(r.spent)
        // plus revenue (20ETH)
        .add(ethers.BigNumber.from("" + Math.pow(10, 19)).mul(100))
        // no fee (0)
      )

      expect(factoriaBalanceAfter).to.equal(
        factoriaBalanceBefore
      )


    })
    it('default: non owner cant withdraw', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 15),
        limit: 3,
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
      await clone(deployer.address, "test", "T", config)
      let tx = await token.setInvite(all, _cid, invite)
      await tx.wait()
      let c = await token.invite(all)
      let aliceToken = getToken(alice)
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, 3, {
        value: "" + Math.pow(10, 15) * 3
      })
      await tx.wait()
      let owner = await token.ownerOf(1)
      expect(owner).to.equal(alice.address)

      tx = aliceToken.withdraw()
      await expect(tx).to.be.revertedWith("unauthorized")

    })
    it('setWithdrawer can be only called by owner', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 15),
        limit: 3,
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
      await clone(deployer.address, "test", "T", config)
      let tx = await token.setInvite(all, _cid, invite)
      await tx.wait()
      let c = await token.invite(all)
      let aliceToken = getToken(alice)
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, 3, {
        value: "" + Math.pow(10, 15) * 3
      })
      await tx.wait()

      tx = aliceToken.setWithdrawer({
        account: alice.address,
      })
      await expect(tx).to.be.revertedWith("Ownable: caller is not the owner")

    })
    it('set withdrawer to alice => withdraw sends money to alice', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 15),
        limit: 3,
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
      await clone(deployer.address, "test", "T", config)
      let tx = await token.setInvite(all, _cid, invite)
      await tx.wait()
      let c = await token.invite(all)
      let aliceToken = getToken(alice)
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, 3, {
        value: "" + Math.pow(10, 15) * 3
      })
      await tx.wait()

      tx = await token.setWithdrawer({
        account: alice.address,
        permanent: false
      })
      await tx.wait()

      let factoriaBalanceBefore = await ethers.provider.getBalance(FACTORIA);

      let beforeBalance = await ethers.provider.getBalance(alice.address);
      // withdraw with deployer account
      tx = await token.withdraw()
      //await expect(tx).to.be.revertedWith("withdraw unauthorized")

      contractBalance = await ethers.provider.getBalance(token.address);
      expect(contractBalance).to.equal(0)

      let afterBalance = await ethers.provider.getBalance(alice.address);

      expect(afterBalance.sub(beforeBalance)).to.equal(
        ethers.BigNumber.from(Math.pow(10, 15)).mul(3).mul(99).div(100)
      )

      let factoriaBalance = await ethers.provider.getBalance(FACTORIA);
      expect(factoriaBalance).to.equal(
        factoriaBalanceBefore.add(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).div(100))
      )

    })
    it('owner or withdrawer can withdraw', async () => {
      await deploy();
      const invite = {
        start: 0,
        price: "" + Math.pow(10, 15),
        limit: 1000,
      }
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
      await clone(deployer.address, "test", "T", config)
      let tx = await token.setInvite(all, _cid, invite)
      await tx.wait()
      let c = await token.invite(all)
      let aliceToken = getToken(alice)

      tx = await token.setWithdrawer({
        account: alice.address,
        permanent: false
      })
      await tx.wait()


      // mint, and withdraw with deployer account
      tx = await aliceToken.mint({
        key: all,
        proof: [],
      }, 3, {
        value: "" + Math.pow(10, 15) * 3
      })
      await tx.wait()

      let beforeBalance = await ethers.provider.getBalance(alice.address);


      // withdrawn by DEPLOYER (not alice), so alice didn't pay any gas.
      tx = await token.withdraw()
      let r = await tx.wait()
//      let spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
      let afterBalance = await ethers.provider.getBalance(alice.address);
//      console.log("spent", spentEth.toString())
//      console.log("before", beforeBalance.toString())
//      console.log("after", afterBalance.toString())
      expect(afterBalance).to.equal(
        beforeBalance
//        .sub(spentEth)
        .add(ethers.BigNumber.from(Math.pow(10, 15)).mul(3).mul(99).div(100))
      )
      let contractBalance = await ethers.provider.getBalance(token.address);
      expect(contractBalance).to.equal(0)


      // mint, and withdraw with alice account => should work
      tx = await token.mint({
        key: all,
        proof: [],
      }, 5, {
        value: "" + Math.pow(10, 15) * 5
      })
      await tx.wait()

      beforeBalance = await ethers.provider.getBalance(alice.address);
      tx = await aliceToken.withdraw()
      r = await tx.wait()
      spentEth = r.cumulativeGasUsed.mul(r.effectiveGasPrice)
      afterBalance = await ethers.provider.getBalance(alice.address);

      // Withdrawn by Alice account, so alice spent some gas, therefore alice should have less money
      expect(afterBalance).to.equal(
        beforeBalance
        .sub(spentEth)
        .add(ethers.BigNumber.from(Math.pow(10, 15)).mul(5).mul(99).div(100))
      )
      contractBalance = await ethers.provider.getBalance(token.address);
      expect(contractBalance).to.equal(0)


      // withdraw with bob account => should fail
      tx = await token.mint({
        key: all,
        proof: [],
      }, 5, {
        value: "" + Math.pow(10, 15) * 5
      })
      await tx.wait()

      let bobToken = getToken(bob)
      tx = bobToken.withdraw()
      await expect(tx).to.be.revertedWith("unauthorized")


    })
    it('setWithdrawer permanence', async () => {
      await deploy();
      const config = {
        placeholder: "ipfs://placeholder",
        supply: 10000,
        base: "ipfs://"
      }
      await clone(deployer.address, "test", "T", config)
      let tx = await token.setWithdrawer({
        account: alice.address,
        permanent: false
      })
      await tx.wait()

      let withdrawer = await token.withdrawer()
      expect(withdrawer.account).to.equal(alice.address)
      expect(withdrawer.permanent).to.equal(false)

      // set the withdrawer to bob
      tx = await token.setWithdrawer({
        account: bob.address,
        permanent: true
      })
      await tx.wait()

      withdrawer = await token.withdrawer()
      expect(withdrawer.account).to.equal(bob.address)
      expect(withdrawer.permanent).to.equal(true)

      // try to set withdrawer back to alice
      tx = token.setWithdrawer({
        account: alice.address,
        permanent: false 
      })
      await expect(tx).to.be.revertedWith("permanent");

      tx = token.setWithdrawer({
        account: alice.address,
        permanent: true
      })
      await expect(tx).to.be.revertedWith("permanent");
      
    })
  })
  it('setNS', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    let tx = await token.setNS("New name", "SYM")
    await tx.wait()

    let name = await token.name()
    let symbol = await token.symbol()
  })
  it('gift collection to an owner', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })

    let owner = await token.owner()
    expect(owner).to.equal(deployer.address)

    await clone(alice.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10000,
      base: "ipfs://"
    })
    owner = await token.owner()
    expect(owner).to.equal(alice.address)

  })
  it('gift', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let aliceToken = getToken(alice)
    let tx = aliceToken.gift(bob.address, 3)
    await expect(tx).to.be.revertedWith("Ownable: caller is not the owner");

    tx = await token.gift(bob.address, 3)
    await tx.wait()

    for(let i=1; i<=3; i++) {
      let owner = await aliceToken.ownerOf(i) 
      expect(owner).to.equal(bob.address)
    }
  })
  it('burn', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 100,
      base: "ipfs://"
    })
    let tx = await token.setInvite(all, _cid, {
      start: 0,
      price: 0,
      limit: 10,
    })
    tx = await token.mint({
      key: all,
      proof: []
    }, 3)
    await tx.wait()
    //tx = await token["safeTransferFrom(address,address,uint256)"](token.account, "0x0000000000000000000000000000000000000000", 1);
    let owner = await token.ownerOf(1)

    expect(owner).to.equal(deployer.address)

    tx = await token.burn(1);
    //tx = await token.transferFrom(deployer.address, "0x0", 1);
    await tx.wait()

    owner = token.ownerOf(1)
    await expect(owner).to.be.revertedWith("ERC721: owner query for nonexistent token")


  })
  it("create and gift a collection to alice", async () => {
    await deploy();
    await clone(alice.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let owner = await token.owner()
    expect(owner).to.equal(alice.address)
  })
  it("create and gift a collection to a receiver with 1ETH infused", async () => {
    await deploy();
    let receiverAccount = account()
    let receiverBalanceBefore = await ethers.provider.getBalance(receiverAccount.address);
    await clone(receiverAccount.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    }, {
      value: "" + Math.pow(10, 18)  // infuse 1 ETH
    })
    let owner = await token.owner()
    expect(owner).to.equal(receiverAccount.address)
    let receiverBalanceAfter = await ethers.provider.getBalance(receiverAccount.address);
    console.log("receiverBalanceBefore", receiverBalanceBefore);
    console.log("receiverBalanceAfter", receiverBalanceAfter);
    expect(receiverBalanceBefore).to.equal(0)
    expect(receiverBalanceAfter).to.equal(
      ethers.BigNumber.from("" + Math.pow(10, 18))
    )

  })
  it('transfer collection', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let owner = await token.owner()
    expect(owner).to.equal(deployer.address)
    console.log("O1", owner)

    // first, call addCollection to transfer
    // second, call token.transferOwnership()

    let tx = await factory.addCollection(alice.address, token.address)
    let r = await tx.wait()
    console.log("r", r.events[0].args)
    expect(r.events[0].args.sender).to.equal(owner)
    expect(r.events[0].args.receiver).to.equal(alice.address)
    expect(r.events[0].args.collection).to.equal(token.address)

    await token.transferOwnership(alice.address)

    owner = await token.owner()
    console.log("O", owner)
    expect(owner).to.equal(alice.address)
  })
  it('cant transfer ownership if you dont own it', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let owner = await token.owner()
    expect(owner).to.equal(deployer.address)
    console.log("O1", owner)

    // Alice tries to addCollection to herself when she doesn't own it
    let aliceFactory = getFactory(alice)
    let tx = aliceFactory.addCollection(alice.address, token.address)
    await expect(tx).to.be.revertedWith('unauthorized');
  })
  it('can still update the CollectionTransferred log even if I called transferOwnership first', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let owner = await token.owner()
    expect(owner).to.equal(deployer.address)
    console.log("O1", owner)

    // first, call token.transferOwnership()
    let tx = await token.transferOwnership(alice.address)
    await tx.wait()

    // second, try to  call addCollection => should fail because the deployer doesn't own the collection anymore
    tx = factory.addCollection(alice.address, token.address)
    await expect(tx).to.be.revertedWith('unauthorized');

    // third, switch to alice (new owner) and call transferCollection to transfer
    let aliceFactory = getFactory(alice)
    tx = await aliceFactory.addCollection(alice.address, token.address)
    r = await tx.wait()
    console.log("r", r.events[0].args)
    // alice sending to herself
    expect(r.events[0].args.sender).to.equal(alice.address)
    expect(r.events[0].args.receiver).to.equal(alice.address)
    expect(r.events[0].args.collection).to.equal(token.address)

    owner = await token.owner()
    console.log("O", owner)
    expect(owner).to.equal(alice.address)
  })
  it('uri', async () => {
    await deploy();
    await clone(deployer.address, "test", "T", {
      placeholder: "ipfs://placeholder",
      supply: 10,
      base: "ipfs://"
    })
    let uri = await token.URI()
    console.log("uri", uri)
    await token.setURI("ipfs://")
    uri = await token.URI()
    console.log("uri", uri)
  })
})
