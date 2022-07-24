// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.1;

import "./IProposal.sol";
import "./Asset.sol";
import "./libraries/Structs.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "hardhat/console.sol";

contract ProposalSale is ERC1155Holder {
    Asset public asset;
    uint256 public totalLists = 0;
    // saleId => List
    mapping(uint256 => Structs.List) public lists;

    // saleId => proposalId => Proposals
    mapping(uint256 => mapping(uint256 => Structs.Proposals)) public proposals;

    //saleId => buyer => proposalId
    mapping(uint256 => mapping(address => uint256)) public activeProposals;

    // saleId => proposals
    mapping(uint256 => uint256) public proposalsIdCounter;

    event List(uint256 saleId, address seller, uint256 assetId, uint256 amount);
    event Propose(
        uint256 saleId,
        uint256 proposalId,
        address seller,
        address buyer,
        uint256 assetId,
        uint256 amount,
        uint256 price
    );
    event Accept(
        uint256 saleId,
        uint256 proposalId,
        address seller,
        address buyer,
        uint256 assetId,
        uint256 amount,
        uint256 price
    );
    event ListingEnded(uint256 saleId);
    event Cancel(
        uint256 saleId,
        address seller,
        uint256 assetId,
        uint256 amount
    );
    event CancelProposal(
        uint256 saleId,
        uint256 proposalId,
        address seller,
        address buyer,
        uint256 assetId
    );

    constructor(address _assetAddr) {
        asset = Asset(_assetAddr);
    }

    modifier checkAmount(uint256 _amount) {
        require(_amount > 0, "Invalid amount");
        _;
    }

    modifier checkValidProposal(
        uint256 _saleId,
        uint256 _amount,
        uint256 _price
    ) {
        require(_price % _amount == 0, "Total price not divisible by amount");
        require(lists[_saleId].seller != address(0), "Invalid asset");
        require(lists[_saleId].amount >= _amount, "Invalid amount");
        require(lists[_saleId].seller != msg.sender, "Invalid proposal");
        _;
    }

    modifier checkValidAcceptance(uint256 _saleId, uint256 _proposalId) {
        require(lists[_saleId].amount != 0, "Invalid asset");
        require(
            proposals[_saleId][_proposalId].buyer != address(0),
            "Invalid proposal amount"
        );
        _;
    }

    modifier checkCancel(uint256 _saleId) {
        require(lists[_saleId].seller == msg.sender, "Invalid listing");
        require(lists[_saleId].amount != 0, "Invalid listing");
        _;
    }

    modifier checkCancelProposal(uint256 _saleId, uint256 _proposalId) {
        require(
            proposals[_saleId][_proposalId].buyer == msg.sender,
            "Not your proposal"
        );
        _;
    }

    function list(uint256 _assetId, uint256 _amount)
        external
        checkAmount(_amount)
    {
        asset.safeTransferFrom(
            msg.sender,
            address(this),
            _assetId,
            _amount,
            ""
        );

        lists[totalLists] = Structs.List(msg.sender, _assetId, _amount);
        emit List(totalLists, msg.sender, _assetId, _amount);
        totalLists++;
    }

    function propose(uint256 _saleId, uint256 _amount)
        external
        payable
        checkAmount(_amount)
        checkValidProposal(_saleId, _amount, msg.value)
        returns (bool)
    {
        Structs.List memory _list = lists[_saleId];
        if (
            activeProposals[_saleId][msg.sender] == 0 &&
            proposals[_saleId][0].buyer != msg.sender
        ) {
            uint256 _proposalId = proposalsIdCounter[_saleId];

            proposals[_saleId][proposalsIdCounter[_saleId]] = Structs.Proposals(
                msg.sender,
                msg.value,
                _amount
            );

            emit Propose(
                _saleId,
                _proposalId,
                _list.seller,
                msg.sender,
                _list.assetId,
                _amount,
                msg.value
            );

            activeProposals[_saleId][msg.sender] = _proposalId;
            _proposalId++;
            proposalsIdCounter[_saleId] = _proposalId;
        } else {
            uint256 _proposalId = activeProposals[_saleId][msg.sender];
            Structs.Proposals memory _proposal = proposals[_saleId][
                _proposalId
            ];

            uint256 _price = _proposal.price;
            _proposal.amount = _amount;
            _proposal.price = msg.value;
            _proposal.buyer = msg.sender;
            proposals[_saleId][_proposalId] = _proposal;

            payable(_proposal.buyer).transfer(_price);

            emit Propose(
                _saleId,
                _proposalId,
                _list.seller,
                msg.sender,
                _list.assetId,
                _amount,
                msg.value
            );
        }
        return true;
    }

    function accept(uint256 _saleId, uint256 _proposalId)
        external
        checkValidAcceptance(_saleId, _proposalId)
        returns (bool)
    {
        Structs.Proposals memory _proposal = proposals[_saleId][_proposalId];
        Structs.List memory _list = lists[_saleId];

        asset.safeTransferFrom(
            address(this),
            _proposal.buyer,
            _list.assetId,
            _proposal.amount,
            ""
        );

        delete proposals[_saleId][_proposalId];
        lists[_saleId] = Structs.List(_list.seller, _list.assetId, 0);
        emit Accept(
            _saleId,
            _proposalId,
            _list.seller,
            _proposal.buyer,
            _list.assetId,
            _proposal.amount,
            _proposal.price
        );
        emit ListingEnded(_saleId);
        payable(_list.seller).transfer(_proposal.price);
        return true;
    }

    function cancelListing(uint256 _saleId) external checkCancel(_saleId) {
        Structs.List memory _list = lists[_saleId];
        asset.safeTransferFrom(
            address(this),
            _list.seller,
            _list.assetId,
            _list.amount,
            ""
        );

        lists[_saleId] = Structs.List(_list.seller, _list.assetId, 0);
        emit Cancel(_saleId, _list.seller, _list.assetId, _list.amount);
    }

    function cancelPropose(uint256 _saleId, uint256 _proposalId)
        external
        checkCancelProposal(_saleId, _proposalId)
    {
        Structs.Proposals memory _proposal = proposals[_saleId][_proposalId];
        Structs.List memory _list = lists[_saleId];
        delete proposals[_saleId][_proposalId];
        emit CancelProposal(
            _saleId,
            _proposalId,
            _list.seller,
            _proposal.buyer,
            _list.assetId
        );
        payable(_proposal.buyer).transfer(_proposal.price);
    }
}
