from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from openpyxl import Workbook

from backend.source_api.kmitora_source_api import SourceRecord, list_file_objects, preview_file


class FileSourceFormatTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "customers.txt").write_text("id|name\n1|Asha\n2|Ben\n", encoding="utf-8")
        (self.root / "scenario_customers.csv").write_text(
            "customer_id,scenario_id,name\n"
            "C1,SCN-MIG-006,Asha\n"
            "C2,SCN-GT-001,Ben\n"
            "C3,SCN-MIG-006,Chen\n",
            encoding="utf-8",
        )
        (self.root / "loans.xml").write_text(
            "<loans><loan id='L1'><customer>C1</customer><amount>100</amount></loan>"
            "<loan id='L2'><customer>C2</customer><amount>200</amount></loan></loans>",
            encoding="utf-8",
        )
        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Customers"
        sheet.append(["customer_id", "name"])
        sheet.append(["C1", "Asha"])
        sheet.append(["C2", "Ben"])
        orders = workbook.create_sheet("Orders")
        orders.append(["order_id", "customer_id"])
        orders.append(["O1", "C1"])
        workbook.save(self.root / "master.xlsx")
        workbook.close()
        self.record = SourceRecord(
            id="SRC-TEST",
            name="Mixed source",
            type="file",
            status="connected",
            filePath=str(self.root),
        )

    def tearDown(self):
        self.temp.cleanup()

    def test_inventory_includes_txt_xml_and_excel_sheets(self):
        names = {item["name"] for item in list_file_objects(self.record)}
        self.assertIn("customers.txt", names)
        self.assertIn("loans.xml", names)
        self.assertIn("master.xlsx::Customers", names)
        self.assertIn("master.xlsx::Orders", names)

    def test_txt_delimited_preview(self):
        preview = preview_file(self.record, "customers.txt", 10)
        self.assertEqual(preview["columns"], ["id", "name"])
        self.assertEqual(preview["rows"][0]["name"], "Asha")

    def test_xml_preview(self):
        preview = preview_file(self.record, "loans.xml", 10)
        self.assertEqual(preview["totalRows"], 2)
        self.assertEqual(preview["rows"][0]["@id"], "L1")
        self.assertEqual(preview["rows"][0]["customer"], "C1")

    def test_excel_sheet_preview(self):
        preview = preview_file(self.record, "master.xlsx::Orders", 10)
        self.assertEqual(preview["sheet"], "Orders")
        self.assertEqual(preview["rows"][0]["order_id"], "O1")


    def test_csv_preview_applies_read_only_scope_filter(self):
        preview = preview_file(
            self.record,
            "scenario_customers.csv",
            10,
            scope_field="scenario_id",
            scope_operator="EQ",
            scope_value="SCN-MIG-006",
        )
        self.assertEqual(preview["scannedRows"], 3)
        self.assertEqual(preview["totalRows"], 2)
        self.assertTrue(preview["scopeApplied"])
        self.assertEqual([row["customer_id"] for row in preview["rows"]], ["C1", "C3"])

    def test_path_escape_is_blocked(self):
        with self.assertRaises(ValueError):
            preview_file(self.record, "../outside.txt", 10)


if __name__ == "__main__":
    unittest.main()
