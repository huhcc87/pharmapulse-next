# Critical Fixes to Avoid Broken POS

- Do NOT compute totals only on client. Always recompute on server at checkout.
- Do NOT hardcode a single HSN/GST across all products.
- Keep an audit trail for any automated mapping.
- Separate cashier permissions from admin inventory editing.
