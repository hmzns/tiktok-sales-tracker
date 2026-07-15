# Testing Checklist

Use this checklist before merging major changes or preparing the app for deployment.

## Backend

### Health and Docs
- [ ] `GET /health` returns success
- [ ] `GET /api-docs` returns API documentation

### Products
- [ ] Create product
- [ ] View product list
- [ ] Search product by name
- [ ] Search product by SKU
- [ ] Edit product
- [ ] Deactivate product
- [ ] Reactivate product
- [ ] Low stock endpoint works

### Product Categories
- [ ] Create category
- [ ] Edit category
- [ ] Deactivate category
- [ ] Reactivate category
- [ ] Inactive categories are hidden from product forms

### Orders
- [ ] Create order with one product
- [ ] Create order with multiple products
- [ ] View order list
- [ ] Search order by customer name
- [ ] Search order by order number
- [ ] Filter orders by status
- [ ] View order detail
- [ ] Mark order as shipped
- [ ] Mark order as delivered
- [ ] Cancel order with confirmation
- [ ] Refund order with confirmation
- [ ] Cancel/refund restores stock correctly

### Expenses
- [ ] Add expense
- [ ] Edit expense
- [ ] Delete expense
- [ ] Search expense
- [ ] Filter expense by category

### Stock
- [ ] Manual restock works
- [ ] Manual stock out works
- [ ] Damage adjustment works
- [ ] Stock movement history is recorded
- [ ] Order creation creates SALE stock movement
- [ ] Cancel/refund creates restore stock movement

### Dashboard and Reports
- [ ] Dashboard summary loads
- [ ] Dashboard values update after order changes
- [ ] Dashboard values update after expense changes
- [ ] Monthly report loads
- [ ] Previous month button works
- [ ] Next month button works
- [ ] Report values update correctly

## Mobile App

### Navigation
- [ ] Bottom tabs appear
- [ ] Dashboard tab works
- [ ] Products tab works
- [ ] Orders tab works
- [ ] Expenses tab works
- [ ] Reports tab works
- [ ] Stock Activity screen opens from Dashboard

### Product Flow
- [ ] Add product from mobile
- [ ] Edit product from mobile
- [ ] Search product
- [ ] Low stock filter works
- [ ] Inactive product does not appear in Create Order

### Category Flow
- [ ] Manage Categories screen opens
- [ ] Add category
- [ ] Edit category
- [ ] Inactive category is hidden from Add Product
- [ ] Current inactive category still appears in Edit Product with label

### Order Flow
- [ ] Create order with one product
- [ ] Create order with multiple products
- [ ] Remove item before creating order
- [ ] Prevent quantity higher than stock
- [ ] View order detail
- [ ] Mark shipped
- [ ] Mark delivered
- [ ] Cancel order confirmation appears
- [ ] Refund order confirmation appears
- [ ] Orders list updates after returning from detail

### Expense Flow
- [ ] Add expense
- [ ] Edit expense
- [ ] Delete expense confirmation appears
- [ ] Search expense
- [ ] Filter expense

### Auto-refresh
- [ ] Products refresh when opened
- [ ] Dashboard refreshes when opened
- [ ] Reports refresh when opened
- [ ] Stock Movements refresh when opened
- [ ] Orders refresh after returning from Order Detail

## Final Result

- [ ] App can be used to track products
- [ ] App can be used to track orders
- [ ] App can be used to track expenses
- [ ] App can calculate sales profit
- [ ] App can calculate net profit
- [ ] App can track stock movement
- [ ] App is ready for manual use before TikTok API integration