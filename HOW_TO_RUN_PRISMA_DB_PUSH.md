# How to Run Prisma DB Push

## 📋 **Step-by-Step Instructions**

### **Method 1: Using npx (Recommended)**

1. **Open Terminal** on your laptop
   - On Mac: Press `Cmd + Space`, type "Terminal", press Enter
   - On Windows: Press `Win + R`, type "cmd", press Enter
   - On Linux: Press `Ctrl + Alt + T`

2. **Navigate to the project directory:**
   ```bash
   cd /Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next
   ```

3. **Run the migration command:**
   ```bash
   npx prisma db push
   ```

---

### **Method 2: Using npm script (Alternative)**

Since the project has a script defined in `package.json`, you can also use:

```bash
cd /Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next
npm run db:push
```

---

### **Method 3: Using yarn (If you use yarn)**

```bash
cd /Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next
yarn prisma db push
```

---

## ⚠️ **Important Notes**

### **Before Running:**
1. Make sure your `.env` file has the correct `DATABASE_URL`
2. Ensure your database is accessible
3. Make sure you have Node.js and npm installed

### **What `prisma db push` Does:**
- Pushes your Prisma schema changes to the database
- Creates new tables and columns
- Does NOT delete data (safe to run)
- Fast for development

### **After Running:**
- You should see output like: "✅ Your database is now in sync with your Prisma schema"
- New tables will be created:
  - `ai_drug_interactions`
  - `ai_prescription_autofill`
  - `ai_demand_forecast_advanced`
  - `ai_price_intelligence`
  - `ai_competitor_analysis`
  - `ai_customer_lifetime_value`

---

## 🐛 **Troubleshooting**

### **Error: "Can't reach database server"**
- Check your `DATABASE_URL` in `.env` file
- Ensure your database server is running

### **Error: "Authentication failed"**
- Verify database credentials in `.env` file
- Check if database user has proper permissions

### **Error: "Schema has changed"**
- This is normal - Prisma will show what changes will be made
- Review the changes and confirm

---

## 📝 **Full Command Example**

```bash
# Navigate to project
cd /Users/mudasirrashid/Documents/Idea-Development-Pharmapl/pharmapulse-next

# Run migration
npx prisma db push

# Optional: Generate Prisma Client (usually done automatically)
npx prisma generate
```

---

**That's it!** Your database will be updated with all the new AI feature tables.
