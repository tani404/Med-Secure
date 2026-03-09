// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MedicineSupplyChain {

    enum Role { None, Manufacturer, Distributor, Pharmacy }
    enum Status { Manufactured, InTransit, ForSale, Sold }

    struct Batch {
        string batchId;
        string ipfsHash;
        address manufacturer;
        address currentOwner;
        uint256 expiryDate;
        Status status;
        bool exists;
    }

    mapping(string => Batch) private batches;
    mapping(address => Role) public roles;

    address public admin;

    event BatchRegistered(string batchId, address manufacturer);
    event OwnershipTransferred(string batchId, address from, address to);
    event MedicineVerified(string batchId, address verifier);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyManufacturer() {
        require(roles[msg.sender] == Role.Manufacturer, "Not manufacturer");
        _;
    }

    modifier batchExists(string memory batchId) {
        require(batches[batchId].exists, "Batch does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    function assignRole(address user, Role role) external onlyAdmin {
        roles[user] = role;
    }

    function registerBatch(
        string calldata batchId,
        string calldata ipfsHash,
        uint256 expiryDate
    ) external onlyManufacturer {

        require(!batches[batchId].exists, "Batch already exists");

        batches[batchId] = Batch({
            batchId: batchId,
            ipfsHash: ipfsHash,
            manufacturer: msg.sender,
            currentOwner: msg.sender,
            expiryDate: expiryDate,
            status: Status.Manufactured,
            exists: true
        });

        emit BatchRegistered(batchId, msg.sender);
    }

    function transferOwnership(
        string calldata batchId,
        address newOwner
    ) external batchExists(batchId) {

        Batch storage batch = batches[batchId];
        require(msg.sender == batch.currentOwner, "Not current owner");

        batch.currentOwner = newOwner;
        batch.status = Status.InTransit;

        emit OwnershipTransferred(batchId, msg.sender, newOwner);
    }

    function markForSale(string calldata batchId)
        external
        batchExists(batchId)
    {
        Batch storage batch = batches[batchId];
        require(msg.sender == batch.currentOwner, "Not owner");
        batch.status = Status.ForSale;
    }

    function verifyMedicine(string calldata batchId)
        external
        view
        batchExists(batchId)
        returns (
            bool valid,
            address currentOwner,
            uint256 expiryDate,
            string memory ipfsHash
        )
    {
        Batch memory batch = batches[batchId];

        bool notExpired = block.timestamp < batch.expiryDate;
        bool notSold = batch.status != Status.Sold;

        return (
            batch.exists && notExpired && notSold,
            batch.currentOwner,
            batch.expiryDate,
            batch.ipfsHash
        );
    }

    function markAsSold(string calldata batchId)
        external
        batchExists(batchId)
    {
        Batch storage batch = batches[batchId];
        require(msg.sender == batch.currentOwner, "Not owner");
        batch.status = Status.Sold;
    }
}
