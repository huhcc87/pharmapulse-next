// Round-off calculation for Indian POS
export function roundOffToRupee(amountPaise: number): { rounded: number; roundOff: number } {
  // Convert to rupees, round to nearest rupee, then convert back to paise
  const amountInRupees = amountPaise / 100;
  const roundedInRupees = Math.round(amountInRupees);
  const roundOffPaise = Math.round((roundedInRupees - amountInRupees) * 100);
  const roundedPaise = amountPaise + roundOffPaise;
  
  return {
    rounded: roundedPaise,
    roundOff: roundOffPaise,
  };
}
