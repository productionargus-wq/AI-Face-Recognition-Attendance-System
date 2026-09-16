import json
import os
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import logging
from app.db.mongodb import db_manager, ensure_mongo_connected

logger = logging.getLogger(__name__)

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

    async def get_active_db(self):
        if db_manager.db is None:
            try:
                await ensure_mongo_connected()
            except Exception as e:
                logger.warning(f"Failed on-demand MongoDB connection: {e}")
        return db_manager.db

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
        if db_manager.db is not None:
            # MongoDB is active; skip slow synchronous disk writes to ephemeral filesystem
            return
        path = self._file_path(collection)
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(self._cache[collection], f, default=str)
        except Exception as e:
            logger.warning(f"Error saving {collection}: {e}")

    def _resolve_collection(self, collection: str) -> str:
        if collection in ("organizations", "organisation"):
            return "organisations"
        return collection

    async def find_one(self, collection: str, query: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        if db is not None:
            try:
                res = await db[target_col].find_one(query)
                if res and "_id" in res:
                    del res["_id"]
                return res
            except Exception as e:
                logger.warning(f"Error in MongoDB find_one {target_col}: {e}")
        
        # Local fallback
        async with self.lock:
            items = self._cache.get(target_col, []) or self._cache.get(collection, [])
            for item in items:
                match = all(item.get(k) == v for k, v in query.items())
                if match:
                    return dict(item)
            return None

    async def find_many(self, collection: str, query: Dict[str, Any], sort_key: str = None, sort_desc: bool = False, limit: int = None) -> List[Dict[str, Any]]:
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        if db is not None:
            try:
                cursor = db[target_col].find(query)
                if sort_key:
                    cursor = cursor.sort(sort_key, -1 if sort_desc else 1)
                if limit:
                    cursor = cursor.limit(limit)
                docs = await cursor.to_list(length=1000)
                for d in docs:
                    if "_id" in d:
                        del d["_id"]
                return docs
            except Exception as e:
                logger.warning(f"Error in MongoDB find_many {target_col}: {e}")

        async with self.lock:
            items = self._cache.get(target_col, []) or self._cache.get(collection, [])
            matched = []
            for item in items:
                match = True
                for k, v in query.items():
                    if isinstance(v, dict):
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
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        if db is not None:
            try:
                mongo_doc = doc.copy()
                if "_id" in mongo_doc:
                    del mongo_doc["_id"]
                await db[target_col].insert_one(mongo_doc)
                logger.info(f"MongoDB stored in '{target_col}': id={doc.get('id')}, name={doc.get('name')}")
            except Exception as e:
                logger.error(f"MongoDB insert error in '{target_col}': {e}", exc_info=True)
        
        async with self.lock:
            if target_col not in self._cache:
                self._cache[target_col] = []
            self._cache[target_col].append(dict(doc))
            self._save_local_storage(target_col)
        return doc

    async def update_one(self, collection: str, query: Dict[str, Any], update: Dict[str, Any]) -> bool:
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        if db is not None:
            try:
                await db[target_col].update_one(query, {"$set": update})
            except Exception as e:
                logger.warning(f"Error in MongoDB update_one {target_col}: {e}")

        async with self.lock:
            items = self._cache.get(target_col, []) or self._cache.get(collection, [])
            for item in items:
                match = all(item.get(k) == v for k, v in query.items())
                if match:
                    item.update(update)
                    self._save_local_storage(target_col)
                    return True
            return False

    async def update_many(self, collection: str, query: Dict[str, Any], update: Dict[str, Any]) -> int:
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        count = 0
        if db is not None:
            try:
                res = await db[target_col].update_many(query, {"$set": update})
                count = res.modified_count
            except Exception as e:
                logger.warning(f"Error in MongoDB update_many {target_col}: {e}")

        async with self.lock:
            items = self._cache.get(target_col, []) or self._cache.get(collection, [])
            for item in items:
                match = True
                if "$or" in query:
                    match = any(all(item.get(k) == v for k, v in sub.items()) for sub in query["$or"])
                else:
                    for k, v in query.items():
                        if item.get(k) != v:
                            match = False
                            break
                if match:
                    item.update(update)
                    count += 1
            self._save_local_storage(target_col)
        return count

    async def delete_one(self, collection: str, query: Dict[str, Any]) -> bool:
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        if db is not None:
            try:
                await db[target_col].delete_one(query)
            except Exception as e:
                logger.warning(f"Error in MongoDB delete_one {target_col}: {e}")

        async with self.lock:
            items = self._cache.get(target_col, []) or self._cache.get(collection, [])
            for idx, item in enumerate(items):
                match = all(item.get(k) == v for k, v in query.items())
                if match:
                    items.pop(idx)
                    self._save_local_storage(target_col)
                    return True
        return False

    async def delete_many(self, collection: str, query: Dict[str, Any]) -> int:
        target_col = self._resolve_collection(collection)
        db = await self.get_active_db()
        count = 0
        if db is not None:
            try:
                res = await db[target_col].delete_many(query)
                count = res.deleted_count
            except Exception as e:
                logger.warning(f"Error in MongoDB delete_many {target_col}: {e}")

        async with self.lock:
            items = self._cache.get(target_col, []) or self._cache.get(collection, [])
            new_items = []
            for item in items:
                match = all(item.get(k) == v for k, v in query.items())
                if not match:
                    new_items.append(item)
                else:
                    count += 1
            self._cache[target_col] = new_items
            self._save_local_storage(target_col)
        return count


store = UnifiedDataStore()
