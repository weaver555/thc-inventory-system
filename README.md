# THC Inventory System

## Overview
This application tracks restaurant inventory with these operational flows:
- Production
- Stocks In
- Night Operations physical counts
- Beginning stock
- Total available
- Actual usage
- Low stock and replenishment

## Features
- Master Inventory management
- Fraction-friendly quantity input
- Automatic usage calculation
- Dashboard and reports
- CSV export
- SQLite database with audit trail
- Responsive mobile-first UI
- Automated tests

## Requirements
- Node.js 18+
- npm

## Install
1. Open terminal in the project folder.
2. Run:
   npm install
3. Copy the environment file:
   cp .env.example .env
4. Start the server:
   npm start
5. Open:
   http://localhost:4000

## Database
SQLite database is created automatically in the `data` folder. The app creates the schema and seed inventory on first run.

## First-time use
1. Open Master Inventory.
2. Review items.
3. Add missing items.
4. Set categories, units, reorder, critical, target stock.
5. Activate items.
6. Record production.
7. Record stock in.
8. Record physical count.
9. Review dashboard and reports.

## Key formulas
Beginning + Production + Stocks In = Total Available
Total Available - Physical Ending = Actual Usage

If ending exceeds available stock, the system displays:
CHECK COUNT — ENDING STOCK EXCEEDS AVAILABLE STOCK

## Fraction input
Accepted examples:
- 1/2
- 1/4
- 3/4
- 1/8
- 1/3
- 2 1/2
- 2 3/4

## Deployment
Set environment variables in hosting provider and run `npm start`.

## GitHub
1. Create a GitHub account.
2. Create a repository.
3. Commit files.
4. Push to GitHub.

## Testing
Run:
npm test

## App notes
The system stores historical transactions and keeps item IDs stable so renames do not break inventory history.
