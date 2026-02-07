// E-invoice payload builder (India NIC e-invoice structure)
// Note: This builds the structure but does NOT integrate with NIC API

export interface EInvoicePayload {
  Version: string;
  TranDtls: {
    TaxSch: string;
    SupTyp: string;
    RegRev: string;
    EcmGstin: string | null;
    IgstOnIntra: string;
  };
  DocDtls: {
    Typ: string;
    No: string;
    Dt: string;
  };
  SellerDtls: {
    Gstin: string;
    LglNm: string;
    TrdNm?: string;
    Addr1?: string;
    Addr2?: string;
    Loc?: string;
    Pin?: number;
    Stcd?: string;
  };
  BuyerDtls: {
    Gstin?: string;
    LglNm: string;
    Pos?: string;
    Addr1?: string;
    Loc?: string;
    Pin?: string;
    Stcd?: string;
  };
  ItemList: Array<{
    SlNo: string;
    PrdDesc: string;
    IsServc: string;
    HsnCd: string;
    Barcde?: string;
    Qty: number;
    FreeQty?: number;
    Unit: string;
    UnitPrice: number;
    TotAmt: number;
    Discount?: number;
    PreTaxVal: number;
    AssAmt: number;
    GstRt: number;
    IgstAmt: number;
    CgstAmt: number;
    SgstAmt: number;
    CesRt?: number;
    CesAmt?: number;
    CesNonAdvlAmt?: number;
    StateCesRt?: number;
    StateCesAmt?: number;
    StateCesNonAdvlAmt?: number;
    OthChrg?: number;
    TotItemVal: number;
    OrdLineRef?: string;
    OrgCntry?: string;
    PrdSlNo?: string;
    BchDtls?: {
      Nm: string;
      ExpDt: string;
      WrDt: string;
    };
  }>;
  ValDtls: {
    AssVal: number;
    CgstVal: number;
    SgstVal: number;
    IgstVal: number;
    CesVal: number;
    StCesVal: number;
    Discount: number;
    OthChrg: number;
    RndOffAmt: number;
    TotInvVal: number;
    TotInvValFc?: number;
  };
  PayDtls: {
    Nm: string;
    AccDet: string;
    Mode: string;
    FinInsBr: string;
    PayTerm: string;
    PayInstr: string;
    CrTrn: string;
    DirDr: string;
    CrDay: number;
    PaidAmt: number;
    PaymtDue: number;
  };
  ExpDtls?: {
    ShipBNo: string;
    ShipBDt: string;
    Port: string;
    RefClm: string;
    ForCur: string;
   CntCode: string;
  };
  DispDtls?: {
    Nm: string;
    Addr1: string;
    Addr2: string;
    Loc: string;
    Pin: number;
    Stcd: string;
  };
  EwbDtls?: {
    TransId: string;
    TransName: string;
    TransMode: string;
    Distance: number;
    TransDocNo: string;
    TransDocDt: string;
    VehNo: string;
    VehType: string;
  };
}

/**
 * Build e-invoice payload from invoice (NIC-compatible structure)
 */
export function buildEInvoicePayload(invoice: any, sellerGstin: any, org: any): EInvoicePayload {
  // Default to INTRA_STATE if supplyType is null/undefined
  const supplyType = invoice.supplyType || "INTRA_STATE";
  const isIntraState = supplyType === "INTRA_STATE";
  const lineItems = invoice.lineItems || [];

  const payload: EInvoicePayload = {
    Version: "1.1",
    TranDtls: {
      TaxSch: "GST",
      SupTyp: isIntraState ? "B2B" : "B2B",
      RegRev: "Y",
      EcmGstin: null,
      IgstOnIntra: "N",
    },
    DocDtls: {
      Typ: invoice.invoiceType === "B2B" ? "INV" : "INV",
      No: invoice.invoiceNumber || `INV-${invoice.id}`,
      Dt: new Date(invoice.invoiceDate).toISOString().split("T")[0].split("-").reverse().join("/"), // DD/MM/YYYY
    },
    SellerDtls: {
      Gstin: sellerGstin.gstin,
      LglNm: org.legalName || sellerGstin.legalName || org.name,
      TrdNm: org.tradeName || org.name,
      Addr1: org.addressLine1 || "",
      Loc: org.city || "",
      Pin: org.pincode ? parseInt(org.pincode) : undefined,
      Stcd: org.stateCode || sellerGstin.stateCode,
    },
    BuyerDtls: {
      Gstin: invoice.customer?.gstin || undefined,
      LglNm: invoice.buyerName || "Walk-in Customer",
      Pos: invoice.placeOfSupplyStateCode || sellerGstin.stateCode,
      Addr1: invoice.buyerAddress || undefined,
      Loc: invoice.buyerCity || undefined,
      Pin: invoice.buyerPincode || undefined,
      Stcd: invoice.customer?.stateCode || undefined,
    },
    ItemList: lineItems.map((item: any, idx: number) => ({
      SlNo: String(idx + 1),
      PrdDesc: item.productName,
      IsServc: "N",
      HsnCd: item.hsnCode || "3004",
      Barcde: item.ean || undefined,
      Qty: item.quantity,
      Unit: "PCS", // Piece
      UnitPrice: item.unitPricePaise / 100,
      TotAmt: (item.unitPricePaise * item.quantity) / 100,
      Discount: item.discountPaise ? item.discountPaise / 100 : undefined,
      PreTaxVal: item.taxablePaise / 100,
      AssAmt: item.taxablePaise / 100,
      GstRt: item.gstRate ? Number(item.gstRate) : 0,
      IgstAmt: isIntraState ? 0 : item.igstPaise / 100,
      CgstAmt: isIntraState ? item.cgstPaise / 100 : 0,
      SgstAmt: isIntraState ? item.sgstPaise / 100 : 0,
      TotItemVal: item.lineTotalPaise / 100,
      BchDtls: item.batchNumber && item.expiryDate
        ? {
            Nm: item.batchNumber,
            ExpDt: new Date(item.expiryDate).toISOString().split("T")[0],
            WrDt: new Date(item.expiryDate).toISOString().split("T")[0],
          }
        : undefined,
    })),
    ValDtls: {
      AssVal: invoice.totalTaxablePaise / 100,
      CgstVal: isIntraState ? invoice.totalCGSTPaise / 100 : 0,
      SgstVal: isIntraState ? invoice.totalSGSTPaise / 100 : 0,
      IgstVal: !isIntraState ? invoice.totalIGSTPaise / 100 : 0,
      CesVal: 0,
      StCesVal: 0,
      Discount: (invoice.globalDiscountPaise || 0) / 100,
      OthChrg: 0,
      RndOffAmt: (invoice.roundOffPaise || 0) / 100,
      TotInvVal: invoice.totalInvoicePaise / 100,
    },
    PayDtls: {
      Nm: "Cash",
      AccDet: "",
      Mode: "Cash",
      FinInsBr: "",
      PayTerm: "Immediate",
      PayInstr: invoice.paymentMethod || "Cash",
      CrTrn: "",
      DirDr: "",
      CrDay: 0,
      PaidAmt: invoice.paidAmountPaise / 100,
      PaymtDue: (invoice.totalInvoicePaise - invoice.paidAmountPaise) / 100,
    },
  };

  return payload;
}
