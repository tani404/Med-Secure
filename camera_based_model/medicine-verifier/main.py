#!/usr/bin/env python3
"""
Medicine Verification System — Entry Point & Orchestrator.

Pipeline:
    Camera Image -> Preprocessing -> OCR (nemotron-ocr-v1, multi-rotation)
    -> Query Builder (Gemma 4 31B IT) -> SerpAPI Image Search
    -> Fetch Reference Images -> CLIP Embeddings -> Cosine Similarity
    -> Confidence Scoring -> Final Output

Usage:
    python main.py --image ./test_medicine.jpg
    python main.py --image ./test_medicine.jpg --debug
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from config import DEBUG_OUTPUT_DIR, TOP_K_IMAGES
from cache.cache_manager import CacheManager
from pipeline.preprocessor import preprocess
from pipeline.ocr import run_ocr, OcrFailedException
from pipeline.query_builder import build_query
from pipeline.image_search import search_images
from pipeline.clip_embedder import CLIPEmbedder
from pipeline.similarity import find_best_match, score_to_status, compute_hybrid_confidence
from pipeline.fallback import fallback_clip_match
from utils.image_utils import download_images_async
from utils.logger import get_logger

logger = get_logger("main")


def _save_debug(tag: str, data: object, debug_dir: str) -> None:
    """Persist an intermediate result to the debug output directory."""
    os.makedirs(debug_dir, exist_ok=True)
    path = os.path.join(debug_dir, f"{tag}.json")
    with open(path, "w") as fh:
        json.dump(data, fh, indent=2, default=str)
    logger.info("Debug output saved -> %s", path)


async def _collect_reference_images(
    query: str,
    alt_queries: list[str],
    top_k: int,
    debug: bool,
    debug_dir: str,
) -> tuple[list[str], list]:
    """Search with primary + alt queries, download, and embed all references.

    Returns:
        Tuple of (all_urls, all_embeddings).
    """
    all_urls: list[str] = []
    seen_urls: set[str] = set()

    # Search primary query
    logger.info("Searching images for primary query: '%s'", query)
    try:
        urls = search_images(query, top_k=top_k)
        for u in urls:
            if u not in seen_urls:
                all_urls.append(u)
                seen_urls.add(u)
    except Exception as exc:
        logger.warning("Primary search failed: %s", exc)

    # Search alt queries for more reference diversity
    for alt_q in alt_queries[:2]:
        if not alt_q:
            continue
        logger.info("Searching images for alt query: '%s'", alt_q)
        try:
            urls = search_images(alt_q, top_k=3)
            for u in urls:
                if u not in seen_urls:
                    all_urls.append(u)
                    seen_urls.add(u)
        except Exception as exc:
            logger.warning("Alt search for '%s' failed: %s", alt_q, exc)

    if debug:
        _save_debug("search_results", {"query": query, "alt_queries": alt_queries, "urls": all_urls}, debug_dir)

    logger.info("Total unique reference URLs: %d", len(all_urls))

    if not all_urls:
        return [], []

    # Download all reference images in parallel
    ref_images = await download_images_async(all_urls)
    if not ref_images:
        return [], []

    # Embed references
    embedder = CLIPEmbedder()
    ref_embeddings = embedder.embed_images(ref_images)

    # Keep only urls that successfully downloaded (same count as ref_images)
    final_urls = all_urls[: len(ref_images)]

    return final_urls, ref_embeddings


async def verify_medicine(
    image_path: str,
    *,
    debug: bool = False,
) -> dict:
    """Run the full medicine-verification pipeline.

    Args:
        image_path: Path to the medicine package image.
        debug: If ``True``, save intermediate outputs to disk.

    Returns:
        A dict containing ``medicine``, ``confidence``, ``status``,
        ``matched_reference``, and ``ocr_raw``.
    """
    t0 = time.perf_counter()
    debug_dir = DEBUG_OUTPUT_DIR

    # ── Step 1: Preprocess ──────────────────────────────────────────────
    logger.info("Step 1  Preprocessing image")
    image = preprocess(image_path)
    if debug:
        debug_image_path = os.path.join(debug_dir, "preprocessed.png")
        os.makedirs(debug_dir, exist_ok=True)
        image.save(debug_image_path)
        logger.info("Debug: saved preprocessed image -> %s", debug_image_path)

    # ── Step 2: OCR (multi-rotation with LLM selection) ────────────────
    logger.info("Step 2  Running OCR (multi-rotation)")
    try:
        ocr_text = run_ocr(image)
    except OcrFailedException as exc:
        logger.warning("OCR failed (%s) — falling back to direct CLIP match", exc)
        result = fallback_clip_match(image)
        result["pipeline_time_s"] = round(time.perf_counter() - t0, 3)
        return result

    if debug:
        _save_debug("ocr_raw", {"ocr_text": ocr_text}, debug_dir)

    # ── Step 3: Build search query (with Gemma medicine extraction) ────
    logger.info("Step 3  Building search query")
    query = build_query(ocr_text)
    alt_queries = getattr(build_query, "_last_alt_queries", [])
    medicine_info = getattr(build_query, "_last_medicine_info", {})

    medicine_name = medicine_info.get("medicine_name", query)
    dosage = medicine_info.get("dosage", "")
    form = medicine_info.get("form", "")
    manufacturer = medicine_info.get("manufacturer")

    if debug:
        _save_debug("query", {
            "primary_query": query,
            "alt_queries": alt_queries,
            "medicine_info": medicine_info,
            "ocr_text": ocr_text,
        }, debug_dir)

    # ── Step 4: Check cache ─────────────────────────────────────────────
    logger.info("Step 4  Checking cache")
    cache = CacheManager()
    cache_hit = cache.get(query)

    if cache_hit:
        ref_urls: list[str] = cache_hit["urls"]
        ref_embeddings: list = cache_hit["embeddings"]
        logger.info("Using %d cached reference embeddings", len(ref_embeddings))
    else:
        # ── Step 5+6: Search, download & embed references ──────────────
        logger.info("Step 5-6  Searching, downloading & embedding references")
        ref_urls, ref_embeddings = await _collect_reference_images(
            query, alt_queries, TOP_K_IMAGES, debug, debug_dir,
        )

        if not ref_urls:
            logger.warning("No reference images found for any query")
            return {
                "medicine": f"{medicine_name} {dosage} {form}".strip(),
                "confidence": 0.0,
                "status": "rejected",
                "matched_reference": None,
                "ocr_raw": ocr_text,
                "note": "No reference images found via image search",
                "pipeline_time_s": round(time.perf_counter() - t0, 3),
            }

        cache.set(query, ref_urls, ref_embeddings)

    # ── Step 7: Embed input image ───────────────────────────────────────
    logger.info("Step 7  Embedding input image")
    embedder = CLIPEmbedder()
    input_embedding = embedder.embed_image(image)

    # ── Step 8: Similarity & scoring ────────────────────────────────────
    logger.info("Step 8  Computing similarity")
    clip_score, best_idx = find_best_match(input_embedding, ref_embeddings)
    best_ref_url = ref_urls[best_idx] if best_idx < len(ref_urls) else ""

    # Hybrid confidence: CLIP visual (60%) + text match in URL (40%)
    confidence = compute_hybrid_confidence(clip_score, medicine_name, best_ref_url, ref_urls)
    status = score_to_status(confidence)

    medicine_label = f"{medicine_name} {dosage} {form}".strip()

    result = {
        "medicine": medicine_label,
        "confidence": round(confidence, 4),
        "clip_score": round(clip_score, 4),
        "status": status,
        "matched_reference": best_ref_url or None,
        "ocr_raw": ocr_text,
        "medicine_info": {
            "name": medicine_name,
            "dosage": dosage,
            "form": form,
            "manufacturer": manufacturer,
        },
        "pipeline_time_s": round(time.perf_counter() - t0, 3),
    }

    if debug:
        _save_debug("final_result", result, debug_dir)

    cache.close()
    logger.info("Pipeline complete in %.2fs", result["pipeline_time_s"])
    return result


# ── CLI ─────────────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Medicine Verification System — verify medicine packages from camera images.",
    )
    parser.add_argument(
        "--image",
        required=True,
        help="Path to the medicine package image.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        default=False,
        help="Save intermediate pipeline outputs to .debug_output/",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        default=False,
        dest="json_output",
        help="Output raw JSON instead of formatted text.",
    )
    return parser


def _print_result(result: dict, as_json: bool = False) -> None:
    """Pretty-print the verification result."""
    if as_json:
        print(json.dumps(result, indent=2))
        return

    status = result["status"]
    colour = {"verified": "\033[92m", "possible": "\033[93m", "rejected": "\033[91m"}
    reset = "\033[0m"
    badge = colour.get(status, "") + status.upper() + reset

    print()
    print("=" * 55)
    print("       MEDICINE VERIFICATION RESULT")
    print("=" * 55)
    print(f"  Medicine    : {result.get('medicine', 'N/A')}")
    print(f"  Status      : {badge}")
    print(f"  Confidence  : {result.get('confidence', 0.0):.4f}")

    info = result.get("medicine_info", {})
    if info.get("manufacturer"):
        print(f"  Manufacturer: {info['manufacturer']}")

    print(f"  Reference   : {result.get('matched_reference', 'N/A')}")
    print(f"  OCR Raw     : {result.get('ocr_raw', 'N/A')[:120]}")
    if "pipeline_time_s" in result:
        print(f"  Time        : {result['pipeline_time_s']}s")
    if "note" in result:
        print(f"  Note        : {result['note']}")
    print("=" * 55)
    print()


def main() -> None:
    """CLI entry point."""
    parser = _build_parser()
    args = parser.parse_args()

    image_path = args.image
    if not os.path.isfile(image_path):
        print(f"Error: image file not found: {image_path}", file=sys.stderr)
        sys.exit(1)

    result = asyncio.run(verify_medicine(image_path, debug=args.debug))
    _print_result(result, as_json=args.json_output)


if __name__ == "__main__":
    main()
