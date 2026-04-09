"""
Tallownara — Flask Backend
Serves the landing page, admin panel, and REST API.
All product data is stored in PostgreSQL.

Run:  python server.py
Then open: http://localhost:5000        (landing page)
           http://localhost:5000/admin  (admin panel — requires login)
"""

import os
import uuid
from pathlib import Path
from functools import wraps

from flask import (Flask, jsonify, request, send_from_directory,
                   abort, redirect, url_for, session)
from flask_cors import CORS
from flask_login import (LoginManager, UserMixin, login_user,
                         logout_user, login_required, current_user)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import psycopg2
import psycopg2.extras

# ── Config ──────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
DIST_DIR    = BASE_DIR / "dist"          # React production build
LANDING_DIR = BASE_DIR / "landing"      # legacy fallback
ADMIN_DIR   = BASE_DIR / "admin"
UPLOAD_DIR  = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXT = {"png", "jpg", "jpeg", "webp", "gif"}
MAX_MB      = 5

# Use DATABASE_URL on Render, fall back to local config
DATABASE_URL = os.environ.get("DATABASE_URL")
if DATABASE_URL:
    # Render provides postgres:// but psycopg2 needs postgresql://
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    DB_CONFIG = None  # signal to use DATABASE_URL directly
else:
    DB_CONFIG = {
        "host":     os.environ.get("DB_HOST", "localhost"),
        "port":     int(os.environ.get("DB_PORT", 5432)),
        "dbname":   os.environ.get("DB_NAME", "tallownara"),
        "user":     os.environ.get("DB_USER", "postgres"),
        "password": os.environ.get("DB_PASSWORD", "asd"),
    }

# Serve React dist if built, otherwise fall back to legacy landing/
_static_folder = str(DIST_DIR) if DIST_DIR.exists() else str(LANDING_DIR)
app = Flask(__name__, static_folder=_static_folder, static_url_path="")
app.secret_key = os.environ.get("SECRET_KEY", "tallownara-secret-2026-change-in-prod")
app.config["MAX_CONTENT_LENGTH"] = MAX_MB * 1024 * 1024

CORS(app, resources={r"/api/*": {"origins": "*"}})

# ── Flask-Login ──────────────────────────────────────────────────────────────
login_manager = LoginManager(app)
login_manager.login_view         = "admin_login"
login_manager.login_message      = "Please log in to access the admin panel."
login_manager.login_message_category = "warning"


class AdminUser(UserMixin):
    def __init__(self, uid, username):
        self.id       = uid
        self.username = username


@login_manager.user_loader
def load_user(user_id):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, username FROM users WHERE id = %s;", (user_id,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if row:
        return AdminUser(row["id"], row["username"])
    return None


# ── Database ─────────────────────────────────────────────────────────────────

def get_db():
    if DATABASE_URL:
        conn = psycopg2.connect(DATABASE_URL, sslmode="require")
    else:
        conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    return conn


def init_db():
    conn = get_db()
    cur  = conn.cursor()

    # Users table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            SERIAL PRIMARY KEY,
            username      VARCHAR(100) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            created_at    TIMESTAMP DEFAULT NOW()
        );
    """)

    # Seed default admin user if none exist
    cur.execute("SELECT COUNT(*) FROM users;")
    if cur.fetchone()[0] == 0:
        cur.execute(
            "INSERT INTO users (username, password_hash) VALUES (%s, %s);",
            ("admin", generate_password_hash("admin"))
        )
        print("  Default admin user created: admin / admin")

    # Products table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS products (
            id             SERIAL PRIMARY KEY,
            name           VARCHAR(255)  NOT NULL,
            description_en TEXT          DEFAULT '',
            description_id TEXT          DEFAULT '',
            price          VARCHAR(100)  DEFAULT '',
            variants       TEXT[]        DEFAULT '{}',
            image_path     VARCHAR(500)  DEFAULT '',
            rating_star    NUMERIC(3,2)  DEFAULT 5.0,
            sold           INTEGER       DEFAULT 0,
            shopee_url     VARCHAR(500)  DEFAULT 'https://shopee.co.id/tallownara_id',
            sort_order     INTEGER       DEFAULT 0,
            created_at     TIMESTAMP     DEFAULT NOW(),
            updated_at     TIMESTAMP     DEFAULT NOW()
        );
    """)

    # Reviews table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS reviews (
            id              SERIAL PRIMARY KEY,
            product_id      INTEGER REFERENCES products(id) ON DELETE CASCADE,
            reviewer        VARCHAR(255) DEFAULT 'Pelanggan',
            location        VARCHAR(255) DEFAULT '',
            stars           INTEGER      DEFAULT 5,
            text            TEXT         DEFAULT '',
            show_on_landing BOOLEAN      DEFAULT TRUE,
            created_at      TIMESTAMP    DEFAULT NOW()
        );
    """)

    # Seed default products
    cur.execute("SELECT COUNT(*) FROM products;")
    if cur.fetchone()[0] == 0:
        defaults = [
            ("Pure Tallow Balm",
             "Our flagship product. Unscented, pure rendered tallow — a deeply nourishing moisturizer for face, body, and hands.",
             "Produk unggulan kami. Tanpa wewangian, tallow murni yang diproses — pelembap yang sangat menutrisi untuk wajah, tubuh, dan tangan.",
             "Rp 00.000", ["60g", "120g"], "https://shopee.co.id/tallownara_id", 0),
            ("Baby Tallow Cream",
             "Extra-gentle formula specially made for newborn and infant skin — soothes diaper rash, cradle cap, and dry patches.",
             "Formula sangat lembut yang khusus dibuat untuk kulit bayi baru lahir — meredakan ruam popok, cradle cap, dan kulit kering.",
             "Rp 00.000", ["60g"], "https://shopee.co.id/tallownara_id", 1),
            ("Healing Salve",
             "Medicinal-grade tallow blended with calendula and beeswax — formulated to accelerate wound healing, eczema, and burns.",
             "Tallow berkualitas medis yang dipadukan dengan calendula dan beeswax — diformulasikan untuk mempercepat penyembuhan luka dan eksim.",
             "Rp 00.000", ["30g", "60g"], "https://shopee.co.id/tallownara_id", 2),
            ("Whipped Tallow",
             "Light, airy texture — same powerful benefits in a fluffy consistency that melts instantly on contact with the skin.",
             "Tekstur ringan dan lembut — manfaat yang sama dalam konsistensi fluffy yang langsung meleleh saat menyentuh kulit.",
             "Rp 00.000", ["80g"], "https://shopee.co.id/tallownara_id", 3),
        ]
        for p in defaults:
            cur.execute("""
                INSERT INTO products
                    (name, description_en, description_id, price, variants, shopee_url, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, p)

    conn.commit()
    cur.close()
    conn.close()
    print("Database ready.")


# ── Helpers ───────────────────────────────────────────────────────────────────

def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXT


def product_to_dict(row):
    return {
        "id":             row["id"],
        "name":           row["name"],
        "description_en": row["description_en"] or "",
        "description_id": row["description_id"] or "",
        "price":          row["price"] or "",
        "variants":       list(row["variants"] or []),
        "image_path":     row["image_path"] or "",
        "image_url":      f"/uploads/{row['image_path']}" if row["image_path"] else "",
        "rating_star":    float(row["rating_star"] or 5),
        "sold":           row["sold"] or 0,
        "shopee_url":     row["shopee_url"] or "",
        "sort_order":     row["sort_order"] or 0,
    }


def review_to_dict(row):
    return {
        "id":              row["id"],
        "product_id":      row["product_id"],
        "reviewer":        row["reviewer"] or "",
        "location":        row["location"] or "",
        "stars":           row["stars"] or 5,
        "text":            row["text"] or "",
        "show_on_landing": row["show_on_landing"],
    }


# ── Static / page routes ──────────────────────────────────────────────────────

@app.route("/")
def landing():
    index = DIST_DIR / "index.html"
    if index.exists():
        return send_from_directory(str(DIST_DIR), "index.html")
    return send_from_directory(str(LANDING_DIR), "index.html")


@app.route("/uploads/<filename>")
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


# ── Auth routes ───────────────────────────────────────────────────────────────

@app.route("/admin/login", methods=["GET"])
def admin_login():
    if current_user.is_authenticated:
        return redirect(url_for("admin_panel"))
    return send_from_directory(ADMIN_DIR, "login.html")


@app.route("/admin/login", methods=["POST"])
def admin_login_post():
    username = request.form.get("username", "").strip()
    password = request.form.get("password", "")
    remember = bool(request.form.get("remember"))

    if not username or not password:
        return redirect(url_for("admin_login") + "?error=empty")

    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id, username, password_hash FROM users WHERE username = %s;", (username,))
    row = cur.fetchone()
    cur.close(); conn.close()

    if row and check_password_hash(row["password_hash"], password):
        user = AdminUser(row["id"], row["username"])
        login_user(user, remember=remember)
        next_page = request.args.get("next") or url_for("admin_panel")
        return redirect(next_page)

    return redirect(url_for("admin_login") + "?error=invalid")


@app.route("/admin/logout")
@login_required
def admin_logout():
    logout_user()
    return redirect(url_for("admin_login") + "?msg=logged_out")


# ── Admin panel (protected) ────────────────────────────────────────────────────

@app.route("/admin")
@app.route("/admin/")
@login_required
def admin_panel():
    return send_from_directory(ADMIN_DIR, "index.html")


# ── API: auth info ─────────────────────────────────────────────────────────────

@app.route("/api/me")
@login_required
def api_me():
    return jsonify({"username": current_user.username, "id": current_user.id})


@app.route("/api/change-password", methods=["POST"])
@login_required
def change_password():
    data        = request.get_json(silent=True) or {}
    current_pw  = data.get("current_password", "")
    new_pw      = data.get("new_password", "")

    if not current_pw or not new_pw:
        return jsonify({"error": "Both current and new password are required."}), 400
    if len(new_pw) < 4:
        return jsonify({"error": "New password must be at least 4 characters."}), 400

    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT password_hash FROM users WHERE id = %s;", (current_user.id,))
    row = cur.fetchone()

    if not row or not check_password_hash(row["password_hash"], current_pw):
        cur.close(); conn.close()
        return jsonify({"error": "Current password is incorrect."}), 403

    cur.execute(
        "UPDATE users SET password_hash = %s WHERE id = %s;",
        (generate_password_hash(new_pw), current_user.id)
    )
    conn.commit(); cur.close(); conn.close()
    return jsonify({"ok": True})


# ── Public API (landing page reads these) ─────────────────────────────────────

@app.route("/api/products", methods=["GET"])
def get_products():
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM products ORDER BY sort_order, id;")
    rows = cur.fetchall()
    cur.close(); conn.close()
    return jsonify([product_to_dict(r) for r in rows])


@app.route("/api/reviews", methods=["GET"])
def get_reviews():
    landing_only = request.args.get("landing") == "1"
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    if landing_only:
        cur.execute("""
            SELECT r.*, p.name AS product_name FROM reviews r
            JOIN products p ON r.product_id = p.id
            WHERE r.show_on_landing = TRUE
            ORDER BY r.created_at DESC LIMIT 6;
        """)
    else:
        cur.execute("""
            SELECT r.*, p.name AS product_name FROM reviews r
            JOIN products p ON r.product_id = p.id
            ORDER BY r.created_at DESC;
        """)
    rows = cur.fetchall()
    cur.close(); conn.close()
    result = []
    for r in rows:
        d = review_to_dict(r)
        d["product_name"] = r.get("product_name", "")
        result.append(d)
    return jsonify(result)


# ── Protected API (admin only) ─────────────────────────────────────────────────

@app.route("/api/products", methods=["POST"])
@login_required
def create_product():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Product name is required"}), 400

    variants = data.get("variants", [])
    if isinstance(variants, str):
        variants = [x.strip() for x in variants.split(",") if x.strip()]

    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM products;")
    next_order = cur.fetchone()["next_order"]
    cur.execute("""
        INSERT INTO products (name, description_en, description_id, price, variants, shopee_url, sort_order)
        VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *;
    """, (name, data.get("description_en", ""), data.get("description_id", ""),
          data.get("price", ""), variants,
          data.get("shopee_url", "https://shopee.co.id/tallownara_id"), next_order))
    row = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    return jsonify(product_to_dict(row)), 201


@app.route("/api/products/<int:pid>", methods=["DELETE"])
@login_required
def delete_product(pid):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("SELECT image_path FROM products WHERE id = %s;", (pid,))
    row = cur.fetchone()
    if row and row[0]:
        f = UPLOAD_DIR / row[0]
        if f.exists(): f.unlink()
    cur.execute("DELETE FROM products WHERE id = %s;", (pid,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"ok": True})


@app.route("/api/products/<int:pid>", methods=["GET"])
@login_required
def get_product(pid):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT * FROM products WHERE id = %s;", (pid,))
    row = cur.fetchone()
    cur.close(); conn.close()
    if not row: abort(404)
    return jsonify(product_to_dict(row))


@app.route("/api/products/<int:pid>", methods=["PUT", "PATCH"])
@login_required
def update_product(pid):
    data = request.get_json(silent=True) or {}
    fields, values = [], []

    for col in ("name", "description_en", "description_id", "price", "shopee_url"):
        if col in data:
            fields.append(f"{col} = %s")
            values.append(data[col])

    if "variants" in data:
        v = data["variants"]
        if isinstance(v, str):
            v = [x.strip() for x in v.split(",") if x.strip()]
        fields.append("variants = %s"); values.append(v)

    for col, cast in (("rating_star", float), ("sold", int), ("sort_order", int)):
        if col in data:
            fields.append(f"{col} = %s"); values.append(cast(data[col]))

    if not fields:
        return jsonify({"error": "No fields to update"}), 400

    fields.append("updated_at = NOW()")
    values.append(pid)

    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"UPDATE products SET {', '.join(fields)} WHERE id = %s RETURNING *;", values)
    row = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    if not row: abort(404)
    return jsonify(product_to_dict(row))


@app.route("/api/products/<int:pid>/image", methods=["POST"])
@login_required
def upload_image(pid):
    if "image" not in request.files:
        return jsonify({"error": "No file part"}), 400
    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "No file selected"}), 400
    if not allowed_file(file.filename):
        return jsonify({"error": f"Allowed types: {', '.join(ALLOWED_EXT)}"}), 400

    ext      = file.filename.rsplit(".", 1)[1].lower()
    filename = f"product_{pid}_{uuid.uuid4().hex[:8]}.{ext}"

    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT image_path FROM products WHERE id = %s;", (pid,))
    old = cur.fetchone()
    if old and old["image_path"]:
        old_file = UPLOAD_DIR / old["image_path"]
        if old_file.exists(): old_file.unlink()

    file.save(str(UPLOAD_DIR / filename))
    cur.execute(
        "UPDATE products SET image_path = %s, updated_at = NOW() WHERE id = %s RETURNING *;",
        (filename, pid)
    )
    row = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    if not row: abort(404)
    return jsonify(product_to_dict(row))


@app.route("/api/products/<int:pid>/image", methods=["DELETE"])
@login_required
def delete_image(pid):
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT image_path FROM products WHERE id = %s;", (pid,))
    row = cur.fetchone()
    if row and row["image_path"]:
        f = UPLOAD_DIR / row["image_path"]
        if f.exists(): f.unlink()
    cur.execute(
        "UPDATE products SET image_path = '', updated_at = NOW() WHERE id = %s RETURNING *;", (pid,)
    )
    row = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    return jsonify(product_to_dict(row))


@app.route("/api/reviews", methods=["POST"])
@login_required
def add_review():
    data = request.get_json(silent=True) or {}
    if not all(k in data for k in ("product_id", "text")):
        return jsonify({"error": "product_id and text are required"}), 400
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("""
        INSERT INTO reviews (product_id, reviewer, location, stars, text, show_on_landing)
        VALUES (%s, %s, %s, %s, %s, %s) RETURNING *;
    """, (int(data["product_id"]), data.get("reviewer", "Pelanggan"),
          data.get("location", ""), int(data.get("stars", 5)),
          data["text"], bool(data.get("show_on_landing", True))))
    row = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    return jsonify(review_to_dict(row)), 201


@app.route("/api/reviews/<int:rid>", methods=["PUT", "PATCH"])
@login_required
def update_review(rid):
    data = request.get_json(silent=True) or {}
    fields, values = [], []
    for col in ("reviewer", "location", "text"):
        if col in data:
            fields.append(f"{col} = %s"); values.append(data[col])
    if "stars" in data:
        fields.append("stars = %s"); values.append(int(data["stars"]))
    if "show_on_landing" in data:
        fields.append("show_on_landing = %s"); values.append(bool(data["show_on_landing"]))
    if not fields:
        return jsonify({"error": "nothing to update"}), 400
    values.append(rid)
    conn = get_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(f"UPDATE reviews SET {', '.join(fields)} WHERE id = %s RETURNING *;", values)
    row = cur.fetchone()
    conn.commit(); cur.close(); conn.close()
    if not row: abort(404)
    return jsonify(review_to_dict(row))


@app.route("/api/reviews/<int:rid>", methods=["DELETE"])
@login_required
def delete_review(rid):
    conn = get_db()
    cur  = conn.cursor()
    cur.execute("DELETE FROM reviews WHERE id = %s;", (rid,))
    conn.commit(); cur.close(); conn.close()
    return jsonify({"ok": True})


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    try:
        init_db()
    except psycopg2.OperationalError as e:
        # Only try to auto-create the DB when running locally
        if not DATABASE_URL and 'database "tallownara" does not exist' in str(e):
            print("Creating database 'tallownara'...")
            c = psycopg2.connect(host="localhost", port=5432,
                                 dbname="postgres", user="postgres", password="asd")
            c.autocommit = True
            c.cursor().execute("CREATE DATABASE tallownara;")
            c.close()
            init_db()
        else:
            raise

    port = int(os.environ.get("PORT", 5000))
    debug = not DATABASE_URL  # disable debug in production
    print(f"\nTallownara server running on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug)


# Called by gunicorn on startup via preload_app or directly
# init_db() is called inside __main__ for local dev and via build.sh on Render
