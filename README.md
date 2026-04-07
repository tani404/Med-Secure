<<<<<<< HEAD
# MedSecure - Pharmaceutical Supply Chain Verification Platform

## Table of Contents
- [Project Overview](#project-overview)
- [Step-by-Step Flow](#step-by-step-flow)
- [Technologies Used](#technologies-used)
- [Phase-Wise Distribution](#phase-wise-distribution)
- [Project Architecture](#project-architecture)
- [Quick Start](#quick-start)

---

## Project Overview

**MedSecure** is a comprehensive, blockchain-based pharmaceutical supply chain verification system that combines AI-powered medicine authentication with distributed ledger technology. The platform enables manufacturers, distributors, pharmacies, and consumers to track, verify, and authenticate medicines throughout the entire supply chain—from manufacturing to final sale.

### Key Features
1. **AI-Powered Medicine Detection**: Deep learning models (ResNet50, CLIP) with 98.44% accuracy
2. **Blockchain Supply Chain Tracking**: Immutable, transparent tracking of medicines across all actors
3. **Multi-Actor Ecosystem**: Support for manufacturers, distributors, pharmacies, and consumers
4. **Real-Time Verification**: Instant authentication via camera-based image analysis and blockchain lookup
5. **End-to-End Transparency**: Complete audit trail from manufacturing to consumer

---

## Step-by-Step Flow

### 1. **Manufacturing Phase**
- Manufacturer creates a batch of medicines with:
  - Batch ID (unique identifier)
  - Drug name and specifications
  - Manufacturing date & expiry date
  - IPFS hash (stores medicine metadata/images for reference)
- Batch is recorded on the blockchain (immutable record)
- Medicine units are assigned to batch

### 2. **Distribution Phase**
- Manufacturer transfers batch units to Distributors
- Smart contract updates status: `Manufactured` → `SentToDistributor`
- All distributors with assigned units can view batch details
- Blockchain maintains complete transfer history

### 3. **Pharmacy Phase**
- Distributor transfers batch units to Pharmacy
- Smart contract updates status: `SentToDistributor` → `SentToPharmacy`
- Pharmacy can view all assigned units in their dashboard
- Transfer timeline recorded on blockchain

### 4. **Consumer Verification Phase** (Two-pronged approach)

#### Path A: Quick Blockchain Lookup
- Consumer/Pharmacy staff scans batch ID (QR code or manual entry)
- Smart contract verifies on Sepolia testnet:
  - Batch exists and status is valid
  - Manufacturing & expiry dates are legitimate
  - Full transfer history is visible
- Instant verification result with supply chain transparency

#### Path B: Advanced AI-Powered Verification
- User uploads medicine image through web app
- **Backend API (ResNet50)**: FAST detection
  - Image preprocessing & normalization
  - ResNet50 model inference: Real/Fake classification
  - 98.44% accuracy, high confidence scoring
  - Detailed analysis generated
  - Result: Genuine/Counterfeit

- **Camera-Based Pipeline (Optional Advanced)**: COMPREHENSIVE verification
  - Image preprocessing & quality check
  - OCR (NVIDIA Nemotron-OCR-V1): Extract text from packaging
  - LLM Query Builder (Gemma 4 31B): Generate search queries from OCR text
  - Google Image Search: Fetch reference images of legitimate medicines
  - CLIP Embeddings: Convert images to vector representations
  - Cosine Similarity: Compare medicine against reference set
  - Confidence scoring & final verdict

### 5. **Sale & Completion**
- Pharmacy marks units as `Sold` once dispensed to consumer
- Final blockchain record confirms medicine left supply chain
- Consumer receives batch ID/QR code for future reference

---

## Technologies Used

### **Frontend** (`/frontend`)
| Layer | Technology | Purpose |
|-------|-----------|---------|
| UI Framework | React 18.3.1 | Component-based UI |
| Build Tool | Vite 5.4.10 | Fast bundling & development |
| Language | TypeScript 5.6.3 | Type-safe JavaScript |
| Styling | Tailwind CSS 3.4.19 | Utility-first CSS framework |
| Web3 Integration | Wagmi 2.12.25 | Ethereum wallet & contract interactions |
| Wallet Connection | RainbowKit 2.1.7 | User-friendly wallet connector |
| HTTP Client | Viem 2.21.45 | Low-level Ethereum operations |
| Routing | React Router 6.28.0 | Client-side navigation |
| State Management | TanStack React Query 5.59.0 | Server state management |
| Animation | Framer Motion 12.38.0 | Smooth UI animations |
| Utilities | Clsx, Tailwind Merge | CSS class management |

### **Backend API** (`/ai-mediii`)
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Framework | FastAPI 0.135.1 | Modern Python web framework |
| Server | Uvicorn 0.41.0 | ASGI web server |
| Deep Learning | PyTorch 2.10.0 | Neural network framework |
| Model | ResNet50 + Custom Layers | 98.44% accuracy medicine detection |
| Image Processing | TorchVision 0.25.0, Pillow 12.1.1 | Image loading & preprocessing |
| Array Operations | NumPy 2.4.2 | Numerical computations |

**Model Performance**:
- Accuracy: 98.44%
- Precision: 99.65%
- Recall: 97.91%
- F1-Score: 98.77%

### **Blockchain** (`/smart-contracts`)
| Component | Technology | Purpose |
|-----------|-----------|---------|
| Language | Solidity 0.8.20 | Smart contract development |
| Framework | Foundry | Ethereum contract testing & deployment |
| Security | OpenZeppelin | Audited security libraries |
| Features | Ownable, ReentrancyGuard, Pausable | Contract access control & safety |
| Network | Sepolia Testnet (11155111) | Ethereum test environment |

**Smart Contract Features**:
- Medicine Unit registration & tracking
- Supply chain status management (Manufactured → Distributor → Pharmacy → Sold)
- Actor role-based access control
- Complete transfer history & audit trail
- Emergency pause mechanism

### **AI Medicine Verifier** (`/camera_based_model/medicine-verifier`)
| Component | Technology | Purpose |
|-----------|-----------|---------|
| OCR | NVIDIA Nemotron-OCR-V1 | Extract text from medicine packaging |
| LLM | Gemma 4 31B IT (NVIDIA NIM) | Generate search queries from OCR |
| Image Search | Google Custom Search API | Fetch reference medicine images |
| Embeddings | OpenAI CLIP | Generate image vector embeddings |
| Similarity | Cosine Distance | Compare medicine against references |
| Cache | DiskCache 5.6.0 | Cache OCR & image search results |
| Transformers | HuggingFace Transformers 4.40.0+ | LLM & embedding models |

---

## Phase-Wise Distribution

### **PHASE 1: Foundation & Setup** (Weeks 1-2)
#### Frontend
- ✅ Project initialization (Vite + React + TypeScript)
- ✅ Tailwind CSS & component library setup
- ✅ Wagmi + RainbowKit wallet integration
- ✅ Basic page structure & routing

#### Backend
- ✅ FastAPI project setup
- ✅ ResNet50 model architecture design
- ✅ Training pipeline (assuming model trained separately)
- ✅ CORS middleware configuration

#### Blockchain
- ✅ Solidity contract development
- ✅ Core data structures (MedicineUnit, TransferEvent, Status)
- ✅ Role definitions (manufacturer, distributor, pharmacy)
- ✅ Foundry testing environment

#### AI/Verifier
- ✅ Project scaffolding
- ✅ API key configuration structure (.env setup)
- ✅ Dependency management

---

### **PHASE 2: Core Features Implementation** (Weeks 3-5)

#### Frontend
- ✅ Landing page & UI components
- ✅ Manufacturer dashboard
  - Create batch: `manufactureUnit()`
  - View batches: `getUnit()`
  - Assign distributor: `transferToDistributor()`
  - Batch listing with filters
- ✅ Distributor dashboard
  - View assigned batches
  - Transfer to pharmacy: `transferToPharmacy()`
  - Batch details & history
- ✅ Pharmacy dashboard
  - View assigned units
  - Mark as sold: `markAsSold()`
  - Unit tracking & timeline
- ✅ Consumer verification page
  - QR code scanner or batch ID input
  - Supply chain transparency view
  - Image upload for AI verification

#### Backend
- ✅ Model loading & inference endpoints
- ✅ `/predict` endpoint (ResNet50 inference)
- ✅ Image preprocessing pipeline
- ✅ Confidence scoring & analysis generation
- ✅ `/health` & `/model-info` endpoints
- ✅ Error handling & validation
- ✅ Model accuracy testing endpoint

#### Blockchain
- ✅ `manufactureUnit()` - Create batch with metadata
- ✅ `transferToDistributor()` - Transfer units to distributor
- ✅ `transferToPharmacy()` - Transfer units to pharmacy
- ✅ `markAsSold()` - Mark units as sold
- ✅ `verifyUnit()` - Consumer verification logic
- ✅ Query functions: `getUnit()`, `getUnitHistory()`, `getAllBatchIds()`
- ✅ Event logging for all state changes
- ✅ Security modifiers: `onlyOwner`, `nonReentrant`, `whenNotPaused`

#### AI/Verifier
- ✅ Image preprocessing module
- ✅ OCR integration (NVIDIA Nemotron)
- ✅ Query builder with LLM
- ✅ Google Image Search integration
- ✅ CLIP embedding generation
- ✅ Similarity matching pipeline

---

### **PHASE 3: Integration & Testing** (Weeks 6-7)

#### Frontend ↔ Backend
- ✅ API endpoint integration
- ✅ Image upload & prediction display
- ✅ Real-time confidence scoring UI
- ✅ Error handling & user feedback
- ✅ Loading states & animations

#### Frontend ↔ Blockchain
- ✅ Contract connection via Wagmi
- ✅ Wallet authentication flow
- ✅ Transaction signing & broadcasting
- ✅ State updates after blockchain confirmation
- ✅ Gas estimation & fee display
- ✅ Transaction history tracking

#### AI/Verifier ↔ Backend
- ✅ Advanced verification option (optional)
- ✅ Pipeline orchestration
- ✅ Result aggregation & confidence weighting
- ✅ Fallback strategies

#### Testing
- ✅ Unit tests (backend, smart contracts)
- ✅ Integration tests (API + blockchain)
- ✅ E2E tests (frontend user flows)
- ✅ Smart contract audit (security)
- ✅ Model accuracy validation

---

### **PHASE 4: Deployment & Optimization** (Weeks 8+)

#### Frontend Deployment
- Vercel / Netlify deployment
- Environment variable configuration
- Build optimization

#### Backend Deployment
- Render.com hosting (as configured in Procfile)
- GPU availability for model inference
- Load balancing & auto-scaling

#### Blockchain
- Sepolia testnet deployment
- Contract verification on block explorers
- Mainnet preparation (future)

#### Performance Optimization
- Frontend: Code splitting, lazy loading
- Backend: Model quantization, caching, batch processing
- Blockchain: Gas optimization, transaction batching

---

## Project Architecture

```
medsecure/
├── frontend/                          # React + Vite web application
│   ├── src/
│   │   ├── components/               # Reusable React components
│   │   ├── pages/                    # Page components (Dashboard, Verify, etc.)
│   │   ├── config/                   # Wagmi, contract config
│   │   ├── lib/                      # Utilities
│   │   └── App.tsx                   # Main app component
│   ├── package.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── ai-mediii/                        # FastAPI backend for ResNet50 detection
│   ├── api.py                        # FastAPI application & endpoints
│   ├── best_model.pth                # Trained ResNet50 model weights
│   ├── requirements.txt
│   └── (training data assumed external)
│
├── camera_based_model/
│   └── medicine-verifier/            # Advanced verification pipeline
│       ├── main.py                   # CLI entry point
│       ├── config.py                 # Configuration
│       ├── pipeline/                 # Verification pipeline stages
│       │   ├── preprocessor.py       # Image preprocessing
│       │   ├── ocr.py                # NVIDIA OCR integration
│       │   ├── query_builder.py      # LLM query generation
│       │   ├── image_search.py       # Google Image Search
│       │   ├── clip_embedder.py      # CLIP embeddings
│       │   ├── similarity.py         # Cosine similarity matching
│       │   └── fallback.py           # Fallback strategies
│       ├── models/                   # Model loaders
│       ├── cache/                    # Caching layer
│       ├── utils/                    # Helper utilities
│       ├── tests/                    # Unit tests
│       └── requirements.txt
│
├── smart-contracts/                  # Solidity contracts
│   ├── src/
│   │   └── MedicineSupplyChain.sol   # Main contract
│   ├── test/
│   │   └── MedSecureTest.t.sol       # Contract tests
│   ├── script/
│   │   └── DeployMedicineSupplyChain.s.sol
│   ├── foundry.toml
│   └── lib/                          # OpenZeppelin & Forge std
│
└── README.md                         # This file
=======
# MedSecure - Blockchain-Powered Pharmaceutical Verification Platform

> An end-to-end system combating counterfeit medicine through AI-powered image analysis, camera-based verification, and blockchain supply chain tracking on Ethereum.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Modules](#modules)
  - [AI-Mediii (Counterfeit Detection API)](#1-ai-mediii---counterfeit-detection-api)
  - [Camera-Based Medicine Verifier](#2-camera-based-medicine-verifier)
  - [Frontend (React + Web3)](#3-frontend---react--web3-dapp)
  - [Smart Contracts](#4-smart-contracts---solidity)
- [System Flow](#system-flow)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [1. Smart Contracts](#setup-smart-contracts)
  - [2. AI-Mediii API](#setup-ai-mediii-api)
  - [3. Camera-Based Verifier](#setup-camera-based-verifier)
  - [4. Frontend](#setup-frontend)
  - [5. Full-Stack (Single Command)](#full-stack-single-command)
- [API Reference](#api-reference)
- [Smart Contract Reference](#smart-contract-reference)
- [Frontend Pages & Routes](#frontend-pages--routes)
- [Model Performance](#model-performance)
- [Environment Variables](#environment-variables)
- [Project Structure](#project-structure)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**MedSecure** is a decentralized pharmaceutical supply chain verification platform that combines:

1. **Deep Learning (ResNet50)** - Binary classification of medicine images as Real or Fake with 98.44% accuracy
2. **Camera-Based Verification (CLIP + OCR + LLM)** - Multi-step pipeline that reads medicine packaging via camera, extracts text with OCR, searches reference images, and compares visual similarity using CLIP embeddings
3. **Blockchain Tracking (Solidity + Ethereum)** - Immutable on-chain record of every medicine batch from manufacturer to consumer
4. **Web3 Frontend (React + Wagmi)** - Modern dApp with role-based dashboards for manufacturers, distributors, pharmacies, and consumers

### The Problem

Counterfeit medicines kill over **1 million people annually** worldwide. Existing supply chains lack transparency, making it difficult to verify authenticity at any stage.

### The Solution

MedSecure provides a triple-layered verification approach:

| Layer | Method | Confidence |
|-------|--------|------------|
| **AI Image Analysis** | ResNet50 deep learning model analyzes packaging quality, label accuracy, print patterns | 98.44% accuracy |
| **Camera Verification** | OCR + CLIP pipeline compares real-world camera photos against verified reference images | Hybrid confidence scoring |
| **Blockchain Provenance** | On-chain tracking from manufacture to sale with immutable transfer history | Cryptographic proof |

---

## Architecture

```
                          +------------------+
                          |    Consumer /    |
                          |    End User      |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |                             |
            +-------v-------+           +--------v--------+
            |   Frontend    |           |  Camera-Based   |
            |  React dApp   |           |    Verifier     |
            | (Wagmi/Viem)  |           | (CLIP+OCR+LLM) |
            +-------+-------+           +--------+--------+
                    |                             |
         +----------+----------+                  |
         |                     |                  |
  +------v------+    +--------v--------+   +-----v------+
  | AI-Mediii   |    |   Ethereum      |   |  External  |
  | FastAPI     |    |   Sepolia       |   |  APIs      |
  | (ResNet50)  |    |  Smart Contract |   | (NVIDIA,   |
  |             |    | (Supply Chain)  |   |  Google,   |
  +-------------+    +-----------------+   |  SerpAPI)  |
                                           +------------+
>>>>>>> vraj
```

---

<<<<<<< HEAD
## Quick Start

### Prerequisites
- Node.js 20+
- Python 3.9+
- Foundry (for smart contracts)
- Git

### 1. Frontend Setup
```bash
cd frontend
npm install
cp .env.example .env
# Update VITE_WALLETCONNECT_PROJECT_ID and VITE_RPC_URL
npm run dev
```

### 2. Backend Setup
```bash
cd ../ai-mediii
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python api.py
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 3. Smart Contract Deployment
```bash
cd ../smart-contracts
forge install                    # Install dependencies
forge test                       # Run tests
forge script script/DeployMedicineSupplyChain.s.sol \
  --rpc-url $SEPOLIA_RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 4. AI Verifier (Optional)
```bash
cd ../camera_based_model/medicine-verifier
pip install -r requirements.txt
cp .env.example .env
# Configure NVIDIA_API_KEY, GOOGLE_API_KEY, GOOGLE_CSE_ID
python main.py --image ./test_medicine.jpg
=======
## Modules

### 1. AI-Mediii - Counterfeit Detection API

A FastAPI service powered by a fine-tuned **ResNet50** model that classifies medicine images as **Real** or **Fake**.

#### Model Architecture

```
ResNet50 (ImageNet backbone, weights retrained)
    └── Custom Fully-Connected Head:
        ├── Linear(2048 → 1024) + ReLU + Dropout(0.3)
        ├── Linear(1024 → 512)  + ReLU + Dropout(0.3)
        └── Linear(512 → 2)     → [Fake, Real]
```

#### Key Features

- **98.44% accuracy** on the test dataset (Precision: 99.65%, Recall: 97.91%, F1: 98.77)
- Accepts JPG, JPEG, PNG, BMP images (auto-resized to 224x224)
- Returns prediction, confidence percentage, probability distribution, and detailed human-readable analysis
- Risk level classification (Low / Medium / High)
- Auto-generated Swagger documentation at `/docs`
- Serves the built React frontend as an SPA fallback
- GPU acceleration when CUDA is available, falls back to CPU

#### Detailed Analysis Output

The API doesn't just return a label - it provides a full analysis including:
- **Summary**: Human-readable explanation of the classification decision
- **Reasons**: Multiple supporting factors (packaging patterns, color profiles, print quality, font rendering)
- **Risk Level**: `low` (Real + high confidence), `medium` (low confidence), `high` (Fake + high confidence)

---

### 2. Camera-Based Medicine Verifier

A sophisticated multi-step verification pipeline that takes a real-world camera photo of medicine packaging and determines its authenticity by comparing it against online reference images.

#### Pipeline Steps

```
Camera Photo
    │
    ▼
┌─────────────────────────┐
│ Step 1: Preprocessing    │  CLAHE contrast enhancement, resize to max 1024px
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 2: OCR              │  NVIDIA Nemotron-OCR-v1 (tries 4 rotations: 0°, 90°, 180°, 270°)
│  + LLM Rotation Select  │  Gemma 4 31B IT picks the best OCR result
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 3: Query Builder    │  Gemma 4 31B IT extracts: medicine name, dosage, form, manufacturer
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 4: Cache Check      │  SHA-256 keyed disk cache (24h TTL) — skips steps 5-6 on hit
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 5: Image Search     │  SerpAPI / Google Custom Search — primary + alt queries
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 6: Download & Embed │  Async parallel download (aiohttp) + CLIP embedding
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 7: Input Embedding  │  CLIP ViT-B/32 embedding of the camera photo
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Step 8: Similarity       │  Cosine similarity + hybrid confidence scoring
│  & Scoring               │  (60% CLIP visual + 40% text match)
└───────────┬─────────────┘
            ▼
┌─────────────────────────┐
│ Result                   │  verified (≥0.60) / possible (≥0.45) / rejected (<0.45)
└─────────────────────────┘
```

#### Key Features

- **Multi-rotation OCR** - Handles photos taken at any angle
- **LLM-powered extraction** - Gemma 4 31B IT intelligently parses pharmaceutical text from OCR output
- **Hybrid confidence scoring** - Combines visual similarity (CLIP) with text matching for robust results
- **Smart caching** - Persistent disk cache with SHA-256 keys avoids redundant API calls
- **Async downloads** - Parallel reference image fetching via aiohttp
- **Fallback pipeline** - Direct CLIP matching if OCR fails entirely
- **Debug mode** - Saves all intermediate outputs (preprocessed image, OCR text, search results, final scores)

#### Confidence Thresholds

| Score | Status | Meaning |
|-------|--------|---------|
| >= 0.60 | `verified` | High confidence - medicine matches known references |
| >= 0.45 | `possible` | Moderate confidence - some visual/text matches found |
| < 0.45 | `rejected` | Low confidence - significant deviations detected |

#### Output Example

```json
{
  "medicine": "Paracetamol 500mg Tablet",
  "confidence": 0.7234,
  "clip_score": 0.6891,
  "status": "verified",
  "matched_reference": "https://example.com/paracetamol-ref.jpg",
  "ocr_raw": "Paracetamol Tablets IP 500 mg ...",
  "medicine_info": {
    "name": "Paracetamol",
    "dosage": "500mg",
    "form": "Tablet",
    "manufacturer": "Cipla Ltd"
  },
  "pipeline_time_s": 4.321
}
```

---

### 3. Frontend - React + Web3 dApp

A modern, animated single-page application built with React 18 and Wagmi for blockchain interaction.

#### Tech Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| React | 18.3.1 | UI framework |
| TypeScript | 5.6.3 | Type safety |
| Vite | 5.4.10 | Build tool & dev server |
| Tailwind CSS | 3.4.19 | Utility-first styling |
| Framer Motion | 12.38.0 | Page transitions & animations |
| Wagmi | 2.12.25 | React hooks for Ethereum |
| Viem | 2.21.45 | Type-safe Ethereum RPC client |
| RainbowKit | 2.1.7 | Wallet connection UI (MetaMask, WalletConnect, etc.) |
| TanStack React Query | 5.59.0 | Async state management |
| React Router | 6.28.0 | Client-side routing |

#### UI Features

- **Splash Screen** - Animated loading screen on first visit
- **Custom Cursor** - Branded pointer styling
- **Page Transitions** - Smooth Framer Motion animations between routes
- **Infinite Grid Background** - Animated grid with spotlight effect
- **Role-Based Navigation** - Dynamic menus based on user role (Manufacturer / Distributor / Pharmacy / Consumer)
- **Responsive Design** - Mobile-first Tailwind CSS layout

#### Role-Based Access

The frontend implements a role portal system where users select their role after connecting their wallet:

| Role | Capabilities |
|------|-------------|
| **Manufacturer** | Create batches, view owned batches, assign to distributors |
| **Distributor** | View received batches, transfer to pharmacies, timeline lookup |
| **Pharmacy** | View inventory, mark medicines as sold, timeline lookup |
| **Consumer** | Verify medicine authenticity by batch ID |

---

### 4. Smart Contracts - Solidity

An Ethereum smart contract that provides an immutable, transparent supply chain ledger.

#### Contract: `MedicineSupplyChain.sol`

- **Network**: Ethereum Sepolia Testnet
- **Address**: `0x6E20534957053a52237501Dc752e62C060bECD6A`
- **Solidity**: ^0.8.20
- **Framework**: Foundry (Forge)

#### Inherited Contracts (OpenZeppelin)

| Contract | Purpose |
|----------|---------|
| `Ownable` | Owner-only access control (manufacturer = deployer) |
| `ReentrancyGuard` | Prevents reentrancy attacks on state-changing functions |
| `Pausable` | Emergency pause mechanism for the contract owner |

#### Supply Chain Flow

```
Manufacturer                Distributor               Pharmacy                 Consumer
     │                           │                        │                        │
     │  manufactureUnit()        │                        │                        │
     │──────────────────►        │                        │                        │
     │  Status: Manufactured     │                        │                        │
     │                           │                        │                        │
     │  transferToDistributor()  │                        │                        │
     │──────────────────────────►│                        │                        │
     │  Status: SentToDistributor│                        │                        │
     │                           │                        │                        │
     │                           │ transferToPharmacy()   │                        │
     │                           │───────────────────────►│                        │
     │                           │ Status: SentToPharmacy │                        │
     │                           │                        │                        │
     │                           │                        │  markAsSold()          │
     │                           │                        │───────────────────────►│
     │                           │                        │  Status: Sold          │
     │                           │                        │                        │
     │                           │                        │          verifyUnit()  │
     │                           │                        │◄────────────────────── │
     │                           │                        │  Returns authenticity  │
```

#### On-Chain Data Model

```solidity
struct MedicineUnit {
    uint256 batchId;            // Unique identifier
    string  drugName;           // Medicine name
    string  ipfsHash;           // IPFS metadata link
    address distributor;        // Assigned distributor
    address pharmacy;           // Assigned pharmacy
    address currentOwner;       // Current holder
    uint256 manufacturingDate;  // Unix timestamp
    uint256 expiryDate;         // Unix timestamp
    Status  status;             // Manufactured → SentToDistributor → SentToPharmacy → Sold
}

struct TransferEvent {
    address from;               // Sender address
    address to;                 // Receiver address
    Status  status;             // Status at time of transfer
    uint256 timestamp;          // Block timestamp
}
```

#### Custom Errors (Gas-Efficient)

The contract uses 14 custom Solidity errors instead of `require` strings, saving gas:

```
InvalidManufacturer, CallerIsNotManufacturer, CallerIsNotDistributor,
CallerIsNotPharmacy, InvalidBatchId, InvalidDrugName, InvalidIPFSHash,
InvalidExpiryDate, InvalidManufacturingDate, InvalidStatus,
InvalidAddress, BatchAlreadyExists, BatchNotFound
```

---

## System Flow

### Complete Verification Journey

```
1. MANUFACTURER creates a batch on-chain
   ├── Batch ID, drug name, IPFS hash, manufacturing/expiry dates
   └── Emits: UnitManufactured event

2. MANUFACTURER transfers to DISTRIBUTOR
   ├── Assigns distributor address
   └── Emits: TransferredToDistributor event

3. DISTRIBUTOR transfers to PHARMACY
   ├── Assigns pharmacy address
   └── Emits: TransferredToPharmacy event

4. PHARMACY marks as SOLD
   └── Emits: UnitSold event

5. CONSUMER verifies medicine:
   ├── Option A: Enter Batch ID → blockchain lookup (verifyUnit)
   ├── Option B: Upload photo → AI-Mediii ResNet50 classification
   └── Option C: Camera photo → OCR + CLIP verification pipeline
```

---

## Tech Stack

### Backend & AI

| Component | Technology |
|-----------|-----------|
| Counterfeit Detection Model | PyTorch 2.10.0 + ResNet50 |
| Camera OCR | NVIDIA Nemotron-OCR-v1 (NIM API) |
| LLM Query Builder | Google Gemma 4 31B IT (NIM API) |
| Visual Similarity | OpenAI CLIP ViT-B/32 |
| API Framework | FastAPI 0.135.1 |
| Image Processing | Pillow 12.1.1 + CLAHE |
| Async Downloads | aiohttp 3.9.0 |
| Image Search | SerpAPI / Google Custom Search |
| Caching | diskcache (LRU, disk-based) |

### Frontend

| Component | Technology |
|-----------|-----------|
| Framework | React 18.3.1 + TypeScript 5.6.3 |
| Build Tool | Vite 5.4.10 |
| Styling | Tailwind CSS 3.4.19 |
| Animations | Framer Motion 12.38.0 |
| Web3 | Wagmi 2.12.25 + Viem 2.21.45 |
| Wallet UI | RainbowKit 2.1.7 |
| Routing | React Router 6.28.0 |

### Blockchain

| Component | Technology |
|-----------|-----------|
| Language | Solidity ^0.8.20 |
| Framework | Foundry (Forge + Anvil) |
| Network | Ethereum Sepolia Testnet |
| Libraries | OpenZeppelin Contracts (Ownable, ReentrancyGuard, Pausable) |

---

## Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **Python** >= 3.10
- **Foundry** (for smart contract development) - [Install Guide](https://book.getfoundry.sh/getting-started/installation)
- **MetaMask** or any EVM wallet with Sepolia ETH
- API Keys:
  - [NVIDIA NIM](https://build.nvidia.com/) - For OCR and Gemma LLM
  - [Google Custom Search](https://developers.google.com/custom-search/v1/overview) or [SerpAPI](https://serpapi.com/) - For reference image search
  - [WalletConnect](https://cloud.walletconnect.com/) - For wallet connection

---

### Setup Smart Contracts

```bash
cd Med-Secure/smart-contracts

# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Deploy to Sepolia (set your private key)
forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC --broadcast
```

> The contract is already deployed at `0x6E20534957053a52237501Dc752e62C060bECD6A` on Sepolia.

---

### Setup AI-Mediii API

```bash
cd Med-Secure/ai-mediii

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Dependencies:**
```
torch==2.10.0
torchvision==0.25.0
Pillow==12.1.1
fastapi==0.135.1
uvicorn==0.41.0
python-multipart==0.0.22
numpy==2.4.2
```

**Run the server:**
```bash
# Development
python api.py

# Production
uvicorn api:app --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.

---

### Setup Camera-Based Verifier

```bash
cd Med-Secure/camera_based_model/medicine-verifier

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

**Configure environment variables:**
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
NVIDIA_API_KEY=your_nvidia_nim_ocr_api_key
NVIDIA_GEMMA_API_KEY=your_nvidia_nim_gemma_api_key
GOOGLE_API_KEY=your_google_api_key
GOOGLE_CSE_ID=your_custom_search_engine_id
SERPAPI_KEY=your_serpapi_key          # Optional: alternative to Google CSE
```

**Run verification:**
```bash
# Basic verification
python main.py --image ./medicine_photo.jpg

# With debug output (saves intermediate results)
python main.py --image ./medicine_photo.jpg --debug

# JSON output (for programmatic use)
python main.py --image ./medicine_photo.jpg --json
```

**Run tests:**
```bash
pytest tests/ -v
```

---

### Setup Frontend

```bash
cd Med-Secure/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
```

Edit `.env`:
```env
VITE_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
VITE_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your_alchemy_key
```

**Run development server:**
```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`.

**Build for production:**
```bash
npm run build
npm run preview
>>>>>>> vraj
```

---

<<<<<<< HEAD
## API Endpoints

### Backend API (FastAPI)
- `GET /api` - API information
- `GET /health` - Health check
- `GET /model-info` - Model performance metrics
- `POST /predict` - Upload image for prediction
- `GET /test` - Run model accuracy test
- `GET /docs` - Swagger UI documentation

### Smart Contract Functions

**Manufacturer**:
- `manufactureUnit()` - Create new batch
- `transferToDistributor()` - Assign to distributor
- `pause()` / `unpause()` - Emergency controls

**Distributor**:
- `transferToPharmacy()` - Send to pharmacy

**Pharmacy**:
- `markAsSold()` - Complete sale

**Consumer**:
- `verifyUnit()` - Verify batch authenticity

**Query Functions** (All):
- `getUnit()` - Get unit details
- `getUnitHistory()` - Get transfer timeline
- `getAllBatchIds()` - List all batches
=======
### Full-Stack (Single Command)

The AI-Mediii API can serve both the API and the built frontend:

```bash
# 1. Build the frontend
cd Med-Secure/frontend && npm run build && cd ..

# 2. Start the combined server
cd ai-mediii && python api.py
```

This serves the React SPA at `http://localhost:8000` with the AI API endpoints available at the same origin.

---

## API Reference

### AI-Mediii Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api` | API welcome & endpoint listing |
| `GET` | `/health` | Health check (model status, device info) |
| `GET` | `/model-info` | Model metrics (accuracy, precision, recall, F1) |
| `POST` | `/predict` | Upload image for Real/Fake classification |
| `GET` | `/test` | Run accuracy test on the test dataset |
| `GET` | `/docs` | Interactive Swagger UI documentation |
| `GET` | `/redoc` | ReDoc API documentation |

### POST `/predict` - Classify Medicine Image

**Request:**
```bash
curl -X POST http://localhost:8000/predict \
  -F "file=@medicine.jpg"
```

**Response:**
```json
{
  "filename": "medicine.jpg",
  "prediction": "Real",
  "confidence": "97.83%",
  "probabilities": {
    "fake": 2.17,
    "real": 97.83
  },
  "analysis": {
    "summary": "The uploaded medicine image has been classified as GENUINE with 97.8% confidence...",
    "reasons": [
      "Packaging patterns and label alignment match known authentic pharmaceutical standards.",
      "Strong visual similarity to verified genuine samples...",
      "Label formatting and packaging structure align with authentic production standards."
    ],
    "risk_level": "low"
  },
  "device": "cuda"
}
```

### GET `/model-info` - Model Metrics

```json
{
  "model": "ResNet50",
  "classes": ["Fake", "Real"],
  "accuracy": "98.44%",
  "precision": "99.65%",
  "recall": "97.91%",
  "f1_score": "98.77",
  "input_size": [224, 224],
  "framework": "PyTorch",
  "device": "cuda"
}
```

---

## Smart Contract Reference

### Write Functions

| Function | Access | Description |
|----------|--------|-------------|
| `manufactureUnit(batchId, drugName, mfgDate, expDate, ipfsHash)` | Manufacturer only | Register a new medicine batch |
| `transferToDistributor(batchId, distributor)` | Manufacturer only | Transfer batch to a distributor |
| `transferToPharmacy(batchId, pharmacy)` | Distributor only | Transfer batch to a pharmacy |
| `markAsSold(batchId)` | Pharmacy only | Mark batch as sold to consumer |
| `pause()` / `unpause()` | Owner only | Emergency circuit breaker |

### Read Functions

| Function | Returns | Description |
|----------|---------|-------------|
| `verifyUnit(batchId)` | `(drugName, expiryDate, ipfsHash, owner, status, isExpired, isSold, isAuthentic)` | Full verification check |
| `getUnit(batchId)` | `MedicineUnit` | Complete unit data |
| `getUnitHistory(batchId)` | `TransferEvent[]` | Full transfer event history |
| `getAllBatchIds()` | `uint256[]` | All registered batch IDs |
| `totalUnits()` | `uint256` | Total number of units |

### Events

```solidity
event UnitManufactured(uint256 indexed batchId, string drugName, address indexed manufacturer, string ipfsHash, uint256 expiryDate, uint256 timestamp);
event TransferredToDistributor(uint256 indexed batchId, address indexed from, address indexed distributor, uint256 timestamp);
event TransferredToPharmacy(uint256 indexed batchId, address indexed from, address indexed pharmacy, uint256 timestamp);
event UnitSold(uint256 indexed batchId, address indexed pharmacy, uint256 timestamp);
```

---

## Frontend Pages & Routes

| Route | Page | Role | Description |
|-------|------|------|-------------|
| `/` | Landing Page | Public | Hero section, features overview, call-to-action |
| `/portal` | Role Portal | All | Select role (Manufacturer / Distributor / Pharmacy / Consumer) |
| `/verify` | Verify Medicine | Consumer | Enter batch ID to verify authenticity on-chain |
| `/manufacturer/create` | Create Batch | Manufacturer | Register new medicine batches on-chain |
| `/manufacturer/batches` | My Batches | Manufacturer | View all manufactured batches |
| `/manufacturer/assign` | Assign Distributor | Manufacturer | Transfer batch to a distributor |
| `/distributor` | Distributor Dashboard | Distributor | Overview of received batches |
| `/distributor/transfer` | Transfer to Pharmacy | Distributor | Send batch to pharmacy |
| `/distributor/timeline` | Batch Timeline | Distributor | Visual timeline of batch transfers |
| `/pharmacy` | Pharmacy Dashboard | Pharmacy | Overview of pharmacy inventory |
| `/pharmacy/sell` | Mark as Sold | Pharmacy | Mark medicine as sold to consumer |
| `/pharmacy/timeline` | Batch Timeline | Pharmacy | Visual timeline of batch transfers |
| `/batch/:batchId` | Batch Detail | All | Detailed view of a specific batch |
>>>>>>> vraj

---

## Model Performance

<<<<<<< HEAD
| Metric | ResNet50 Backend |
|--------|------------------|
| Accuracy | 98.44% |
| Precision | 99.65% |
| Recall | 97.91% |
| F1-Score | 98.77% |

---

## Security Considerations

1. **Smart Contract**: Audited OpenZeppelin contracts, reentrancy guards, pausable mechanism
2. **Backend**: Input validation, CORS configuration, model integrity checks
3. **Frontend**: Wallet verification, transaction confirmation, secure key management
4. **Supply Chain**: Immutable blockchain records, role-based access control

---

## Future Enhancements

- Mobile app (React Native)
- QR code generation for batches
- Advanced analytics dashboard
- Mainnet deployment
- Real-time notifications
- Integration with regulatory authorities
- Multi-language support
=======
### ResNet50 Counterfeit Detection (AI-Mediii)

| Metric | Score |
|--------|-------|
| **Accuracy** | 98.44% |
| **Precision** | 99.65% |
| **Recall** | 97.91% |
| **F1 Score** | 98.77 |
| **Input Size** | 224 x 224 RGB |
| **Model Size** | ~125 MB (`best_model.pth`) |
| **Framework** | PyTorch 2.10.0 |
| **Inference** | CPU + CUDA GPU supported |

### Camera-Based Verifier (CLIP Pipeline)

| Component | Model / Service |
|-----------|----------------|
| **OCR** | NVIDIA Nemotron-OCR-v1 (NIM API) |
| **Rotation Selection** | Google Gemma 4 31B IT |
| **Query Builder** | Google Gemma 4 31B IT |
| **Visual Embedding** | OpenAI CLIP ViT-B/32 (512-dim) |
| **Scoring** | Cosine similarity + hybrid confidence (60% visual / 40% text) |
| **Cache** | diskcache LRU, SHA-256 keys, 24h TTL |

---

## Environment Variables

### Frontend (`frontend/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project ID | Yes |
| `VITE_RPC_URL` | Ethereum Sepolia RPC endpoint (e.g., Alchemy) | Yes |

### Camera-Based Verifier (`camera_based_model/medicine-verifier/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NVIDIA_API_KEY` | NVIDIA NIM API key for OCR model | Yes |
| `NVIDIA_GEMMA_API_KEY` | NVIDIA NIM API key for Gemma LLM | Yes |
| `GOOGLE_API_KEY` | Google Custom Search API key | Yes* |
| `GOOGLE_CSE_ID` | Google Custom Search Engine ID | Yes* |
| `SERPAPI_KEY` | SerpAPI key (alternative to Google CSE) | Yes* |

> \* Either Google CSE credentials OR SerpAPI key is required.

---

## Project Structure

```
Med-Secure/
│
├── ai-mediii/                              # ResNet50 Counterfeit Detection API
│   ├── api.py                              # FastAPI application (endpoints + model inference)
│   ├── best_model.pth                      # Trained ResNet50 weights (~125MB)
│   ├── requirements.txt                    # Python dependencies
│   ├── render.yaml                         # Render.com deployment config
│   ├── Procfile                            # Process file for deployment
│   ├── build.sh                            # Build script
│   └── README.md                           # Module documentation
│
├── camera_based_model/
│   └── medicine-verifier/                  # Camera-Based Verification Pipeline
│       ├── main.py                         # CLI entry point & orchestrator
│       ├── config.py                       # Configuration (API keys, thresholds, models)
│       ├── pipeline/
│       │   ├── preprocessor.py             # CLAHE enhancement + resize
│       │   ├── ocr.py                      # Multi-rotation OCR (Nemotron + Gemma)
│       │   ├── query_builder.py            # LLM-based pharmaceutical text extraction
│       │   ├── image_search.py             # SerpAPI / Google CSE integration
│       │   ├── clip_embedder.py            # CLIP model singleton & embedding
│       │   ├── similarity.py               # Cosine similarity & hybrid scoring
│       │   └── fallback.py                 # Direct CLIP matching fallback
│       ├── cache/
│       │   └── cache_manager.py            # Persistent disk cache (SHA-256 keys)
│       ├── models/
│       │   └── clip_model.py               # CLIP model/processor loader
│       ├── utils/
│       │   ├── image_utils.py              # Async image downloading
│       │   └── logger.py                   # Logging configuration
│       ├── tests/                          # Unit tests (pytest)
│       ├── requirements.txt                # Python dependencies
│       ├── .env.example                    # Environment variable template
│       └── README.md                       # Module documentation
│
├── frontend/                               # React + Web3 dApp
│   ├── src/
│   │   ├── main.tsx                        # App entry (WagmiProvider + RainbowKit + Router)
│   │   ├── App.tsx                         # Animated routes + splash screen
│   │   ├── components/
│   │   │   ├── Layout.tsx                  # Navigation + role-based menus
│   │   │   └── ui/
│   │   │       ├── splash-screen.tsx       # Animated loading screen
│   │   │       ├── custom-cursor.tsx       # Custom pointer
│   │   │       ├── motion.tsx              # Framer Motion animation components
│   │   │       └── the-infinite-grid.tsx   # Animated background grid
│   │   ├── pages/
│   │   │   └── Pages.tsx                   # All 14 page components
│   │   ├── config/
│   │   │   ├── contract.ts                 # Smart contract ABI & address
│   │   │   └── wagmi.ts                    # Wagmi/RainbowKit configuration
│   │   ├── lib.ts                          # Utility functions
│   │   └── index.css                       # Tailwind CSS + custom styles
│   ├── package.json                        # NPM dependencies
│   ├── vite.config.ts                      # Vite build configuration
│   ├── tsconfig.json                       # TypeScript configuration
│   ├── tailwind.config.js                  # Tailwind CSS configuration
│   ├── .env.example                        # Environment variable template
│   └── README.md                           # Module documentation
│
├── smart-contracts/                        # Solidity Smart Contracts
│   ├── src/
│   │   └── MedicineSupplyChain.sol         # Main supply chain contract
│   ├── test/                               # Forge tests
│   ├── script/                             # Deployment scripts
│   ├── lib/
│   │   └── openzeppelin-contracts/         # OpenZeppelin (git submodule)
│   ├── foundry.toml                        # Foundry configuration
│   └── README.md                           # Module documentation
│
├── .gitignore                              # Git ignore rules
├── .gitmodules                             # Git submodules (OpenZeppelin)
└── README.md                               # This file
```

---

## Security

### Smart Contract Security

- **Access Control** - Role-based modifiers (`onlyManufacturer`, `onlyDistributor`, `onlyPharmacy`) enforce that only authorized addresses can execute supply chain operations
- **Reentrancy Protection** - `ReentrancyGuard` on all state-changing transfer functions
- **Pausable** - Emergency pause mechanism allows the contract owner to freeze all operations
- **Custom Errors** - Gas-efficient error handling with 14 custom error types
- **Input Validation** - Checks for zero addresses, duplicate batch IDs, invalid dates, and invalid state transitions

### API Security

- **CORS** - Configured on the FastAPI server (currently open for development)
- **File Validation** - Only accepted image formats (JPG, JPEG, PNG, BMP) are processed
- **No Direct Key Exposure** - All API keys loaded from environment variables, never committed to git

### Frontend Security

- **Wallet-Based Auth** - No passwords or sessions; all authentication is via cryptographic wallet signatures
- **Role Gating** - Frontend enforces role-based navigation (manufacturer, distributor, pharmacy, consumer)
- **No Private Keys** - Private keys never leave the user's wallet; all signing is delegated to the wallet provider via Wagmi/Viem
>>>>>>> vraj

---

## Contributing

<<<<<<< HEAD
Please submit pull requests with clear descriptions of changes. Ensure tests pass and code follows project conventions.
=======
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request
>>>>>>> vraj

---

## License

<<<<<<< HEAD
All components are subject to their respective licenses (check individual directories).

---

**MedSecure Team** | April 2026
=======
This project is licensed under the MIT License.
>>>>>>> vraj
