import csv
import os
import re

SCHEMA_FILE = "database/schema/DATASTORE_SCHEMA.md"
CSV_ROOT = "database/datastore_csv"

# -----------------------------
# Parse schema
# -----------------------------
table_boolean_columns = {}

current_table = None

with open(SCHEMA_FILE, "r", encoding="utf-8") as f:
    for line in f:

        # Detect table headers
        if line.startswith("### "):
            current_table = line.replace("###", "").strip()
            table_boolean_columns[current_table] = []

        # Parse markdown rows
        if line.startswith("|") and "Boolean" in line:

            parts = [x.strip() for x in line.strip().split("|")]

            # Markdown format:
            # | Column | Type | Notes |
            if len(parts) >= 3:
                column = parts[1]
                datatype = parts[2]

                if datatype == "Boolean":
                    table_boolean_columns[current_table].append(column)

print("\nBoolean Columns Found:\n")

for table, cols in table_boolean_columns.items():
    if cols:
        print(table, "->", cols)

# -----------------------------
# Convert CSVs
# -----------------------------

for root, dirs, files in os.walk(CSV_ROOT):

    for file in files:

        if not file.endswith(".csv"):
            continue

        table_name = os.path.splitext(file)[0]

        if table_name not in table_boolean_columns:
            continue

        bool_cols = table_boolean_columns[table_name]

        if not bool_cols:
            continue

        path = os.path.join(root, file)

        print(f"\nProcessing {file}")

        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        for row in rows:

            for col in bool_cols:

                if col not in row:
                    continue

                value = str(row[col]).strip().lower()

                if value == "1":
                    row[col] = "true"

                elif value == "0":
                    row[col] = "false"

        with open(path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=reader.fieldnames)
            writer.writeheader()
            writer.writerows(rows)

        print("Done.")

print("\nFinished.")