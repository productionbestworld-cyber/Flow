import csv
import json
import urllib.request
import urllib.parse
import re

SUPABASE_URL = "https://uexsgzexqoqpluiominb.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVleHNnemV4cW9xcGx1aW9taW5iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNTYwOTcsImV4cCI6MjA5MjkzMjA5N30.DltSnjAdPcEMB9VXQmwS0nFh7YifU-IX8jjY3yqAOW4"

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=ignore-duplicates",
}

def supabase_insert(table, rows):
    if not rows:
        print(f"  ไม่มีข้อมูลสำหรับ {table}")
        return
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    data = json.dumps(rows).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req) as res:
            print(f"  [{table}] insert {len(rows)} rows — status {res.status}")
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  [{table}] ERROR {e.code}: {body[:300]}")

# ─── Parse Customers ──────────────────────────────────────────────────────────
def parse_customers(filepath):
    customers = []
    seen = set()
    with open(filepath, encoding="cp874", errors="replace") as f:
        reader = csv.reader(f)
        current = None
        for row in reader:
            if len(row) < 5:
                continue
            code = row[3].strip() if len(row) > 3 else ""
            name = row[4].strip() if len(row) > 4 else ""

            # แถวที่มีรหัสลูกค้า (เริ่มด้วยตัวอักษรไทยหรือตัวเลข + ตัวอักษร)
            if code and name and re.match(r'^[ก-ฮA-Z0-9].{2,}', code):
                if code not in seen:
                    seen.add(code)
                    current = {
                        "code": code[:20],
                        "name": name[:200],
                        "address": "",
                        "contact": "",
                    }
                    customers.append(current)

            # ที่อยู่
            if current and len(row) > 6 and row[5].strip() == "ที่อยู่:":
                addr = row[6].strip()
                if addr and current["address"] == "":
                    current["address"] = addr[:300]
                elif addr:
                    current["address"] = (current["address"] + " " + addr)[:300]

            # ต่อที่อยู่บรรทัดถัดไป
            if current and len(row) > 6 and row[5].strip() == "" and row[6].strip() and current["address"]:
                extra = row[6].strip()
                if not any(kw in extra for kw in ["เครดิต", "วงเงิน", "อสค"]):
                    current["address"] = (current["address"] + " " + extra)[:300]

            # โทร
            if current and len(row) > 6 and "โทร" in row[5]:
                current["contact"] = row[6].strip()[:100]

    # clean up
    result = []
    for c in customers:
        if c["code"] and c["name"]:
            result.append({
                "code":    c["code"].strip(),
                "name":    c["name"].strip(),
                "address": c["address"].strip() or None,
                "contact": c["contact"].strip() or None,
            })
    return result

# ─── Parse Products ───────────────────────────────────────────────────────────
def parse_products(filepath):
    products = []
    seen = set()
    with open(filepath, encoding="cp874", errors="replace") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 5:
                continue
            code = row[3].strip() if len(row) > 3 else ""
            desc = row[4].strip() if len(row) > 4 else ""

            # รหัสสินค้า: ขึ้นต้นด้วย 01/ หรือตัวอักษร + ตัวเลข เช่น 01FXX-...
            if not code or not desc:
                continue
            if not re.match(r'^[0-9A-Za-z]{2,}', code):
                continue
            if code in seen:
                continue
            if len(code) < 3 or len(desc) < 3:
                continue
            # ข้าม header/summary rows
            if any(kw in desc for kw in ["รายงาน", "สินค้า จาก", "หน่วย", "รหัส"]):
                continue

            seen.add(code)

            # ตรวจ type จากชื่อสินค้า
            desc_lower = desc.lower()
            if "print" in desc_lower or "พิมพ์" in desc_lower:
                ptype = "print"
            else:
                ptype = "blow"

            # พยายาม extract width และ thickness จากชื่อ เช่น "36.9 mm" หรือ "35 mc"
            width_match = re.search(r'(\d+\.?\d*)\s*(?:cm|mm|ซม)', desc_lower)
            thick_match = re.search(r'(\d+\.?\d*)\s*mc', desc_lower)

            products.append({
                "item_code": code[:50],
                "part_name": desc[:200],
                "type":      ptype,
                "width":     float(width_match.group(1)) if width_match else None,
                "thickness": float(thick_match.group(1)) if thick_match else None,
                "unit":      "kg",
            })

    return products

# ─── Main ─────────────────────────────────────────────────────────────────────
CUSTOMER_FILE = r"C:\Users\Meeting\Desktop\พี่อุ๋ย\ลูกค้า.csv"
PRODUCT_FILE  = r"C:\Users\Meeting\Desktop\พี่อุ๋ย\รหัสสินค้า.CSV"

print("=== Parse ลูกค้า ===")
customers = parse_customers(CUSTOMER_FILE)
print(f"  พบ {len(customers)} รายการ")
for c in customers[:3]:
    print(f"  {c['code']} | {c['name']}")

print("\n=== Parse สินค้า ===")
products = parse_products(PRODUCT_FILE)
print(f"  พบ {len(products)} รายการ")
for p in products[:3]:
    print(f"  {p['item_code']} | {p['part_name']}")

print("\n=== Insert ลูกค้า ===")
# insert ทีละ 50 rows
for i in range(0, len(customers), 50):
    supabase_insert("customers", customers[i:i+50])

print("\n=== Insert สินค้า ===")
for i in range(0, len(products), 50):
    supabase_insert("products", products[i:i+50])

print("\n✓ เสร็จสิ้น")
