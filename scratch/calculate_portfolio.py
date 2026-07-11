import os
import csv
import sys
import json
import sqlite3

def main():
    # Set encoding to UTF-8 for Thai text outputs
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

    raw_data_dir = "./raw_data"
    if not os.path.exists(raw_data_dir):
        raw_data_dir = "d:/Investment_Port_Project/raw_data"

    if not os.path.exists(raw_data_dir):
        print(f"Error: Raw data directory '{raw_data_dir}' not found.", file=sys.stderr)
        sys.exit(1)

    # ค้นหาพาธของ SQLite database ของโปรเจกต์
    db_paths = [
        "./backend/data/portfolio.db",
        "../backend/data/portfolio.db",
        "d:/Investment_Port_Project/backend/data/portfolio.db"
    ]
    db_path = None
    for path in db_paths:
        if os.path.exists(os.path.dirname(path)):
            db_path = path
            break

    if not db_path:
        print("Error: Could not locate backend database directory.", file=sys.stderr)
        sys.exit(1)

    transactions = []

    # 1. อ่านข้อมูลจาก CSV ทุกไฟล์ในโฟลเดอร์ raw_data
    for filename in sorted(os.listdir(raw_data_dir)):
        if not filename.endswith(".csv"):
            continue
        filepath = os.path.join(raw_data_dir, filename)
        with open(filepath, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()
            
        in_trade_records = False
        file_txs = []
        
        for idx, line in enumerate(lines):
            stripped = line.strip()
            if not stripped:
                continue
            
            # ตรวจสอบส่วนข้อมูล
            if "TRADE RECORDS" in stripped:
                in_trade_records = True
                continue
            elif "PORTFOLIO SUMMARY" in stripped:
                in_trade_records = False
                continue
            elif stripped.startswith("Options") or "Multi Portfolio" in stripped or "Portfolio Advisory" in stripped:
                continue
                
            # แปลงรายการใน Trade Records
            if in_trade_records:
                parts = [p.strip() for p in csv.reader([stripped]).__next__()]
                if len(parts) >= 10 and parts[0] != "Symbol & Name" and parts[1] != "":
                    symbol_name = parts[0]
                    symbol = symbol_name.split()[0]
                    trade_date = parts[1]
                    settle_date = parts[2]
                    action = parts[3]
                    qty = float(parts[4])
                    price = float(parts[5])
                    gross = float(parts[6].replace(',', ''))
                    comm = float(parts[7])
                    vat = float(parts[8])
                    net = float(parts[9].replace(',', ''))
                    
                    # แปลงวันที่
                    day, month, year = trade_date.split('/')
                    iso_date = f"{year}-{month}-{day}"
                    
                    # คำนวณค่าธรรมเนียมรวม
                    fees = comm + vat
                    
                    file_txs.append({
                        "symbol": symbol,
                        "type": action, # BUY or SELL
                        "shares": qty,
                        "price": price,
                        "fees": fees,
                        "date": iso_date
                    })
                    
        # เรียงข้อมูลจากล่างขึ้นบนของแต่ละไฟล์ (เนื่องจากรายการในไฟล์เรียงจากล่าสุดไปอดีต)
        file_txs.reverse()
        transactions.extend(file_txs)

    if not transactions:
        print("No transactions found in the CSV files.", file=sys.stderr)
        sys.exit(0)

    # 2. เชื่อมต่อฐานข้อมูล SQLite และอ่านข้อมูลเดิมเพื่อป้องกันการซ้ำซ้อน
    print(f"Connecting to database: {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # สร้างตารางหากยังไม่มี
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          symbol TEXT NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('BUY', 'SELL')),
          shares REAL NOT NULL,
          price REAL NOT NULL,
          fees REAL NOT NULL DEFAULT 0.0,
          date TEXT NOT NULL
        )
    """)

    # ดึงข้อมูลธุรกรรมเดิมที่มีอยู่แล้วใน DB มาทำเป็น Set เพื่อเช็คความซ้ำซ้อนของเนื้อหาข้อมูล
    cursor.execute("SELECT id, symbol, type, shares, price, date FROM transactions")
    existing_rows = cursor.fetchall()
    
    existing_txs_set = set()
    db_date_max_index = {}
    
    for tx_id, symbol, tx_type, shares, price, date in existing_rows:
        # จัดรูปแบบข้อมูลเพื่อใช้ในการเปรียบเทียบหาตัวซ้ำ
        tx_tuple = (symbol.upper().strip(), tx_type.upper().strip(), round(shares, 5), round(price, 4), date.strip())
        existing_txs_set.add(tx_tuple)
        
        # ตรวจสอบหาค่าดัชนี (Index) สูงสุดของวันนั้น ๆ เพื่อใช้รัน ID ต่อไป (เช่น csv_2025110504 -> index = 4)
        if tx_id.startswith("csv_") and len(tx_id) == 14:
            date_part = tx_id[4:12] # YYYYMMDD
            index_part = tx_id[12:] # NN
            try:
                idx = int(index_part)
                if idx > db_date_max_index.get(date_part, 0):
                    db_date_max_index[date_part] = idx
            except ValueError:
                pass

    # นับจำนวนแถวก่อนการเพิ่มข้อมูล
    initial_count = len(existing_rows)

    # 3. นำเข้าข้อมูลเฉพาะรายการที่ยังไม่มีใน Database
    inserted_count = 0
    skipped_count = 0
    
    # เรียงลำดับธุรกรรมทั้งหมดตามวันที่ก่อนนำเข้า เพื่อให้รันดัชนี (NN) ใน ID ได้อย่างถูกต้อง
    transactions.sort(key=lambda x: x["date"])

    for tx in transactions:
        tx_tuple = (tx["symbol"].upper().strip(), tx["type"].upper().strip(), round(tx["shares"], 5), round(tx["price"], 4), tx["date"].strip())
        
        if tx_tuple in existing_txs_set:
            skipped_count += 1
            continue
            
        # สร้าง ID ใหม่ตามรูปแบบ csv_YYYYMMDDNN
        date_str = tx["date"].replace("-", "")
        next_idx = db_date_max_index.get(date_str, 0) + 1
        db_date_max_index[date_str] = next_idx
        tx_id = f"csv_{date_str}{next_idx:02d}"
        
        # บันทึกลง Database
        cursor.execute("""
            INSERT INTO transactions (id, symbol, type, shares, price, fees, date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (tx_id, tx["symbol"], tx["type"], tx["shares"], tx["price"], tx["fees"], tx["date"]))
        
        # เพิ่มเข้าไปในชุดข้อมูลที่บันทึกแล้วเพื่อป้องกันการซ้ำหากใน CSV มีบรรทัดที่ซ้ำกัน
        existing_txs_set.add(tx_tuple)
        inserted_count += 1

    conn.commit()

    # นับจำนวนแถวหลังการเพิ่มข้อมูล
    cursor.execute("SELECT COUNT(*) FROM transactions")
    final_count = cursor.fetchone()[0]
    conn.close()

    print(f"\n=== CSV Extraction & Database Seeding Summary ===")
    print(f"Total transactions extracted from CSV: {len(transactions)}")
    print(f"Initial transactions in DB: {initial_count}")
    print(f"New transactions successfully imported: {inserted_count}")
    print(f"Duplicate/Existing transactions skipped: {skipped_count}")
    print(f"Total transactions now in DB: {final_count}")

if __name__ == "__main__":
    main()


