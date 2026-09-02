import json
import os
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
from app.db.mongodb import db_manager

# Dual-mode store: Uses MongoDB if available, otherwise synchronous atomic JSON files/in-memory
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data_store")
os.makedirs(DATA_DIR, exist_ok=True)

class UnifiedDataStore:
    def __init__(self):
        self.lock = asyncio.Lock()
        self._cache: Dict[str, List[Dict[str, Any]]] = {
            "organizations": [],
            "users": [],
            "employees": [],
            "attendance": [],
            "kiosks": [],
            "audit_logs": []
        }
        self._load_local_storage()

    def _file_path(self, collection: str) -> str:
        return os.path.join(DATA_DIR, f"{collection}.json")

    def _load_local_storage(self):
        for col in self._cache.keys():
            path = self._file_path(col)
            if os.path.exists(path):
                try:
                    with open(path, "r", encoding="utf-8") as f:
                        self._cache[col] = json.load(f)
                except Exception:
                    self._cache[col] = []

    def _save_local_storage(self, collection: str):
        path = self._file_path(collection)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self._cache[collection], f, default=str, indent=2)
        except Exception as e:
            print(f"Error saving {collection}: {e}")

    async def find_one(self, collection: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        db = db_manager.db
        if db is not None:
            try:
                res = await db[collection].find_one(query)
                if res and "_id" in res:
                    del res["_id"]
                return res
            except Exception:
                pass
        
        # Local fallback
        async with self.lock:
            items = self._cache.get(collection, [])
            for item in items:
                match = all(item.get(k) == v for k, v in query.items())
                if match:
                    return dict(item)
            return None

    async def find_many(self, collection: str, query: Dict[str, Any], sort_key: str = None, sort_desc: bool = False, limit: int = None) -> List[Dict[str, Any]]:
        db = db_manager.db
        if db is not None:
            try:
                cursor = db[collection].find(query)
                if sort_key:
                    cursor = cursor.sort(sort_key, -1 if sort_desc else 1)
                if limit:
                    cursor = cursor.limit(limit)
                docs = await cursor.to_list(length=1000)
                for d in docs:
                    if "_id" in d:
                        del d["_id"]
                return docs
            except Exception:
                pass

        async with self.lock:
            items = self._cache.get(collection, [])
            matched = []
            for item in items:
                match = True
                for k, v in query.items():
                    if isinstance(v, dict):
                        # Simple operator support like $gte, $lte, $in
                        val = item.get(k)
                        if "$in" in v and val not in v["$in"]:
                            match = False; break
                        if "$gte" in v and not (val >= v["$gte"]):
                            match = False; break
                        if "$lte" in v and not (val <= v["$lte"]):
                            match = False; break
                    elif item.get(k) != v:
                        match = False
                        break
                if match:
                    matched.append(dict(item))
            
            if sort_key:
                matched.sort(key=lambda x: x.get(sort_key) or "", reverse=sort_desc)
            if limit:
                matched = matched[:limit]
            return matched

    async def insert_one(self, collection: str, doc: Dict[str, Any]):
        db = db_manager.db
        if db is not None:
            try:
                await db[collection].insert_one(doc.copy())
            except Exception:
                pass
        
        async with self.lock:
            if collection not in self._cache:
                self._cache[collection] = []
            self._cache[collection].append(dict(doc))
            self._save_local_storage(collection)
        return doc

    async def update_one(self, collection: str, query: Dict[str, Any], update: Dict[str, Any]) -> bool:
        db = db_manager.db
        if db is not None:
            try:
                await db[collection].update_one(query, {"$set": update})
            except Exception:
                pass

        async with self.lock:
            items = self._cache.get(collection, [])
            for item in items:
                match = all(item.get(k) == v for k, v in query.items())
                if match:
                    item.update(update)
                    self._save_local_storage(collection)
                    return True
            return False

    async def delete_one(self, collection: str, query: Dict[str, Any]) -> bool:
        db = db_manager.db
        if db is not None:
            try:
                await db[collection].delete_one(query)
            except Exception:
                pass

        async with self.lock:
            items = self._cache.get(collection, [])
            for idx, item in enumerate(items):
                match = all(item.get(k) == v for k, v in query.items())
                if match:
                    items.pop(idx)
                    self._save_local_storage(collection)
                    return True
            return False

store = UnifiedDataStore()
