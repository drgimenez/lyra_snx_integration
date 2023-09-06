//SPDX-License-Identifier: MIT
pragma solidity 0.5.16;
pragma experimental ABIEncoderV2;

import "node_modules/synthetix/contracts/interfaces/IPerpsV2MarketConsolidated.sol";
import "node_modules/synthetix/contracts/interfaces/IPerpsV2MarketState.sol";
import "node_modules/synthetix/contracts/interfaces/IAddressResolver.sol";

// @dev This interface is used to be able to build imported Sinthetix interfaces for 
// use from the artifacts folder.
interface IBuild {
}