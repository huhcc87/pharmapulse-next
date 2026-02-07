-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CASHIER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "category" TEXT NOT NULL,
    "manufacturer" TEXT,
    "composition" TEXT,
    "saltComposition" TEXT,
    "hsnCode" TEXT,
    "schedule" TEXT,
    "description" TEXT,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "mrp" DOUBLE PRECISION,
    "stockLevel" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugMolecule" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugMolecule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugFormulation" (
    "id" SERIAL NOT NULL,
    "displayName" TEXT NOT NULL,
    "dosageForm" TEXT NOT NULL,
    "route" TEXT,
    "strengthText" TEXT,
    "composition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugFormulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugFormulationMolecule" (
    "id" SERIAL NOT NULL,
    "formulationId" INTEGER NOT NULL,
    "moleculeId" INTEGER NOT NULL,
    "strengthValue" DOUBLE PRECISION,
    "strengthUnit" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugFormulationMolecule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugBrand" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "formulationId" INTEGER NOT NULL,
    "manufacturerId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugBrand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugPack" (
    "id" SERIAL NOT NULL,
    "brandId" INTEGER NOT NULL,
    "packSize" TEXT,
    "mrp" DOUBLE PRECISION,
    "hsn" TEXT,
    "gstRate" DOUBLE PRECISION,
    "barcodes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrugPack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrugAlias" (
    "id" SERIAL NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "packId" INTEGER,
    "brandId" INTEGER,
    "formulationId" INTEGER,
    "moleculeId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DrugAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantProductMap" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "branchId" INTEGER,
    "localProductId" INTEGER,
    "mappedPackId" INTEGER,
    "mappedBrandId" INTEGER,
    "mappedFormulationId" INTEGER,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantProductMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantAlias" (
    "id" SERIAL NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "alias" TEXT NOT NULL,
    "aliasType" TEXT NOT NULL,
    "mappedPackId" INTEGER,
    "mappedBrandId" INTEGER,
    "mappedFormulationId" INTEGER,
    "mappedMoleculeId" INTEGER,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "batchCode" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantityOnHand" INTEGER NOT NULL DEFAULT 0,
    "purchaseCost" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiJob" (
    "id" SERIAL NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "inputJson" TEXT NOT NULL,
    "outputJson" TEXT,
    "errorJson" TEXT,
    "modelVersion" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AiJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DemandForecast" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "horizonDays" INTEGER NOT NULL,
    "forecastQty" DOUBLE PRECISION NOT NULL,
    "forecastSeriesJson" TEXT,
    "confidenceLevel" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "inputsSummaryJson" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DemandForecast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_library" (
    "id" INTEGER NOT NULL,
    "brand_name" TEXT NOT NULL,
    "brand_name_norm" TEXT,
    "manufacturer" TEXT,
    "manufacturer_norm" TEXT,
    "price_inr" TEXT,
    "is_discontinued" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "category" TEXT,
    "pack_size" TEXT,
    "pack_size_norm" TEXT,
    "full_composition" TEXT,
    "composition_norm" TEXT,
    "salts" TEXT,
    "salts_norm" TEXT,
    "composition_1" TEXT,
    "composition_2" TEXT,
    "gst_percent" DOUBLE PRECISION,
    "schedule" TEXT,
    "rx_otc" TEXT,
    "dpco_ceiling_price_inr" DOUBLE PRECISION,
    "qr_code" TEXT NOT NULL,
    "qr_payload" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "drug_library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "drug_library_id" INTEGER NOT NULL,
    "qty_on_hand" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER DEFAULT 0,
    "expiry_date" TIMESTAMP(3),
    "purchase_price" DOUBLE PRECISION,
    "selling_price" DOUBLE PRECISION,
    "batch_code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "before_json" TEXT,
    "after_json" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_scan_events" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "user_id" INTEGER,
    "qr_code" TEXT NOT NULL,
    "drug_library_id" INTEGER NOT NULL,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drug_scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drug_scan_memory" (
    "id" SERIAL NOT NULL,
    "tenant_id" INTEGER NOT NULL,
    "branch_id" INTEGER,
    "qr_code" TEXT NOT NULL,
    "drug_library_id" INTEGER NOT NULL,
    "last_scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_added_to_inventory_at" TIMESTAMP(3),
    "scan_count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "drug_scan_memory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_barcode_key" ON "Product"("barcode");

-- CreateIndex
CREATE UNIQUE INDEX "DrugMolecule_name_key" ON "DrugMolecule"("name");

-- CreateIndex
CREATE INDEX "DrugFormulationMolecule_moleculeId_idx" ON "DrugFormulationMolecule"("moleculeId");

-- CreateIndex
CREATE UNIQUE INDEX "DrugFormulationMolecule_formulationId_moleculeId_key" ON "DrugFormulationMolecule"("formulationId", "moleculeId");

-- CreateIndex
CREATE UNIQUE INDEX "Manufacturer_name_key" ON "Manufacturer"("name");

-- CreateIndex
CREATE INDEX "DrugBrand_name_idx" ON "DrugBrand"("name");

-- CreateIndex
CREATE INDEX "DrugBrand_formulationId_idx" ON "DrugBrand"("formulationId");

-- CreateIndex
CREATE INDEX "DrugPack_brandId_idx" ON "DrugPack"("brandId");

-- CreateIndex
CREATE INDEX "DrugAlias_alias_idx" ON "DrugAlias"("alias");

-- CreateIndex
CREATE INDEX "DrugAlias_aliasType_idx" ON "DrugAlias"("aliasType");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProductMap_idempotencyKey_key" ON "TenantProductMap"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TenantProductMap_tenantId_idx" ON "TenantProductMap"("tenantId");

-- CreateIndex
CREATE INDEX "TenantProductMap_branchId_idx" ON "TenantProductMap"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantProductMap_tenantId_localProductId_key" ON "TenantProductMap"("tenantId", "localProductId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantAlias_idempotencyKey_key" ON "TenantAlias"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TenantAlias_tenantId_alias_idx" ON "TenantAlias"("tenantId", "alias");

-- CreateIndex
CREATE INDEX "TenantAlias_alias_idx" ON "TenantAlias"("alias");

-- CreateIndex
CREATE INDEX "TenantAlias_aliasType_idx" ON "TenantAlias"("aliasType");

-- CreateIndex
CREATE UNIQUE INDEX "AiJob_idempotencyKey_key" ON "AiJob"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "drug_library_qr_code_key" ON "drug_library"("qr_code");

-- CreateIndex
CREATE INDEX "drug_library_brand_name_idx" ON "drug_library"("brand_name");

-- CreateIndex
CREATE INDEX "drug_library_brand_name_norm_idx" ON "drug_library"("brand_name_norm");

-- CreateIndex
CREATE INDEX "drug_library_manufacturer_idx" ON "drug_library"("manufacturer");

-- CreateIndex
CREATE INDEX "drug_library_manufacturer_norm_idx" ON "drug_library"("manufacturer_norm");

-- CreateIndex
CREATE INDEX "drug_library_category_idx" ON "drug_library"("category");

-- CreateIndex
CREATE INDEX "drug_library_salts_idx" ON "drug_library"("salts");

-- CreateIndex
CREATE INDEX "drug_library_salts_norm_idx" ON "drug_library"("salts_norm");

-- CreateIndex
CREATE INDEX "drug_library_is_discontinued_idx" ON "drug_library"("is_discontinued");

-- CreateIndex
CREATE INDEX "drug_library_full_composition_idx" ON "drug_library"("full_composition");

-- CreateIndex
CREATE INDEX "drug_library_composition_norm_idx" ON "drug_library"("composition_norm");

-- CreateIndex
CREATE INDEX "drug_library_pack_size_norm_idx" ON "drug_library"("pack_size_norm");

-- CreateIndex
CREATE INDEX "drug_library_qr_code_idx" ON "drug_library"("qr_code");

-- CreateIndex
CREATE INDEX "inventory_items_tenant_id_idx" ON "inventory_items"("tenant_id");

-- CreateIndex
CREATE INDEX "inventory_items_branch_id_idx" ON "inventory_items"("branch_id");

-- CreateIndex
CREATE INDEX "inventory_items_tenant_id_branch_id_idx" ON "inventory_items"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "inventory_items_drug_library_id_idx" ON "inventory_items"("drug_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_tenant_id_branch_id_drug_library_id_batch_c_key" ON "inventory_items"("tenant_id", "branch_id", "drug_library_id", "batch_code");

-- CreateIndex
CREATE INDEX "audit_log_tenant_id_idx" ON "audit_log"("tenant_id");

-- CreateIndex
CREATE INDEX "audit_log_branch_id_idx" ON "audit_log"("branch_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_createdAt_idx" ON "audit_log"("createdAt");

-- CreateIndex
CREATE INDEX "drug_scan_events_tenant_id_idx" ON "drug_scan_events"("tenant_id");

-- CreateIndex
CREATE INDEX "drug_scan_events_branch_id_idx" ON "drug_scan_events"("branch_id");

-- CreateIndex
CREATE INDEX "drug_scan_events_qr_code_idx" ON "drug_scan_events"("qr_code");

-- CreateIndex
CREATE INDEX "drug_scan_events_drug_library_id_idx" ON "drug_scan_events"("drug_library_id");

-- CreateIndex
CREATE INDEX "drug_scan_events_scanned_at_idx" ON "drug_scan_events"("scanned_at");

-- CreateIndex
CREATE INDEX "drug_scan_memory_tenant_id_idx" ON "drug_scan_memory"("tenant_id");

-- CreateIndex
CREATE INDEX "drug_scan_memory_branch_id_idx" ON "drug_scan_memory"("branch_id");

-- CreateIndex
CREATE INDEX "drug_scan_memory_tenant_id_branch_id_idx" ON "drug_scan_memory"("tenant_id", "branch_id");

-- CreateIndex
CREATE INDEX "drug_scan_memory_qr_code_idx" ON "drug_scan_memory"("qr_code");

-- CreateIndex
CREATE INDEX "drug_scan_memory_drug_library_id_idx" ON "drug_scan_memory"("drug_library_id");

-- CreateIndex
CREATE UNIQUE INDEX "drug_scan_memory_tenant_id_branch_id_qr_code_key" ON "drug_scan_memory"("tenant_id", "branch_id", "qr_code");

-- AddForeignKey
ALTER TABLE "DrugFormulationMolecule" ADD CONSTRAINT "DrugFormulationMolecule_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "DrugFormulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugFormulationMolecule" ADD CONSTRAINT "DrugFormulationMolecule_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "DrugMolecule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugBrand" ADD CONSTRAINT "DrugBrand_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "DrugFormulation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugBrand" ADD CONSTRAINT "DrugBrand_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugPack" ADD CONSTRAINT "DrugPack_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "DrugBrand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugAlias" ADD CONSTRAINT "DrugAlias_packId_fkey" FOREIGN KEY ("packId") REFERENCES "DrugPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugAlias" ADD CONSTRAINT "DrugAlias_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "DrugBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugAlias" ADD CONSTRAINT "DrugAlias_formulationId_fkey" FOREIGN KEY ("formulationId") REFERENCES "DrugFormulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrugAlias" ADD CONSTRAINT "DrugAlias_moleculeId_fkey" FOREIGN KEY ("moleculeId") REFERENCES "DrugMolecule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProductMap" ADD CONSTRAINT "TenantProductMap_mappedPackId_fkey" FOREIGN KEY ("mappedPackId") REFERENCES "DrugPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProductMap" ADD CONSTRAINT "TenantProductMap_mappedBrandId_fkey" FOREIGN KEY ("mappedBrandId") REFERENCES "DrugBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantProductMap" ADD CONSTRAINT "TenantProductMap_mappedFormulationId_fkey" FOREIGN KEY ("mappedFormulationId") REFERENCES "DrugFormulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAlias" ADD CONSTRAINT "TenantAlias_mappedPackId_fkey" FOREIGN KEY ("mappedPackId") REFERENCES "DrugPack"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAlias" ADD CONSTRAINT "TenantAlias_mappedBrandId_fkey" FOREIGN KEY ("mappedBrandId") REFERENCES "DrugBrand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAlias" ADD CONSTRAINT "TenantAlias_mappedFormulationId_fkey" FOREIGN KEY ("mappedFormulationId") REFERENCES "DrugFormulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAlias" ADD CONSTRAINT "TenantAlias_mappedMoleculeId_fkey" FOREIGN KEY ("mappedMoleculeId") REFERENCES "DrugMolecule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DemandForecast" ADD CONSTRAINT "DemandForecast_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_drug_library_id_fkey" FOREIGN KEY ("drug_library_id") REFERENCES "drug_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_scan_events" ADD CONSTRAINT "drug_scan_events_drug_library_id_fkey" FOREIGN KEY ("drug_library_id") REFERENCES "drug_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "drug_scan_memory" ADD CONSTRAINT "drug_scan_memory_drug_library_id_fkey" FOREIGN KEY ("drug_library_id") REFERENCES "drug_library"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
