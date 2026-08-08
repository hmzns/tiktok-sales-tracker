# Seller User Guide

This guide explains the daily tasks in TikTok Sales Tracker.

## 1. Opening the app

Open the web address given by the administrator. Complete the Cloudflare Access email check if asked. The first load can take longer when the backend has been inactive; wait a moment and use **Try again** if needed.

## 2. Dashboard overview

The Dashboard shows this month's revenue, sales profit, expenses, net profit, orders, items sold, low-stock products, and recent stock activity. **Orders Needing Items** opens TikTok orders that still need product details.

Finance Pending FULL_TIKTOK orders count as orders and units, but are not shown as RM0 in financial totals.

## 3. Adding or editing products

1. Open **Products**.
2. Select **Add Product**.
3. Enter the product name, unique SKU, cost price, selling price, starting stock, and category.
4. Save the product.

Use **Edit** on a product to change its details or active status. Old orders keep their original price and cost snapshots when the catalogue changes.

## 4. Adjusting stock

Open **Dashboard > Stock activity**, then choose **Restock / Adjust Stock**. Select the product, movement type, quantity, and an optional note or reference.

- **Restock** or **Manual In** adds stock.
- **Manual Out** or **Damage** removes stock.

## 5. Syncing TikTok orders

Open **Orders** and select **Sync TikTok Orders**. The app imports new TikTok orders and ignores orders already stored. A new import starts as **Needs Items** and does not change stock yet.

## 6. Needs Items workflow

1. Open an order marked **Needs Items**.
2. Add the matching tracker products.
3. Enter the quantity for each product.
4. Choose the payment method.
5. Check all values, then complete the order once.

The tracker does not automatically map TikTok SKUs to products. Choose the correct tracker product yourself.

## 7. Choosing the payment method

Choose **Paid fully through TikTok Shop** when TikTok collected the full product payment.

Choose **Product paid outside TikTok / WhatsApp** when you collected the product payment separately. Use this even if TikTok later pays a settlement for another part of the order.

If the wrong method was selected, it can be changed on a completed TikTok order. Changing it does not deduct stock again or remove saved price, cost, discount, or Finance data.

## 8. Completing a FULL_TIKTOK order

1. Select products and quantities.
2. Choose **Paid fully through TikTok Shop**.
3. Complete the order.

Stock is deducted once. The tracker saves the current product selling price and cost for history, but the tracker selling price does not decide final TikTok profit.

Finance may show **Pending** because TikTok has not settled the order. Later, open the completed order and select **Sync TikTok Finance**. After settlement, final profit is TikTok settlement minus the saved historical product cost.

## 9. Completing an EXTERNAL_PRODUCT_PAYMENT order

1. Select products and quantities.
2. Choose **Product paid outside TikTok / WhatsApp**.
3. Add a fixed or percentage discount if needed.
4. Complete the order.

The tracker product price is used for product revenue. When TikTok Finance becomes available, the TikTok settlement is added once. The saved historical product cost is then deducted.

## 10. Cancelling or refunding an order

Open the completed order and choose **Cancelled** or **Refunded**. Confirm the warning. If the order previously deducted stock, the app restores it and records a stock movement.

Cancelled and refunded orders are final and do not count in sales reports.

## 11. Adding expenses

Open **Expenses**, select **Add Expense**, and enter the title, amount, category, date, and optional description. Expenses reduce net profit for their selected date.

## 12. Using Reports

Open **Reports** and choose a month.

- **Overview** shows sales, cost, profit, expenses, orders, and exports.
- **Product Performance** uses saved order-item prices and costs.
- **Sales Trends** shows day-by-day results and loads only when that section is opened.

FULL_TIKTOK settlement cannot always be divided accurately between products, so its order-level Finance profit is excluded from per-product financial totals. Units are still counted.

## 13. Exporting data

Exports are available in the web version. Use **Export** on Products or Expenses, or the export buttons in Reports. CSV files open in spreadsheet applications. Report data is also available as JSON through the protected API for administrative use.

## 14. Checking TikTok Sync Status

Open **Orders**, then open the TikTok sync status panel. It shows the last attempt, last successful sync, counts, duration, source, and a safe error category. Retry after fixing any connection or authorization message.

## 15. Common messages

- **Needs Items**: choose tracker products and quantities before completing the order.
- **Completed**: items are confirmed and stock processing has finished.
- **Finance Pending**: TikTok has not returned a final settlement; FULL_TIKTOK profit is still unknown.
- **Finance Settled**: the saved settlement is included in the correct profit formula.
- **Cancelled**: the order is excluded from sales and processed stock was restored.
- **Refunded**: the order is excluded from sales and processed stock was restored.

## 16. What not to do

- Do not manually deduct stock after completing an order.
- Do not treat the buyer shipping fee as seller profit.
- Do not manually edit TikTok settlement numbers.
- Do not repeatedly complete the same order.
- Do not guess a tracker product when the TikTok item is unclear; confirm the mapping first.
