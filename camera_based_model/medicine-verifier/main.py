#!/usr/bin/env python3
"""
Medicine Verification System — Entry Point & Orchestrator.

Pipeline:
    Camera Image -> Preprocessing -> OCR (nemotron-ocr-v1, multi-rotation)
    -> Query Builder (Claude Haiku) -> SerpAPI Image Search
    -> Fetch Reference Images -> CLIP Embeddings -> Cosine Similarity
    -> Authenticity Check (Claude Haiku) + Forensics (print quality)
    -> Final 4-signal Confidence Score -> Output

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
from pipeline.image_search import search_images_async
from pipeline.clip_embedder import CLIPEmbedder
from pipeline.similarity import find_best_match, compute_final_score
from pipeline.authenticity_checker import check_authenticity
from pipeline.forensics import run_forensics
from pipeline.fallback import fallback_clip_match
from utils.image_utils import download_images_async, download_image_async
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
    embedder: "CLIPEmbedder",
) -> tuple[list[str], list]:
    """Search with primary + alt queries, download, and embed all references.

    Args:
        embedder: Shared CLIPEmbedder instance (avoids loading the model twice).

    Returns:
        Tuple of (ref_urls, ref_embeddings) where each URL corresponds to
        the embedding at the same index.
    """
    all_urls: list[str] = []
    seen_urls: set[str] = set()

    # Search primary query (async — does not block event loop)
    logger.info("Searching images for primary query: '%s'", query)
    try:
        urls = await search_images_async(query, top_k=top_k)
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
            urls = await search_images_async(alt_q, top_k=3)
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

    # Download all reference images in parallel; track which URLs succeeded
    import aiohttp
    final_urls: list[str] = []
    ref_images = []
    async with aiohttp.ClientSession() as session:
        raw_results = await asyncio.gather(
            *[download_image_async(session, u) for u in all_urls],
            return_exceptions=True,
        )
    for url, result in zip(all_urls, raw_results):
        if isinstance(result, Exception):
            logger.error("Skipping reference image %s: %s", url, result)
        else:
            final_urls.append(url)
            ref_images.append(result)

    if not ref_images:
        return [], []

    ref_embeddings = embedder.embed_images(ref_images)
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
        ocr_text = await run_ocr(image)
    except OcrFailedException as exc:
        logger.warning("OCR failed (%s) — falling back to direct CLIP match", exc)
        result = fallback_clip_match(image)
        result["pipeline_time_s"] = round(time.perf_counter() - t0, 3)
        return result

    if debug:
        _save_debug("ocr_raw", {"ocr_text": ocr_text}, debug_dir)

    # ── Step 3: Build search query (with Gemma medicine extraction) ────
    logger.info("Step 3  Building search query")
    query_info = await build_query(ocr_text)
    query = query_info["primary_query"]
    alt_queries = query_info["alt_queries"]
    medicine_name = query_info["medicine_name"]
    dosage = query_info["dosage"]
    form = query_info["form"]
    manufacturer = query_info["manufacturer"]

    if debug:
        _save_debug("query", {
            "primary_query": query,
            "alt_queries": alt_queries,
            "medicine_info": query_info,
            "ocr_text": ocr_text,
        }, debug_dir)

    # ── Step 4: Check cache ─────────────────────────────────────────────
    logger.info("Step 4  Checking cache")

    # Create the single CLIPEmbedder instance used for both reference and input
    embedder = CLIPEmbedder()

    cache = CacheManager()
    try:
        cache_hit = cache.get(query)

        if cache_hit:
            ref_urls: list[str] = cache_hit["urls"]
            ref_embeddings: list = cache_hit["embeddings"]
            logger.info("Using %d cached reference embeddings", len(ref_embeddings))
        else:
            # ── Step 5+6: Search, download & embed references ──────────────
            logger.info("Step 5-6  Searching, downloading & embedding references")
            ref_urls, ref_embeddings = await _collect_reference_images(
                query, alt_queries, TOP_K_IMAGES, debug, debug_dir, embedder,
            )

            if not ref_urls:
                logger.warning("No reference images found for any query")
                return {
                    "medicine": " ".join(filter(None, [medicine_name, dosage or None, form])).strip(),
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
        input_embedding = embedder.embed_image(image)

        # ── Step 8: Similarity & scoring ────────────────────────────────────
        logger.info("Step 8  Computing similarity")
        clip_score, best_idx = find_best_match(input_embedding, ref_embeddings)
        best_ref_url = ref_urls[best_idx] if best_idx < len(ref_urls) else ""

        # ── Step 9: Authenticity check + Forensics (run in parallel) ───────
        logger.info("Step 9  Running authenticity check + packaging forensics")
        loop = asyncio.get_running_loop()
        auth_result, forensics_result = await asyncio.gather(
            check_authenticity(ocr_text),
            loop.run_in_executor(None, run_forensics, image),
        )

        if debug:
            _save_debug("authenticity", auth_result, debug_dir)
            _save_debug("forensics", forensics_result, debug_dir)

        # ── Step 10: Final 4-signal confidence score ────────────────────────
        logger.info("Step 10  Computing final confidence (4 signals)")
        confidence, status = compute_final_score(
            clip_score=clip_score,
            medicine_name=medicine_name,
            ref_url=best_ref_url,
            all_ref_urls=ref_urls,
            authenticity_score=auth_result["authenticity_score"],
            forensics_score=forensics_result["forensics_score"],
        )

        medicine_label = " ".join(filter(None, [medicine_name, dosage or None, form])).strip()

        result = {
                "medicine": medicine_label,
                "confidence": round(confidence, 4),
                "clip_score": round(clip_score, 4),
                "status": status,
                "matched_reference": best_ref_url or None,
                "all_ref_urls": ref_urls,
                "ocr_raw": ocr_text,
                "medicine_info": {
                    "name": medicine_name,
                    "dosage": dosage,
                    "form": form,
                    "manufacturer": manufacturer,
                },
                "authenticity": {
                    "score": auth_result["authenticity_score"],
                    "verdict": auth_result["verdict"],
                    "summary": auth_result["summary"],
                    "red_flags": auth_result["red_flags"],
                    "green_flags": auth_result["green_flags"],
                },
                "forensics": {
                    "score": forensics_result["forensics_score"],
                    "findings": forensics_result["findings"],
                    "sharpness": forensics_result["sharpness"],
                    "color_uniformity": forensics_result["color_uniformity"],
                    "noise": forensics_result["noise"],
                    "contrast": forensics_result["contrast"],
                },
                "pipeline_time_s": round(time.perf_counter() - t0, 3),
            }

        if debug:
            _save_debug("final_result", result, debug_dir)

        logger.info("Pipeline complete in %.2fs", result["pipeline_time_s"])
        return result
    finally:
        cache.close()


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

    print(f"  CLIP Score  : {result.get('clip_score', 0.0):.4f}")
    print(f"  Reference   : {result.get('matched_reference', 'N/A')}")
    print(f"  OCR Raw     : {result.get('ocr_raw', 'N/A')[:120]}")

    auth = result.get("authenticity", {})
    if auth:
        auth_colour = {"authentic": "\033[92m", "suspicious": "\033[93m", "likely_fake": "\033[91m"}
        auth_badge = auth_colour.get(auth.get("verdict", ""), "") + auth.get("verdict", "?").upper() + reset
        print(f"  Auth Verdict: {auth_badge}  (score={auth.get('score', 0):.4f})")
        if auth.get("red_flags"):
            for flag in auth["red_flags"]:
                print(f"    \033[91m[!] {flag}\033[0m")
        if auth.get("green_flags"):
            for flag in auth["green_flags"]:
                print(f"    \033[92m[+] {flag}\033[0m")
        if auth.get("summary"):
            print(f"  Auth Summary: {auth['summary']}")

    forensics = result.get("forensics", {})
    if forensics:
        fscore = forensics.get("score", 0.5)
        f_colour = "\033[92m" if fscore >= 0.6 else ("\033[93m" if fscore >= 0.4 else "\033[91m")
        print(f"  Forensics   : {f_colour}{fscore:.4f}\033[0m  "
              f"(sharp={forensics.get('sharpness',0):.2f} "
              f"color={forensics.get('color_uniformity',0):.2f} "
              f"noise={forensics.get('noise',0):.2f} "
              f"contrast={forensics.get('contrast',0):.2f})")
        for finding in forensics.get("findings", []):
            print(f"    \033[91m[!] {finding}\033[0m")

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
