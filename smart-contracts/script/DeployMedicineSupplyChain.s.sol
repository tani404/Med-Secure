// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {MedicineSupplyChain} from "../src/MedicineSupplyChain.sol";

contract DeployMedicineSupplyChain is Script{
function run() external returns(MedicineSupplyChain){
    vm.startBroadcast();
    MedicineSupplyChain medSecure = new MedicineSupplyChain();
    vm.stopBroadcast();

    return medSecure;
}
}