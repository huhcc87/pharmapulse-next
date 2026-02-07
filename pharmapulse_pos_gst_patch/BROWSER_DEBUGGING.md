# Browser Debugging Checklist (POS)

1) Open DevTools → Console:
   - any red errors? missing imports? prisma errors?
2) DevTools → Network:
   - scan a product
   - check `/api/pos/product?barcode=...` response
3) If 404 not found:
   - ensure Product.barcode is populated for that item
4) If 500:
   - check server logs in terminal
5) If totals look wrong:
   - verify taxInclusion and gstRate values
