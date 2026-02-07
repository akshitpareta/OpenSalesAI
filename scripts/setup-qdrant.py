#!/usr/bin/env python3
"""
Qdrant vector database setup script for OpenSalesAI.

Creates the three core collections (store_profiles, product_catalog,
sales_playbooks) and ingests sample data with embeddings.

Usage:
    python scripts/setup-qdrant.py [--qdrant-url http://localhost:6333]
                                    [--reset]
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import uuid
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
logger = logging.getLogger(__name__)


# ── Sample Data ──────────────────────────────────────────────────────────────

SAMPLE_STORES = [
    {
        "id": str(uuid.uuid4()),
        "content": "Sharma General Store is a medium-sized kirana store in Sector 22, Noida. "
                   "Specialises in daily essentials and packaged foods. Owner: Rajesh Sharma. "
                   "High footfall area near a residential colony. Prefers weekly deliveries. "
                   "Top categories: beverages, snacks, personal care. Credit tier: A.",
        "name": "Sharma General Store",
        "channel": "Kirana",
        "city": "Noida",
        "state": "Uttar Pradesh",
        "credit_tier": "A",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Patel Supermart is a large supermarket in Andheri West, Mumbai. "
                   "Multi-category store with dedicated shelf space for FMCG brands. "
                   "Owner: Mukesh Patel. Strong in beverages and personal care. "
                   "Prefers bi-weekly bulk orders. Has cold storage. Credit tier: A.",
        "name": "Patel Supermart",
        "channel": "Supermarket",
        "city": "Mumbai",
        "state": "Maharashtra",
        "credit_tier": "A",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Singh Wholesale is a wholesale distributor in Ludhiana. "
                   "Serves 50+ small retailers in the area. High volume, low margin. "
                   "Owner: Harpreet Singh. Orders weekly in bulk (50+ cases). "
                   "Focuses on beverages and snacks. Credit tier: B. Seasonal demand spikes during festivals.",
        "name": "Singh Wholesale",
        "channel": "Wholesale",
        "city": "Ludhiana",
        "state": "Punjab",
        "credit_tier": "B",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Gupta Corner Shop is a small neighbourhood kirana in Varanasi. "
                   "Limited shelf space, serves a residential locality. Owner: Anil Gupta. "
                   "Orders small quantities frequently. Cash-only preferred. "
                   "Top products: biscuits, soap, cooking oil. Credit tier: C.",
        "name": "Gupta Corner Shop",
        "channel": "Kirana",
        "city": "Varanasi",
        "state": "Uttar Pradesh",
        "credit_tier": "C",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Reddy Mart is a modern trade outlet in Hyderabad, Banjara Hills. "
                   "Well-organised with good shelf management. Owner: Suresh Reddy. "
                   "Interested in new product launches and promotions. "
                   "Has billing software and digital payments. Credit tier: A.",
        "name": "Reddy Mart",
        "channel": "Modern Trade",
        "city": "Hyderabad",
        "state": "Telangana",
        "credit_tier": "A",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
]

SAMPLE_PRODUCTS = [
    {
        "id": str(uuid.uuid4()),
        "content": "Thums Up 300ml PET Bottle — India's leading cola brand. MRP INR 20. "
                   "Case of 24 bottles. High demand in summer. Category: Beverages. "
                   "SKU: BEV-TU-300-PET. Best-selling in Kirana and Supermarket channels.",
        "name": "Thums Up 300ml",
        "sku_code": "BEV-TU-300-PET",
        "category": "Beverages",
        "mrp": 20.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Maggi 2-Minute Noodles 70g — India's most popular instant noodle. MRP INR 14. "
                   "Pack of 48. Consistent year-round demand. Category: Packaged Foods. "
                   "SKU: FOOD-MAG-70-PKT. Must Stock List item for all channels.",
        "name": "Maggi 2-Minute Noodles 70g",
        "sku_code": "FOOD-MAG-70-PKT",
        "category": "Packaged Foods",
        "mrp": 14.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Surf Excel Quick Wash 1kg — Leading detergent powder. MRP INR 120. "
                   "Case of 12 packets. Steady demand. Category: Home Care. "
                   "SKU: HC-SE-1KG-PKT. Strong in Kirana channel.",
        "name": "Surf Excel Quick Wash 1kg",
        "sku_code": "HC-SE-1KG-PKT",
        "category": "Home Care",
        "mrp": 120.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Parle-G Biscuits 250g — Classic glucose biscuit. MRP INR 25. "
                   "Pack of 48. Extremely high volume, low margin. Category: Biscuits. "
                   "SKU: BIS-PG-250-PKT. Universal demand across all channels.",
        "name": "Parle-G 250g",
        "sku_code": "BIS-PG-250-PKT",
        "category": "Biscuits",
        "mrp": 25.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Amul Taaza Toned Milk 500ml — Fresh toned milk tetra pack. MRP INR 27. "
                   "Case of 12. Needs cold chain. Category: Dairy. "
                   "SKU: DAI-AT-500-TP. Higher demand in urban and modern trade.",
        "name": "Amul Taaza 500ml",
        "sku_code": "DAI-AT-500-TP",
        "category": "Dairy",
        "mrp": 27.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Lay's Classic Salted 52g — Popular potato chips. MRP INR 20. "
                   "Pack of 48. High impulse purchase. Category: Snacks. "
                   "SKU: SNK-LAY-52-PKT. Strong in Modern Trade and Supermarket.",
        "name": "Lay's Classic Salted 52g",
        "sku_code": "SNK-LAY-52-PKT",
        "category": "Snacks",
        "mrp": 20.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Coca-Cola 750ml PET Bottle — Global cola brand. MRP INR 40. "
                   "Case of 12 bottles. High summer demand. Category: Beverages. "
                   "SKU: BEV-CC-750-PET. Pairs well with Thums Up for portfolio selling.",
        "name": "Coca-Cola 750ml",
        "sku_code": "BEV-CC-750-PET",
        "category": "Beverages",
        "mrp": 40.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Dove Shampoo 180ml — Premium hair care. MRP INR 145. "
                   "Case of 24. Growing demand in urban areas. Category: Personal Care. "
                   "SKU: PC-DOV-180-BTL. Higher margins. Target Supermarket and Modern Trade.",
        "name": "Dove Shampoo 180ml",
        "sku_code": "PC-DOV-180-BTL",
        "category": "Personal Care",
        "mrp": 145.0,
        "product_id": str(uuid.uuid4()),
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
]

SAMPLE_PLAYBOOKS = [
    {
        "id": str(uuid.uuid4()),
        "content": "Reactivation Playbook: When a store has not ordered in 14+ days, "
                   "the rep should visit with a focused pitch. Step 1: Acknowledge the gap. "
                   "Step 2: Ask about competitor activity. Step 3: Offer a small trial order "
                   "with a 5% discount. Step 4: Highlight new products. "
                   "Success metric: reactivation rate > 60%.",
        "title": "Store Reactivation Playbook",
        "type": "playbook",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "MSL Compliance Guide: Must Stock List should cover 80% of products "
                   "in every store. For Kirana stores, focus on top 20 SKUs. "
                   "For Supermarkets, ensure full MSL of 50+ SKUs. "
                   "Approach: identify gaps, explain demand data, offer combo discounts "
                   "for first order of missing SKUs. Track weekly.",
        "title": "MSL Compliance Guide",
        "type": "playbook",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Objection Handling: Common objections from Indian retailers: "
                   "1) 'Price is too high' → Show value per unit, compare with competitors. "
                   "2) 'No shelf space' → Offer to arrange shelf, suggest removing slow movers. "
                   "3) 'Competitor gives better margins' → Highlight brand pull, offer volume discount. "
                   "4) 'Product doesn't sell here' → Show data from similar stores in the area. "
                   "5) 'Payment terms too strict' → Check credit tier, offer gradual improvement path.",
        "title": "Objection Handling Guide",
        "type": "playbook",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "Summer Season Playbook (March-June): Beverages demand increases 40-60%. "
                   "Pre-position coolers in high-traffic stores. Push 600ml and 1.5L PET formats. "
                   "Run 'Buy 2 cases get 1 free' on 300ml bottles. "
                   "Target ice cream and juice cross-sell. Monitor competitor pricing weekly.",
        "title": "Summer Season Playbook",
        "type": "playbook",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
    {
        "id": str(uuid.uuid4()),
        "content": "New Product Launch Protocol: For launching a new SKU, "
                   "prioritise top 20% stores by revenue. Offer introductory discount (10-15%). "
                   "Provide POS material and shelf talkers. Rep must demo the product. "
                   "Target 100 stores in Week 1, 500 by Week 4. "
                   "Measure: trial rate, repeat purchase rate, shelf visibility.",
        "title": "New Product Launch Protocol",
        "type": "playbook",
        "company_id": "00000000-0000-0000-0000-000000000001",
    },
]


# ── Main Setup ───────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(description="Setup Qdrant collections for OpenSalesAI")
    parser.add_argument("--qdrant-url", default="http://localhost:6333", help="Qdrant server URL")
    parser.add_argument("--reset", action="store_true", help="Delete and recreate collections")
    parser.add_argument("--embedding-model", default="all-MiniLM-L6-v2", help="Embedding model name")
    parser.add_argument("--device", default="cuda", help="Device for embeddings (cuda/cpu)")
    args = parser.parse_args()

    logger.info("Setting up Qdrant at %s", args.qdrant_url)

    # Import dependencies
    try:
        from qdrant_client import QdrantClient
        from qdrant_client.http.models import Distance, VectorParams
    except ImportError:
        logger.error("qdrant-client not installed. Run: pip install qdrant-client")
        sys.exit(1)

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError:
        logger.error("sentence-transformers not installed. Run: pip install sentence-transformers")
        sys.exit(1)

    # Connect to Qdrant
    client = QdrantClient(url=args.qdrant_url, timeout=30)
    logger.info("Connected to Qdrant.")

    # Load embedding model
    logger.info("Loading embedding model '%s' on '%s'...", args.embedding_model, args.device)
    model = SentenceTransformer(args.embedding_model, device=args.device)
    dimension = model.get_sentence_embedding_dimension()
    logger.info("Embedding model loaded. Dimension: %d", dimension)

    # Collections to create
    collections = {
        "store_profiles": {
            "data": SAMPLE_STORES,
            "description": "Retail store profiles and characteristics",
        },
        "product_catalog": {
            "data": SAMPLE_PRODUCTS,
            "description": "Product catalog with SKU details",
        },
        "sales_playbooks": {
            "data": SAMPLE_PLAYBOOKS,
            "description": "Sales playbooks, guides, and best practices",
        },
    }

    for collection_name, config in collections.items():
        logger.info("--- Processing collection: %s ---", collection_name)

        # Check if exists
        existing = [c.name for c in client.get_collections().collections]

        if collection_name in existing:
            if args.reset:
                logger.info("Deleting existing collection '%s'...", collection_name)
                client.delete_collection(collection_name)
            else:
                logger.info("Collection '%s' already exists. Use --reset to recreate.", collection_name)
                continue

        # Create collection
        client.create_collection(
            collection_name=collection_name,
            vectors_config=VectorParams(
                size=dimension,
                distance=Distance.COSINE,
            ),
        )
        logger.info("Created collection '%s' (dim=%d, cosine).", collection_name, dimension)

        # Generate embeddings and upsert
        data = config["data"]
        if not data:
            logger.info("No sample data for '%s'.", collection_name)
            continue

        texts = [item["content"] for item in data]
        logger.info("Generating embeddings for %d documents...", len(texts))

        embeddings = model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=True,
            batch_size=32,
        )

        from qdrant_client.http.models import PointStruct

        points = []
        for i, (item, embedding) in enumerate(zip(data, embeddings, strict=True)):
            point_id = item.get("id", str(uuid.uuid4()))
            payload = {k: v for k, v in item.items() if k != "id"}

            points.append(
                PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload=payload,
                )
            )

        client.upsert(
            collection_name=collection_name,
            points=points,
            wait=True,
        )
        logger.info("Upserted %d documents into '%s'.", len(points), collection_name)

    # Verify
    logger.info("")
    logger.info("=== Setup Complete ===")
    for collection_name in collections:
        try:
            info = client.get_collection(collection_name)
            logger.info(
                "  %s: %d points, dimension=%d",
                collection_name,
                info.points_count,
                info.config.params.vectors.size,  # type: ignore
            )
        except Exception:
            logger.warning("  %s: could not retrieve info", collection_name)

    logger.info("")
    logger.info("Qdrant setup complete. Collections are ready for use.")


if __name__ == "__main__":
    main()
