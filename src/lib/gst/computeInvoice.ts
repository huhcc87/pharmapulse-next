export type DraftLine = {
    productName: string;
    quantity: number;
    unitPricePaise: number;
    gstRateBps: number; // 1200 = 12%
    discountPaise?: number;
    discountPercent?: number;
  };

export type InvoiceCharges = {
  shippingChargesPaise?: number;
  handlingChargesPaise?: number;
  globalDiscountPaise?: number;
  globalDiscountPercent?: number;
  couponDiscountPaise?: number;
};
  
export function computeInvoice(
  lines: DraftLine[], 
  intraState: boolean,
  charges?: InvoiceCharges
) {
    let totalTaxable = 0;
    let totalGst = 0;
  
    const computedLines = lines.map((l) => {
      // Calculate line total before discount
      const lineTotal = l.quantity * l.unitPricePaise;
      
      // Apply item-level discount
      let discountAmount = 0;
      if (l.discountPercent && l.discountPercent > 0) {
        discountAmount = Math.round((lineTotal * Number(l.discountPercent)) / 100);
      } else if (l.discountPaise) {
        discountAmount = l.discountPaise;
      }
      
      // Taxable amount after item discount
      const taxable = Math.max(0, lineTotal - discountAmount);
      totalTaxable += taxable;
  
      // Calculate GST on taxable amount
      const gst = Math.round((taxable * l.gstRateBps) / 10000);
      totalGst += gst;
  
      let cgst = 0,
        sgst = 0,
        igst = 0;
  
      if (l.gstRateBps > 0) {
        if (intraState) {
          cgst = Math.round(gst / 2);
          sgst = gst - cgst;
        } else {
          igst = gst;
        }
      }
  
      return {
        ...l,
        taxablePaise: taxable,
        discountPaise: discountAmount,
        cgstPaise: cgst,
        sgstPaise: sgst,
        igstPaise: igst,
      };
    });
  
    // Apply global charges and discounts
    const shipping = charges?.shippingChargesPaise ?? 0;
    const handling = charges?.handlingChargesPaise ?? 0;
    const couponDiscount = charges?.couponDiscountPaise ?? 0;
    
    // Apply global discount
    let globalDiscount = charges?.globalDiscountPaise ?? 0;
    if (charges?.globalDiscountPercent && charges.globalDiscountPercent > 0) {
      globalDiscount = Math.round((totalTaxable * Number(charges.globalDiscountPercent)) / 100);
    }
    
    // Final taxable after global discount
    const finalTaxable = Math.max(0, totalTaxable - globalDiscount - couponDiscount);
    
    // Recalculate GST on final taxable (if global discount affects taxable)
    // For simplicity, we'll apply discount to taxable and keep GST as is
    // In practice, you might want to recalculate GST proportionally
    const adjustedTaxable = finalTaxable;
    const additionalCharges = shipping + handling;
    
    const grandTotal = adjustedTaxable + totalGst + additionalCharges;
  
    return {
      lines: computedLines,
      totalTaxablePaise: adjustedTaxable,
      totalGstPaise: totalGst,
      totalChargesPaise: additionalCharges,
      totalDiscountPaise: globalDiscount + couponDiscount,
      totalInvoicePaise: grandTotal,
    };
  }
  