==============================================================
IMPORT INSTRUCTIONS — Contractor Comparison & Bid Tracker
CSV Pack for Google Sheets & Microsoft Excel
==============================================================

CONTENTS OF THIS FOLDER
  01_Dashboard.csv
  02_Bid_Comparison.csv
  03_Contractor_Scoring.csv
  04_License_Insurance_Verification.csv
  05_Reference_Check_Log.csv
  06_Contract_Checklist.csv
  07_Instructions.csv

==============================================================
GOOGLE SHEETS — STEP-BY-STEP IMPORT
==============================================================

STEP 1 — Create a new spreadsheet
  a. Go to sheets.google.com
  b. Click the "+" (Blank) button to create a new spreadsheet
  c. Name it "Contractor Comparison & Bid Tracker" (click "Untitled spreadsheet")

STEP 2 — Import the first CSV (Dashboard)
  a. Click File → Import
  b. Click "Upload" tab → drag 01_Dashboard.csv into the window (or click Browse)
  c. Import location: "Insert new sheet(s)"
  d. Separator type: "Comma"
  e. Convert text to numbers, dates, and formulas: "Yes"
  f. Click "Import data"
  g. The sheet tab will be named "01_Dashboard" — rename it "Dashboard" if desired

STEP 3 — Import the remaining CSVs (repeat for each file)
  a. Click File → Import again
  b. Upload the next CSV file
  c. Use the SAME settings as Step 2 (Insert new sheet, Comma, Yes)
  d. Repeat for: 02, 03, 04, 05, 06, 07

STEP 4 — Add the formulas
  Each CSV has a "FORMULA REFERENCE" section near the bottom.
  a. Scroll to the bottom of each imported sheet
  b. Find the FORMULA REFERENCE rows
  c. Copy the formula from the "Formula" column
  d. Click the cell shown in the "Paste into cell" column
  e. Paste (Ctrl+V or Cmd+V) — Google Sheets will activate the formula automatically

STEP 5 — Apply conditional formatting (optional, for color-coding)
  a. Select the column you want to color (e.g., "Total Bid" column in Bid Comparison)
  b. Format → Conditional formatting
  c. Use "Custom formula is" rule:
     - Lowest bid (green): =AND(I2<>"",I2=MIN($I$2:$I$11))  → fill: sage green #7D9B76
     - Above average (yellow): =AND(I2<>"",I2>AVERAGE($I$2:$I$11)*1.1) → fill: amber #D4A843
  d. Click Done

==============================================================
MICROSOFT EXCEL — STEP-BY-STEP IMPORT
==============================================================

STEP 1 — Open each CSV in Excel
  a. In Excel, click File → Open → Browse
  b. Navigate to this folder
  c. Change "File type" dropdown to "All Files (*.*)" to see CSV files
  d. Select 01_Dashboard.csv and click Open
  e. If the Text Import Wizard appears: Delimited → Next → Comma → Finish

STEP 2 — Save as an Excel workbook
  a. After opening the first CSV, click File → Save As
  b. Change "Save as type" to "Excel Workbook (*.xlsx)"
  c. Name it "Contractor-Bid-Tracker.xlsx"
  d. Click Save

STEP 3 — Move sheets into one workbook
  Option A (copy-paste): Open each CSV file, select all (Ctrl+A), copy (Ctrl+C),
    then paste into a new sheet in your main .xlsx workbook.
  Option B (move sheet): Right-click the sheet tab → Move or Copy → select your
    .xlsx as the destination workbook → OK.

STEP 4 — Add the formulas
  Same as Google Sheets: scroll to the FORMULA REFERENCE section in each tab,
  copy the formula text, and paste it into the indicated cell.

NOTE: Excel uses the same formula syntax as Google Sheets for all formulas in
this workbook. No conversion needed.

==============================================================
TROUBLESHOOTING
==============================================================

Problem: Numbers imported as text (can't sum them)
Fix: Select the column → Data → Text to Columns → Delimited → Finish
     OR: In Google Sheets, Format → Number → Number

Problem: Dates imported as text
Fix: Select date cells → Format → Number → Date (or use DATEVALUE() formula)

Problem: Formula shows as text instead of calculating
Fix: Make sure the cell is formatted as "Automatic" not "Plain text"
     In Google Sheets: Format → Number → Automatic
     In Excel: Home → Number → General

Problem: #REF! error in a formula
Fix: The formula is referencing a cell range that doesn't match your data.
     Check that your data starts in row 2 (header in row 1) and adjust
     the row numbers in the formula to match.

Problem: #DIV/0! error in Scoring tab
Fix: This appears when all bids are identical (can't divide by zero range).
     Enter at least two different bid amounts and the error will resolve.

==============================================================
FORMULA QUICK REFERENCE
==============================================================

All formulas assume:
  - Data starts in row 2 (row 1 = column headers)
  - 10 contractor rows: rows 2–11
  - Tab names match the CSV filenames (adjust if you renamed tabs)

DASHBOARD CROSS-TAB FORMULAS
  Lowest bid amount:
    =MIN('Bid Comparison'!I2:I11)

  Company with lowest bid:
    =INDEX('Bid Comparison'!B2:B11,MATCH(MIN('Bid Comparison'!I2:I11),'Bid Comparison'!I2:I11,0))

  Highest score:
    =MAX('Contractor Scoring'!I2:I11)

  Company with highest score:
    =INDEX('Contractor Scoring'!B2:B11,MATCH(MAX('Contractor Scoring'!I2:I11),'Contractor Scoring'!I2:I11,0))

BID COMPARISON WITHIN-TAB FORMULAS
  Total bid (col I, for row 2): =G2+H2
  Copy down through row 11.

  Bid expiry status (col K, for row 2):
    =IF(J2="","",IF(J2<TODAY(),"EXPIRED",IF(J2<TODAY()+30,"EXPIRING SOON","VALID")))

  Materials outlier flag (col L, for row 2):
    =IF(G2="","",IF(ABS(G2-AVERAGE($G$2:$G$11))>AVERAGE($G$2:$G$11)*0.25,"OUTLIER","OK"))

CONTRACTOR SCORING WITHIN-TAB FORMULAS
  Price score — auto from bids (col D, for row 2):
    =IF(C2="","",IF(MAX($C$2:$C$11)=MIN($C$2:$C$11),50,ROUND((MAX($C$2:$C$11)-C2)/(MAX($C$2:$C$11)-MIN($C$2:$C$11))*100,0)))

  Weighted total (col I, for row 2):
    =IF(D2="","",ROUND(D2*0.3+E2*0.2+F2*0.2+G2*0.2+H2*0.1,1))

  Rank (col J, for row 2):
    =IF(I2="","",RANK(I2,$I$2:$I$11,0))

LICENSE & INSURANCE WITHIN-TAB FORMULAS
  License expiry status (col F, for row 2):
    =IF(E2="","",IF(E2<TODAY(),"EXPIRED",IF(E2<TODAY()+90,"EXPIRING","VALID")))

  Fully verified (col P, for row 2):
    =IF(AND(F2="Y",J2="Y",N2="Y"),"FULLY VERIFIED","INCOMPLETE")

REFERENCE CHECK LOG WITHIN-TAB FORMULAS
  Per-contractor average quality (for contractor #1, assuming quality in col L):
    =IFERROR(AVERAGEIF($B$2:$B$31,1,$L$2:$L$31),"")
  Change the second argument (1) to the contractor number (1–10).

CONTRACT CHECKLIST WITHIN-TAB FORMULAS
  Items verified count:
    =COUNTIF(C2:C11,"Y")

  Completion percentage:
    =TEXT(COUNTIF(C2:C11,"Y")/10,"0%") & " Complete"

==============================================================
END OF IMPORT INSTRUCTIONS
==============================================================
