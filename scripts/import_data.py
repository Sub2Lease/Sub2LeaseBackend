#!/usr/bin/env python3
"""
Seed the `sub2lease` database with sample JSON in `data/`.

This script requires no command-line arguments. It uses the `MONGO_URI`
environment variable if present, otherwise `mongodb://localhost:27017`.

Behavior:
- Reads `data/users.json`, `data/listings.json`, `data/agreements.json` (if present).
- Parses Extended JSON using `bson.json_util.loads` so `$oid` and `$date` are handled.
- For documents that contain an `_id` field the script does a replace (upsert) so
  re-running the script is idempotent for those documents.
- Documents without `_id` are inserted.

Install requirements:
  pip install pymongo

Run:
  MONGO_URI="mongodb://localhost:27017" python3 scripts/import_data.py
"""
import os
from pathlib import Path
from pymongo import MongoClient, ReplaceOne
from bson import json_util
from dotenv import load_dotenv

load_dotenv()


FILES = [
	("users", Path("data/users.json")),
	("listings", Path("data/listings.json")),
	("agreements", Path("data/agreements.json")),
]


def load_extended_json(path: Path):
	text = path.read_text(encoding="utf-8")
	data = json_util.loads(text)
	if isinstance(data, dict):
		return [data]
	return data


def main():
	uri = os.environ.get("MONGO_URI", default="mongodb://localhost:27017")
	db_name = os.environ.get("MONGO_DB", default="Sub2Lease")
    
	print(f"Connecting to {uri} (db: {db_name})")
	client = MongoClient(uri)
	db = client[db_name]

	for coll_name, path in FILES:
		if not path.exists():
			print(f"[skip] {path} not found")
			continue

		try:
			docs = load_extended_json(path)
		except Exception as e:
			print(f"[error] Failed to parse {path}: {e}")
			continue

		if not docs:
			print(f"[skip] no documents in {path}")
			continue

		ops = []
		to_insert = []

		for doc in docs:
			if not isinstance(doc, dict):
				continue
			if "_id" in doc:
				ops.append(ReplaceOne({"_id": doc["_id"]}, doc, upsert=True))
			else:
				to_insert.append(doc)

		try:
			if ops:
				result = db[coll_name].bulk_write(ops)
				print(f"[ok] {coll_name}: upserted={result.upserted_count} modified={result.modified_count}")
			if to_insert:
				res = db[coll_name].insert_many(to_insert)
				print(f"[ok] {coll_name}: inserted {len(res.inserted_ids)} documents")
		except Exception as e:
			print(f"[error] writing to {coll_name}: {e}")

	client.close()


if __name__ == "__main__":
	main()
