// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.1;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol";
import "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/utils/Address.sol";

contract AuctionSale is
    Context,
    ERC165,
    IERC1155Receiver,
    AccessControlEnumerable,
    ReentrancyGuard
{
    struct ReserveAuction {
        uint256 tokenId;
        uint256 amount;
        address payable seller;
        uint256 duration;
        uint256 extensionDuration;
        uint256 endTime;
        address payable bidder;
        uint256 currentBid;
    }

    event List(
        uint256 auctionId,
        address seller,
        uint256 tokenId,
        uint256 amount,
        uint256 duration,
        uint256 extensionDuration,
        uint256 reservePrice
    );

    event Cancel(uint256 auctionId);

    event Bid(
        uint256 auctionId,
        uint256 assetId,
        address bidder,
        uint256 bid,
        address oldBidder,
        uint256 oldBid,
        address seller,
        uint256 endTime
    );

    event Settle(
        uint256 auctionId,
        uint256 assetId,
        address seller,
        address bidder,
        uint256 finalBid,
        address settler
    );

    mapping(uint256 => ReserveAuction) private auctionIdToAuction;

    mapping(uint256 => bool) assetWasListed;

    // Cap the max duration so that overflows will not occur
    uint256 private constant MAX_MAX_DURATION = 1000 days;

    uint256 private constant EXTENSION_DURATION = 15 minutes;

    uint256 private nextSaleId;

    IERC1155 private assetContract;

    constructor(address _assetContractAddress) {
        require(
            _assetContractAddress != address(0) &&
                _assetContractAddress != address(this)
        );

        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        assetContract = IERC1155(_assetContractAddress);
        nextSaleId = 1;
    }

    modifier onlyValidAuctionConfig(uint256 reservePrice) {
        require(reservePrice >= 100, "Reserve price must be at least 100 wei");
        _;
    }

    function list(
        uint256 tokenId,
        uint256 amount,
        uint256 reservePrice,
        uint256 _duration
    ) public onlyValidAuctionConfig(reservePrice) nonReentrant {
        require(amount > 0, "Invalid amount");

        uint256 auctionId = nextSaleId++;

        auctionIdToAuction[auctionId] = ReserveAuction(
            tokenId,
            amount,
            payable(msg.sender),
            _duration,
            EXTENSION_DURATION,
            0, // endTime is only known once the reserve price is met
            payable(address(0)), // bidder is only known once a bid has been placed
            reservePrice
        );

        assetWasListed[tokenId] = true;

        assetContract.safeTransferFrom(
            msg.sender,
            address(this),
            tokenId,
            amount,
            ""
        );

        emit List(
            auctionId,
            msg.sender,
            tokenId,
            amount,
            _duration,
            EXTENSION_DURATION,
            reservePrice
        );
    }

    function cancel(uint256 auctionId) public nonReentrant {
        ReserveAuction memory auction = auctionIdToAuction[auctionId];
        require(auction.seller == msg.sender, "Not your auction");
        require(auction.endTime == 0, "Auction in progress");

        delete auctionIdToAuction[auctionId];

        assetContract.safeTransferFrom(
            address(this),
            auction.seller,
            auction.tokenId,
            auction.amount,
            ""
        );

        emit Cancel(auctionId);
    }

    function bid(uint256 auctionId) public payable nonReentrant {
        ReserveAuction storage auction = auctionIdToAuction[auctionId];
        require(auction.currentBid != 0, "Auction not found");
        uint256 oldBid;
        address payable oldBidder;

        if (auction.endTime == 0) {
            // If this is the first bid, ensure it's >= the reserve price
            require(
                msg.value >= auction.currentBid,
                "Bid must be at least the reserve price"
            );
        } else {
            // If this bid outbids another, confirm that the bid is at least x% greater than the last
            require(auction.endTime >= block.timestamp, "Auction is over");
            require(
                auction.bidder != msg.sender,
                "You already have an outstanding bid"
            );

            uint256 minAmount = _getMinBidAmountForReserveAuction(
                auction.currentBid
            );
            require(msg.value >= minAmount, "Bid currentBid too low");
        }

        if (auction.endTime == 0) {
            auction.currentBid = msg.value;
            auction.bidder = payable(msg.sender);
            // On the first bid, the endTime is now + duration
            auction.endTime = block.timestamp + auction.duration;
        } else {
            oldBid = auction.currentBid;
            oldBidder = auction.bidder;
            auction.currentBid = msg.value;
            auction.bidder = payable(msg.sender);

            // When a bid outbids another, check to see if a time extension should apply.
            if (auction.endTime - block.timestamp < auction.extensionDuration) {
                auction.endTime = block.timestamp + auction.extensionDuration;
            }

            payable(oldBidder).transfer(oldBid);
        }

        emit Bid(
            auctionId,
            auction.tokenId,
            msg.sender,
            msg.value,
            oldBidder,
            oldBid,
            auction.seller,
            auction.endTime
        );
    }

    function settle(uint256 auctionId) public nonReentrant {
        ReserveAuction memory auction = auctionIdToAuction[auctionId];
        require(auction.endTime > 0, "Auction was already settled");
        require(auction.endTime < block.timestamp, "Auction still in progress");

        delete auctionIdToAuction[auctionId];

        assetContract.safeTransferFrom(
            address(this),
            auction.bidder,
            auction.tokenId,
            auction.amount,
            ""
        );

        payable(auction.bidder).transfer(auction.currentBid);

        emit Settle(
            auctionId,
            auction.tokenId,
            auction.seller,
            auction.bidder,
            auction.currentBid,
            msg.sender
        );
    }

    function isAuctionEnded(uint256 auctionId) public view returns (bool) {
        ReserveAuction memory auction = auctionIdToAuction[auctionId];

        require(auction.currentBid != 0, "Auction not found");

        return (auction.endTime > 0) && (auction.endTime < block.timestamp);
    }

    function getMinBidAmount(uint256 auctionId) public view returns (uint256) {
        ReserveAuction storage auction = auctionIdToAuction[auctionId];

        if (auction.endTime == 0) {
            return auction.currentBid;
        }
        return _getMinBidAmountForReserveAuction(auction.currentBid);
    }

    function _getMinBidAmountForReserveAuction(uint256 currentBidAmount)
        private
        pure
        returns (uint256)
    {
        uint256 minIncrement = currentBidAmount / 10;

        if (minIncrement < (0.1 ether)) {
            // The next bid must be at least 0.1 ether greater than the current.
            return currentBidAmount + (0.1 ether);
        }

        return (currentBidAmount + minIncrement);
    }

    function getEndTimeForReserveAuction(uint256 auctionId)
        public
        view
        returns (uint256)
    {
        ReserveAuction memory auction = auctionIdToAuction[auctionId];
        require(auction.currentBid != 0, "Auction not found");

        return auctionIdToAuction[auctionId].endTime;
    }

    function onERC1155Received(
        address _operator,
        address,
        uint256,
        uint256,
        bytes calldata
    ) external view override returns (bytes4) {
        if (_operator == address(this)) {
            return this.onERC1155Received.selector;
        }

        return 0x0;
    }

    function onERC1155BatchReceived(
        address _operator,
        address,
        uint256[] calldata,
        uint256[] calldata,
        bytes calldata
    ) external view override returns (bytes4) {
        if (_operator == address(this)) {
            return this.onERC1155BatchReceived.selector;
        }

        return 0x0;
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        virtual
        override(AccessControlEnumerable, IERC165, ERC165)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
