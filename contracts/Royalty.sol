// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;
import 'hardhat/console.sol';
// This is a demo royalty contract
// The F0 design allows for pluggable programmable royalty contracts
contract Royalty {
  function get(address collection, uint tokenId, uint value) external view returns (address, uint) {
    return(collection, value * 3/10);
    //return (address(this), value*3/10);
  }
}
