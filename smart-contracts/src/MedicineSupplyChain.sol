// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title MedSecure
 * @notice Blockchain-based pharmaceutical supply chain verification system
 * @dev Tracks medicine units from manufacturer → distributor → pharmacy → consumer
 */
contract MedicineSupplyChain is Ownable, ReentrancyGuard, Pausable {
    error InvalidManufacturer();
    error CallerIsNotManufacturer();
    error CallerIsNotDistributor();
    error CallerIsNotPharmacy();
    error InvalidBatchId();
    error InvalidDrugName();
    error InvalidIPFSHash();
    error InvalidExpiryDate();
    error InvalidManufacturingDate();
    error InvalidStatus();
    error InvalidAddress();

    enum Status {
        Manufactured,
        SentToDistributor,
        SentToPharmacy,
        Sold
    }

    struct MedicineUnit { 
        uint256 batchId;
        string  drugName;
        string  ipfsHash;
        address distributor;
        address pharmacy;
        address currentOwner;
        uint256 manufacturingDate;
        uint256 expiryDate;
        Status  status;
    }

    struct TransferEvent {
        address from;
        address to;
        Status  status;
        uint256 timestamp;
    }

    address private manufacturer;
    mapping(uint256  => MedicineUnit)      private units;
    mapping(uint256  => TransferEvent[])   private unitHistory;

    uint256[] private allBatchIds;

    event UnitManufactured(
        uint256  indexed batchId,
        string          drugName,
        address indexed manufacturer,
        string          ipfsHash,
        uint256         expiryDate,
        uint256         timestamp
    );
    event TransferredToDistributor(
        uint256  indexed batchId,
        address indexed from,
        address indexed distributor,
        uint256         timestamp
    );
    event TransferredToPharmacy(
        uint256  indexed batchId,
        address indexed from,
        address indexed pharmacy,
        uint256         timestamp
    );

    event UnitSold(
        uint256  indexed batchId,
        address indexed pharmacy,
        uint256         timestamp
    );

    modifier onlyManufacturer() {
        if(msg.sender != manufacturer){
            revert CallerIsNotManufacturer();
        }
        _;
    }
    modifier onlyDistributor(uint256 _batchId) {
        if(msg.sender != units[_batchId].distributor){
            revert CallerIsNotDistributor();
        }
        _;
    }
    modifier onlyPharmacy(uint256 _batchId) {
        if(msg.sender != units[_batchId].pharmacy){
            revert CallerIsNotPharmacy();
        }
        _;
    }

    constructor() Ownable(msg.sender) {
        manufacturer = msg.sender;
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function manufactureUnit(
        uint256 _batchId,
        string memory _drugName,
        uint256 _manufacturingDate,
        uint256 _expiryDate,
        string memory _ipfsHash
    ) external whenNotPaused {
        if(msg.sender != manufacturer){
            revert InvalidManufacturer();
        }

        if(_batchId <= 0){
            revert InvalidBatchId();
        }           
        if(bytes(_drugName).length <= 0){
            revert InvalidDrugName();
        }          
        if(bytes(_ipfsHash).length <= 0){
            revert InvalidIPFSHash();
        }
        if(_expiryDate <= block.timestamp){
            revert InvalidExpiryDate();
        }        
        if(_manufacturingDate > block.timestamp){
            revert InvalidManufacturingDate();
        }

        units[_batchId] = MedicineUnit({
            batchId:           _batchId,
            drugName:          _drugName,
            ipfsHash:          _ipfsHash,
            distributor:       address(0),
            pharmacy:          address(0),
            currentOwner:      msg.sender,
            manufacturingDate: _manufacturingDate,
            expiryDate:        _expiryDate,
            status:            Status.Manufactured
        });

        allBatchIds.push(_batchId);

        unitHistory[_batchId].push(TransferEvent({
            from:      address(0),
            to:        manufacturer,
            status:    Status.Manufactured,
            timestamp: block.timestamp
        }));

        emit UnitManufactured(_batchId, _drugName, manufacturer, _ipfsHash, _expiryDate, block.timestamp);
    }

    function transferToDistributor(
        uint256 _batchId,
        address _distributor
    ) external onlyManufacturer() nonReentrant whenNotPaused {
        if(units[_batchId].status != Status.Manufactured){
            revert InvalidStatus();
        }

        if(address(_distributor) == address(0)){
            revert InvalidAddress();
        }

        units[_batchId].currentOwner = _distributor;
        units[_batchId].distributor  = _distributor;
        units[_batchId].status       = Status.SentToDistributor;

        unitHistory[_batchId].push(TransferEvent({
            from:      msg.sender,
            to:        _distributor,
            status:    Status.SentToDistributor,
            timestamp: block.timestamp
        }));

        emit TransferredToDistributor(_batchId, msg.sender, _distributor, block.timestamp);
    }

    function transferToPharmacy(
        uint256 _batchId,
        address _pharmacy
    ) external onlyDistributor(_batchId) nonReentrant whenNotPaused {
        if(address(_pharmacy) == address(0)){
            revert InvalidAddress();
        }

        if (msg.sender != units[_batchId].currentOwner) {
            revert CallerIsNotDistributor();
        }
        
        if(units[_batchId].status != Status.SentToDistributor){
            revert InvalidStatus();
        }

        units[_batchId].currentOwner = _pharmacy;
        units[_batchId].pharmacy     = _pharmacy;
        units[_batchId].status       = Status.SentToPharmacy;

        unitHistory[_batchId].push(TransferEvent({
            from:      msg.sender,
            to:        _pharmacy,
            status:    Status.SentToPharmacy,
            timestamp: block.timestamp
        }));

        emit TransferredToPharmacy(_batchId, msg.sender, _pharmacy, block.timestamp);
    }

    function markAsSold(uint256 _batchId)
        external onlyPharmacy(_batchId) nonReentrant whenNotPaused
    {

        units[_batchId].status = Status.Sold;

        unitHistory[_batchId].push(TransferEvent({
            from:      msg.sender,
            to:        address(0),
            status:    Status.Sold,
            timestamp: block.timestamp
        }));

        emit UnitSold(_batchId, msg.sender, block.timestamp);
    }

    /**getters */

    function verifyUnit(uint256 _batchId)
        external view
        returns (
            string  memory drugName,
            uint256        expiryDate,
            string  memory ipfsHash,
            address        currentOwner,
            Status         status,
            bool           isExpired,
            bool           isAlreadySold,
            bool           isAuthentic
        )
    {
        MedicineUnit storage u = units[_batchId];

        if (u.manufacturingDate == 0) {
            return ("", 0, "", address(0), Status.Manufactured, false, false, false);
        }

        bool expired = block.timestamp > u.expiryDate;
        bool sold    = u.status == Status.Sold;
        return (
            u.drugName,
            u.expiryDate,
            u.ipfsHash,
            u.currentOwner,
            u.status,
            expired,
            sold,
            !expired && !sold 
        );
    }

    function getUnit(uint256 _batchId)
        external view 
        returns (MedicineUnit memory)
    {
        return units[_batchId];
    }

    function getUnitHistory(uint256 _batchId)
        external view 
        returns (TransferEvent[] memory)
    {
        return unitHistory[_batchId];
    }


    function totalUnits() external view returns (uint256) {
        return allBatchIds.length;
    }

    function getAllBatchIds() external view returns (uint256[] memory) {
        return allBatchIds;
    }
}