

from flask import Flask, jsonify, request, send_from_directory
import sqlite3
import json
from pathlib import Path

app = Flask(__name__)

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "tasks.db"


def get_connection():
    return sqlite3.connect(DB_PATH)


def init_db():
    with get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS app_storage (
                storage_key TEXT PRIMARY KEY,
                storage_value TEXT NOT NULL
            )
        """)


@app.route("/")
def home():
    return send_from_directory(str(BASE_DIR), "index.html")


@app.route("/<path:filename>")
def frontend_files(filename):
    allowed = {
        "index.html",
        "style.css",
        "script.js",
        "backend-sync.js"
    }

    if filename not in allowed:
        return "File not found", 404

    return send_from_directory(str(BASE_DIR), filename)


@app.route("/api/storage", methods=["GET"])
def get_storage():
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT storage_key, storage_value FROM app_storage"
        ).fetchall()

    return jsonify({
        key: json.loads(value)
        for key, value in rows
    })


@app.route("/api/storage", methods=["POST"])
def save_storage():
    data = request.get_json(silent=True)

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid JSON"}), 400

    key = data.get("key")
    value = data.get("value")

    allowed_keys = {
        "daybook_plans_v3",
        "daybook_notes_v3",
        "daybook_theme_v3",
        "daybook_sent_v3"
    }

    if key not in allowed_keys:
        return jsonify({"error": "Invalid storage key"}), 400

    with get_connection() as conn:
        conn.execute("""
            INSERT INTO app_storage (storage_key, storage_value)
            VALUES (?, ?)
            ON CONFLICT(storage_key)
            DO UPDATE SET storage_value = excluded.storage_value
        """, (key, json.dumps(value)))

    return jsonify({"success": True})


if __name__ == "__main__":
    init_db()
    print("Database:", DB_PATH)
    app.run(debug=True, port=5001)
