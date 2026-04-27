==============================================================
IMPORT INSTRUCTIONS — Home Renovation Budget Tracker
CSV Pack for Google Sheets & Microsoft Excel
==============================================================

CONTENTS
  01_Dashboard.csv
  02_Scope_Budget_by_Room.csv
  03_Change_Order_Log.csv
  04_Payment_Schedule.csv
  05_Materials_Tracker.csv
  06_Instructions.csv

==============================================================
GOOGLE SHEETS — STEP-BY-STEP IMPORT
==============================================================

STEP 1 — Create a new spreadsheet
  a. Go to sheets.google.com → click "+" (Blank)
  b. Name it "Home Renovation Budget Tracker"

STEP 2 — Import each CSV as a separate tab
  a. File → Import → Upload → select 01_Dashboard.csv
  b. Import location: "Insert new sheet(s)"
  c. Separator type: Comma
  d. Convert text to numbers, dates, formulas: Yes
  e. Click "Import data"
  f. Repeat for files 02 through 06

STEP 3 — Paste the formulas (see FORMULA QUICK REFERENCE below)
  Each CSV has a FORMULA REFERENCE section at the bottom.
  Copy each formula and paste into the indicated cell.
  The formulas link tabs together — paste them in tab order (01 → 06).

STEP 4 — Enter your data
  a. Go to the Dashboard tab
  b. Find the "Total Original Budget" row and enter your budget in the value cell
  c. Go to Scope & Budget by Room — enter Original Bid amounts for each room
  d. All other calculations update automatically

CRITICAL RULES:
  - Room/Area names MUST match exactly across all tabs (spelling + capitalization)
    e.g., use "Kitchen" everywhere — not "kitchen" or "KITCHEN"
  - Never delete formula cells (any cell whose content starts with =)
  - To add rows: insert a new row, copy the row above it (right-click → Copy),
    then paste into the new row (right-click → Paste)

==============================================================
MICROSOFT EXCEL — STEP-BY-STEP IMPORT
==============================================================

STEP 1 — Open the first CSV
  File → Open → Browse → select 01_Dashboard.csv → Open

STEP 2 — Save as Excel workbook
  File → Save As → Excel Workbook (.xlsx) → name it "Home-Renovation-Budget-Tracker"

STEP 3 — Import remaining CSVs as tabs
  Open each CSV file, select all (Ctrl+A), copy (Ctrl+C),
  then paste into a new sheet in your main .xlsx workbook.

STEP 4 — Paste the formulas from the FORMULA REFERENCE sections below.

==============================================================
FORMULA QUICK REFERENCE
==============================================================

All formulas assume data starts in row 2 (row 1 = headers).
Tab names must match exactly — adjust if you renamed any tabs.

--- DASHBOARD ---

Total Spent to Date (pulls from Payment Schedule):
  =SUMIF('Payment Schedule'!B:B,'Scope & Budget by Room'!A2:A12,'Payment Schedule'!G:G)
  Simpler version (sums all payments): =SUM('Payment Schedule'!G2:G51)

Total Approved Change Orders (pulls from Change Order Log):
  =SUMIF('Change Order Log'!G2:G51,"Y",'Change Order Log'!F2:F51)

Revised Total Budget:
  =B6+B8
  (Total Original Budget + Total Approved Change Orders)

Overall % Complete:
  =IF(B9=0,0,TEXT(B7/B9,"0.0%"))
  (Total Spent / Revised Total Budget)

Contingency Budget (15% of original):
  =B6*0.15

Contingency Remaining:
  =B13-B8
  (Contingency Budget - Total Approved Change Orders)

--- SCOPE & BUDGET BY ROOM ---

Revised Total (col E, for row 2):
  =C2+D2
  (Original Bid + Approved Change Orders)
  Copy down through all room rows.

Amount Paid — pulls from Payment Schedule (col F, for Kitchen row):
  =SUMIF('Payment Schedule'!B:B,"Kitchen",'Payment Schedule'!G:G)
  Change "Kitchen" to match each room name. Copy/adjust for each row.

Remaining (col G, for row 2):
  =IF(E2=0,"",E2-F2)
  Copy down through all room rows.

Status (col H, for row 2):
  =IF(C2=0,"Not Started",IF(F2>E2,"Over Budget",IF(F2>=E2*0.9,"Watch","On Budget")))
  Copy down through all room rows.

TOTAL row formulas:
  Original Bid total:           =SUM(C2:C12)
  Approved Change Orders total: =SUM(D2:D12)
  Revised Total total:          =SUM(E2:E12)
  Amount Paid total:            =SUM(F2:F12)
  Remaining total:              =SUM(G2:G12)

--- CHANGE ORDER LOG ---

Running Total Impact (col H, for row 2):
  =IF(F2="","",SUMIF($G$2:G2,"Y",$F$2:F2))
  This running total counts only approved (Y) change orders.
  Copy down through all CO rows.

10% Threshold Warning (paste in the green banner cell at top):
  =IF(SUMIF(G2:G51,"Y",F2:F51)>'Dashboard'!B6*0.1,
    "⚠ WARNING: Change orders exceed 10% of original budget — review immediately!",
    "✓ Change orders are within the 10% threshold. Keep monitoring as work progresses.")

--- PAYMENT SCHEDULE ---

Outstanding Balance (col H, for row 2):
  =IF(E2="","",E2-G2)
  (Amount Due - Amount Paid)
  Copy down through all payment rows.

TOTALS row:
  Amount Due total:    =SUM(E2:E51)
  Amount Paid total:   =SUM(G2:G51)
  Outstanding total:   =SUM(H2:H51)

--- MATERIALS TRACKER ---

Variance (col F, for row 2):
  =IF(D2="","",E2-D2)
  (Actual Cost - Budgeted Cost. Negative = savings. Positive = overage.)
  Copy down through all material rows.

TOTALS row:
  Budgeted Cost total: =SUM(D2:D51)
  Actual Cost total:   =SUM(E2:E51)
  Variance total:      =SUM(F2:F51)

==============================================================
TROUBLESHOOTING
==============================================================

Problem: Totals on Dashboard show 0 even after entering data
Fix: Check that Room/Area names match EXACTLY across all tabs.
     "Primary Bathroom" and "Primary Bath" are NOT the same.

Problem: Formula shows as text (not calculating)
Fix: Format the cell as "Automatic" (Google Sheets: Format → Number → Automatic)

Problem: #REF! error
Fix: The formula references a range that doesn't match your data layout.
     Check that your data starts in row 2 (headers in row 1).

Problem: Running Total in Change Order Log not updating
Fix: Make sure column G has exactly "Y" (uppercase, no spaces) for approved orders.

==============================================================
END OF IMPORT INSTRUCTIONS
==============================================================
