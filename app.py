import os
import re
from typing import Any, Dict

from bson import ObjectId
from bson.errors import InvalidId
from flask import Flask, jsonify, render_template, request
from pymongo import MongoClient
from pymongo.errors import ServerSelectionTimeoutError
from werkzeug.exceptions import HTTPException

app = Flask(__name__)

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
MONGO_DB_NAME = os.getenv("MONGO_DB_NAME", "address_book")
MONGO_COLLECTION = os.getenv("MONGO_COLLECTION", "contacts")

client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = client[MONGO_DB_NAME]
contacts_collection = db[MONGO_COLLECTION]
indexes_ready = False

CORE_FIELDS = ("first_name", "last_name", "address", "phone_number")

def ensure_indexes() -> None:
    contacts_collection.create_index("first_name")
    contacts_collection.create_index("last_name")
    contacts_collection.create_index("address")
    contacts_collection.create_index("searchable_text")


def get_contacts_collection():
    global indexes_ready
    if not indexes_ready:
        ensure_indexes()
        indexes_ready = True
    return contacts_collection


def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def build_searchable_text(document: Dict[str, Any]) -> str:
    parts = [
        normalize_text(document.get("first_name")),
        normalize_text(document.get("last_name")),
        normalize_text(document.get("address")),
        normalize_text(document.get("phone_number")),
    ]
    extra_fields = document.get("extra_fields", {})
    for key, value in extra_fields.items():
        parts.append(normalize_text(key))
        parts.append(normalize_text(value))
    return " ".join(part for part in parts if part).lower()


def parse_contact_payload(payload: Dict[str, Any], *, partial: bool = False) -> Dict[str, Any]:
    document: Dict[str, Any] = {}
    for field in CORE_FIELDS:
        if field in payload:
            document[field] = normalize_text(payload.get(field))
        elif not partial:
            document[field] = ""

    raw_extra_fields = payload.get("extra_fields", {})
    extra_fields: Dict[str, str] = {}
    if isinstance(raw_extra_fields, dict):
        for key, value in raw_extra_fields.items():
            field_name = normalize_text(key)
            if field_name:
                extra_fields[field_name] = normalize_text(value)

    if extra_fields or (not partial and "extra_fields" in payload):
        document["extra_fields"] = extra_fields
    elif not partial:
        document["extra_fields"] = {}

    return document


def serialize_contact(document: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(document["_id"]),
        "first_name": document.get("first_name", ""),
        "last_name": document.get("last_name", ""),
        "address": document.get("address", ""),
        "phone_number": document.get("phone_number", ""),
        "extra_fields": document.get("extra_fields", {}),
    }


def regex_clause(value: str) -> Dict[str, Any]:
    return {"$regex": re.escape(value.strip()), "$options": "i"}


def parse_object_id(contact_id: str) -> ObjectId:
    try:
        return ObjectId(contact_id)
    except InvalidId as error:
        raise ValueError("Invalid contact id") from error


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/contacts")
def list_contacts():
    collection = get_contacts_collection()
    keyword = normalize_text(request.args.get("keyword"))
    first_name = normalize_text(request.args.get("first_name"))
    last_name = normalize_text(request.args.get("last_name"))
    address = normalize_text(request.args.get("address"))

    query: Dict[str, Any] = {}
    if keyword:
        query["searchable_text"] = regex_clause(keyword.lower())
    if first_name:
        query["first_name"] = regex_clause(first_name)
    if last_name:
        query["last_name"] = regex_clause(last_name)
    if address:
        query["address"] = regex_clause(address)

    contacts = collection.find(query).sort("first_name", 1)
    return jsonify([serialize_contact(contact) for contact in contacts])


@app.post("/api/contacts")
def create_contact():
    collection = get_contacts_collection()
    payload = request.get_json(silent=True) or {}
    document = parse_contact_payload(payload)
    document["searchable_text"] = build_searchable_text(document)
    result = collection.insert_one(document)
    created = collection.find_one({"_id": result.inserted_id})
    return jsonify(serialize_contact(created)), 201


@app.put("/api/contacts/<contact_id>")
def replace_contact(contact_id: str):
    collection = get_contacts_collection()
    object_id = parse_object_id(contact_id)
    payload = request.get_json(silent=True) or {}
    document = parse_contact_payload(payload)
    document["searchable_text"] = build_searchable_text(document)
    result = collection.replace_one({"_id": object_id}, document)
    if result.matched_count == 0:
        return jsonify({"error": "Contact not found"}), 404
    updated = collection.find_one({"_id": object_id})
    return jsonify(serialize_contact(updated))


@app.patch("/api/contacts/<contact_id>")
def update_contact(contact_id: str):
    collection = get_contacts_collection()
    object_id = parse_object_id(contact_id)
    payload = request.get_json(silent=True) or {}
    incoming = parse_contact_payload(payload, partial=True)
    existing = collection.find_one({"_id": object_id})
    if not existing:
        return jsonify({"error": "Contact not found"}), 404

    merged = {
        "first_name": existing.get("first_name", ""),
        "last_name": existing.get("last_name", ""),
        "address": existing.get("address", ""),
        "phone_number": existing.get("phone_number", ""),
        "extra_fields": dict(existing.get("extra_fields", {})),
    }

    for field in CORE_FIELDS:
        if field in incoming and incoming[field] != "":
            merged[field] = incoming[field]
    if "extra_fields" in incoming:
        merged["extra_fields"].update(incoming["extra_fields"])

    merged["searchable_text"] = build_searchable_text(merged)
    collection.update_one({"_id": object_id}, {"$set": merged})
    updated = collection.find_one({"_id": object_id})
    return jsonify(serialize_contact(updated))


@app.patch("/api/contacts/<contact_id>/fields")
def update_contact_fields(contact_id: str):
    collection = get_contacts_collection()
    object_id = parse_object_id(contact_id)
    payload = request.get_json(silent=True) or {}
    field_name = normalize_text(payload.get("field_name"))
    value = normalize_text(payload.get("value"))
    if not field_name:
        return jsonify({"error": "field_name is required"}), 400

    existing = collection.find_one({"_id": object_id})
    if not existing:
        return jsonify({"error": "Contact not found"}), 404

    updated = {
        "first_name": existing.get("first_name", ""),
        "last_name": existing.get("last_name", ""),
        "address": existing.get("address", ""),
        "phone_number": existing.get("phone_number", ""),
        "extra_fields": dict(existing.get("extra_fields", {})),
    }

    if field_name in CORE_FIELDS:
        updated[field_name] = value
    else:
        updated["extra_fields"][field_name] = value

    updated["searchable_text"] = build_searchable_text(updated)
    collection.update_one({"_id": object_id}, {"$set": updated})
    contact = collection.find_one({"_id": object_id})
    return jsonify(serialize_contact(contact))


@app.delete("/api/contacts/<contact_id>/fields/<field_name>")
def delete_contact_field(contact_id: str, field_name: str):
    collection = get_contacts_collection()
    object_id = parse_object_id(contact_id)
    existing = collection.find_one({"_id": object_id})
    if not existing:
        return jsonify({"error": "Contact not found"}), 404

    updated = {
        "first_name": existing.get("first_name", ""),
        "last_name": existing.get("last_name", ""),
        "address": existing.get("address", ""),
        "phone_number": existing.get("phone_number", ""),
        "extra_fields": dict(existing.get("extra_fields", {})),
    }

    if field_name in CORE_FIELDS:
        updated[field_name] = ""
    else:
        updated["extra_fields"].pop(field_name, None)

    updated["searchable_text"] = build_searchable_text(updated)
    collection.update_one({"_id": object_id}, {"$set": updated})
    contact = collection.find_one({"_id": object_id})
    return jsonify(serialize_contact(contact))


@app.delete("/api/contacts/<contact_id>")
def delete_contact(contact_id: str):
    collection = get_contacts_collection()
    object_id = parse_object_id(contact_id)
    result = collection.delete_one({"_id": object_id})
    if result.deleted_count == 0:
        return jsonify({"error": "Contact not found"}), 404
    return jsonify({"message": "Contact deleted"})


@app.errorhandler(Exception)
def handle_exception(error: Exception):
    if isinstance(error, HTTPException):
        return error
    if isinstance(error, ValueError):
        return jsonify({"error": str(error)}), 400
    if isinstance(error, TypeError):
        return jsonify({"error": str(error)}), 400
    if isinstance(error, ServerSelectionTimeoutError):
        return jsonify({"error": "MongoDB is not reachable. Start MongoDB and try again."}), 503
    return jsonify({"error": str(error)}), 500


if __name__ == "__main__":
    app.run(debug=True)
