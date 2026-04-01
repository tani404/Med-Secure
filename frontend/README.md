# MedSecure Frontend

React + Vite + Wagmi + Viem + RainbowKit frontend for the deployed `MedicineSupplyChain` contract.

## 1) Install Node.js

Install Node.js 20+ first (this machine currently has no `node`/`npm` in PATH).

## 2) Install dependencies

```bash
cd frontend
npm install
```

## 3) Configure env

```bash
cp .env.example .env
```

Fill:
- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_RPC_URL`

## 4) Run

```bash
npm run dev
```

## Implemented pages

- `/` landing page
- `/verify` verify/scan (`verifyUnit`)
- `/manufacturer` manufacturer dashboard (`owner`, `totalUnits`, `getAllBatchIds`, `paused`, `pause`, `unpause`)
- `/manufacturer/create` create batch (`manufactureUnit`)
- `/manufacturer/batches` batch listing (`getUnit`)
- `/manufacturer/assign` assign distributor (`transferToDistributor`)
- `/distributor` distributor dashboard (`getAllBatchIds`, `getUnit`)
- `/distributor/transfer` transfer to pharmacy (`transferToPharmacy`)
- `/pharmacy` pharmacy dashboard (`getAllBatchIds`, `getUnit`)
- `/pharmacy/sell` mark sold (`markAsSold`)
- `/batch/:batchId` unit detail + timeline (`getUnit`, `getUnitHistory`)

Contract address is configured in `src/config/contract.ts`.
