export const CONTRACT_ADDRESS = "0x6E20534957053a52237501Dc752e62C060bECD6A" as const;

/**
 * Full ABI for MedicineSupplyChain + common OpenZeppelin reverts (Ownable, Pausable).
 * Custom errors must be listed so viem can decode revert data (e.g. 0x7c78338b → InvalidManufacturingDate).
 * Source: smart-contracts/src/MedicineSupplyChain.sol
 */
export const medicineSupplyChainAbi = [
  { type: "function", name: "getAllBatchIds", inputs: [], outputs: [{ type: "uint256[]" }], stateMutability: "view" },
  {
    type: "function",
    name: "getUnit",
    inputs: [{ name: "_batchId", type: "uint256" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "batchId", type: "uint256" },
          { name: "drugName", type: "string" },
          { name: "ipfsHash", type: "string" },
          { name: "distributor", type: "address" },
          { name: "pharmacy", type: "address" },
          { name: "currentOwner", type: "address" },
          { name: "manufacturingDate", type: "uint256" },
          { name: "expiryDate", type: "uint256" },
          { name: "status", type: "uint8" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "getUnitHistory",
    inputs: [{ name: "_batchId", type: "uint256" }],
    outputs: [
      {
        type: "tuple[]",
        components: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "status", type: "uint8" },
          { name: "timestamp", type: "uint256" }
        ]
      }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "manufactureUnit",
    inputs: [
      { name: "_batchId", type: "uint256" },
      { name: "_drugName", type: "string" },
      { name: "_manufacturingDate", type: "uint256" },
      { name: "_expiryDate", type: "uint256" },
      { name: "_ipfsHash", type: "string" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  { type: "function", name: "markAsSold", inputs: [{ name: "_batchId", type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "owner", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { type: "function", name: "pause", inputs: [], outputs: [], stateMutability: "nonpayable" },
  { type: "function", name: "paused", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "totalUnits", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "transferToDistributor",
    inputs: [
      { name: "_batchId", type: "uint256" },
      { name: "_distributor", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferToPharmacy",
    inputs: [
      { name: "_batchId", type: "uint256" },
      { name: "_pharmacy", type: "address" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  { type: "function", name: "unpause", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "verifyUnit",
    inputs: [{ name: "_batchId", type: "uint256" }],
    outputs: [
      { name: "drugName", type: "string" },
      { name: "expiryDate", type: "uint256" },
      { name: "ipfsHash", type: "string" },
      { name: "currentOwner", type: "address" },
      { name: "status", type: "uint8" },
      { name: "isExpired", type: "bool" },
      { name: "isAlreadySold", type: "bool" },
      { name: "isAuthentic", type: "bool" }
    ],
    stateMutability: "view"
  },
  { type: "error", name: "InvalidManufacturer", inputs: [] },
  { type: "error", name: "CallerIsNotManufacturer", inputs: [] },
  { type: "error", name: "CallerIsNotDistributor", inputs: [] },
  { type: "error", name: "CallerIsNotPharmacy", inputs: [] },
  { type: "error", name: "InvalidBatchId", inputs: [] },
  { type: "error", name: "InvalidDrugName", inputs: [] },
  { type: "error", name: "InvalidIPFSHash", inputs: [] },
  { type: "error", name: "InvalidExpiryDate", inputs: [] },
  { type: "error", name: "InvalidManufacturingDate", inputs: [] },
  { type: "error", name: "InvalidStatus", inputs: [] },
  { type: "error", name: "InvalidAddress", inputs: [] },
  { type: "error", name: "BatchAlreadyExists", inputs: [] },
  { type: "error", name: "BatchNotFound", inputs: [] },
  { type: "error", name: "EnforcedPause", inputs: [] },
  {
    type: "error",
    name: "OwnableUnauthorizedAccount",
    inputs: [{ name: "account", type: "address" }]
  }
] as const;

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
