from pymongo import MongoClient
import os


def init_mongodb():
    mongo_url = os.getenv("MONGODB_URL")
    db_name = os.getenv("MONGODB_DB", "ocr_database")

    client = MongoClient(mongo_url)
    db = client[db_name]

    collections = db.list_collection_names()

    # Collections
    if "users" not in collections:
        db.create_collection("users")

    if "documents" not in collections:
        db.create_collection("documents")

    if "ocr_results" not in collections:
        db.create_collection("ocr_results")

    if "corrections" not in collections:
        db.create_collection("corrections")

    # Index
    db.users.create_index("email", unique=True)
    db.documents.create_index("user_id")
    db.ocr_results.create_index("document_id")
    db.corrections.create_index("ocr_result_id")

    # Admin par défaut
    if db.users.count_documents({"email": "admin@test.com"}) == 0:
        db.users.insert_one({
            "email": "admin@test.com",
            "password": "admin",  
            "role": "admin"
        })

    print(f"MongoDB initialisée sur '{db_name}'")


if __name__ == "__main__":
    init_mongodb()