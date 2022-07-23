// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.1;

library Structs {
    struct List {
        address seller;
        uint256 assetId;
        uint256 amount;
    }

    struct Proposals {
        address buyer;
        uint256 price;
        uint256 amount;
    }
}
