
export const resolveShortUnitName = (unitName?: string | null, unitCode?: string | null): string => {
  const cleanCode = String(unitCode || '').trim();
  if (cleanCode) return cleanCode;
  
  const cleanName = String(unitName || '').trim();
  // If name is long, we might still want the code if possible, 
  // but usually unitCode is what we want for "short"
  return cleanName;
};

export const formatQuantityWithUnit = (
  quantity: unknown,
  unit?: { unit_name?: string | null; unit_code?: string | null } | null,
  digits = 3
): string => {
  const qty = Number(quantity || 0);
  const unitText = resolveShortUnitName(unit?.unit_name, unit?.unit_code);
  return unitText ? `${qty.toFixed(digits)} ${unitText}` : qty.toFixed(digits);
};
