
export const resolveShortUnitName = (unitName, unitCode) => {
  const cleanCode = String(unitCode || '').trim();
  if (cleanCode) return cleanCode;

  const cleanName = String(unitName || '').trim();
  // If name is long, we might still want the code if possible, 
  // but usually unitCode is what we want for "short"
  return cleanName;
};

export const formatQuantityWithUnit = (
quantity,
unit,
digits = 3) =>
{
  const qty = Number(quantity || 0);
  const unitText = resolveShortUnitName(unit?.unit_name, unit?.unit_code);
  return unitText ? `${qty.toFixed(digits)} ${unitText}` : qty.toFixed(digits);
};