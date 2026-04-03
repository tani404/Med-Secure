# Medicine Verification System

A production-grade pipeline that verifies medicines from camera images using OCR, LLM-powered query building, Google Image Search, and CLIP visual similarity.

## Pipeline

```
Camera Image → Preprocessing → OCR (nemotron-ocr-v1)
→ Query Builder (Gemma 4 31B IT) → Google Image Search
→ Fetch Reference Images → CLIP Embeddings → Cosine Similarity
→ Confidence Scoring → Final Output
```

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Configure API keys

```bash
cp .env.example .env
# Edit .env with your actual keys
```

| Key | Source |
|-----|--------|
| `NVIDIA_API_KEY` | [NVIDIA NIM](https://build.nvidia.com/) — for OCR (nemotron-ocr-v1) and Gemma 4 31B IT |
| `GOOGLE_API_KEY` | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `GOOGLE_CSE_ID` | [Programmable Search Engine](https://programmablesearchengine.google.com/) — enable "Image search" |

## Usage

### Basic

```bash
python main.py --image ./test_medicine.jpg
```

### JSON output

```bash
python main.py --image ./test_medicine.jpg --json
```

### Debug mode (saves intermediate outputs)

```bash
python main.py --image ./test_medicine.jpg --debug
```

Debug outputs are saved to `.debug_output/`:
- `preprocessed.png` — contrast-enhanced image
- `ocr_raw.json` — raw OCR text
- `query.json` — cleaned search query
- `search_results.json` — reference image URLs
- `final_result.json` — complete result

## Example Output

```json
{
  "medicine": "paracetamol 500mg tablet strip",
  "confidence": 0.91,
  "status": "verified",
  "matched_reference": "https://...",
  "ocr_raw": "Paraceta mol IP 500",
  "pipeline_time_s": 4.23
}
```

### Confidence Statuses

| Status | Threshold | Meaning |
|--------|-----------|---------|
| `verified` | >= 0.85 | High confidence match |
| `possible` | >= 0.70 | Moderate confidence — manual review recommended |
| `rejected` | < 0.70 | No reliable match found |

## Project Structure

```
medicine-verifier/
├── main.py                  # Entry point & orchestrator
├── config.py                # API keys, thresholds, model names
├── pipeline/
│   ├── preprocessor.py      # Image preprocessing
│   ├── ocr.py               # OCR via nemotron-ocr-v1 (NVIDIA NIM)
│   ├── query_builder.py     # Gemma 4 31B IT query normalisation
│   ├── image_search.py      # Google Custom Search API
│   ├── clip_embedder.py     # CLIP embedding engine
│   ├── similarity.py        # Cosine similarity + confidence scoring
│   └── fallback.py          # Direct CLIP fallback if OCR fails
├── cache/
│   └── cache_manager.py     # Query → images → embeddings caching
├── models/
│   └── clip_model.py        # CLIP model loader (singleton)
├── utils/
│   ├── image_utils.py       # Download, resize, normalise images
│   └── logger.py            # Structured logging with timestamps
├── tests/
│   ├── test_similarity.py   # Cosine similarity & scoring tests
│   ├── test_query_builder.py # Query builder tests (mocked API)
│   └── test_preprocessor.py # Image preprocessing tests
├── requirements.txt
├── .env.example
└── README.md
```

## Running Tests

```bash
pip install pytest
pytest tests/ -v
```

## Tech Stack

- **CLIP**: `openai/clip-vit-base-patch32` via HuggingFace Transformers
- **OCR**: NVIDIA `nemotron-ocr-v1` via NIM API
- **Query Builder**: `google/gemma-4-31b-it` via NVIDIA NIM API
- **Image Search**: Google Custom Search JSON API (image mode)
- **Caching**: `diskcache` (persistent, SHA-256 keyed, 24h TTL)
- **Async**: `aiohttp` for parallel reference image downloads
