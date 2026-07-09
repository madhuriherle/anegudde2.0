import * as React from "react";

const resolveUnitText = (unit) => {
  if (!unit) return '';
  if (typeof unit === 'string') return unit;
  const code = String(unit?.unit_code || '').trim();
  if (code) return code;
  return String(unit?.unit_name || '').trim();
};

const QtyDisplay = ({ qty, unit, digits }) => {
  const val = Number(qty || 0);
  const unitText = resolveUnitText(unit);
  const formatted = digits != null ? val.toFixed(digits) : val.toFixed(3);
  return (
    <span>
      {formatted}
      {unitText && <span className="text-[0.85em] text-gray-400 ml-0.5">{unitText}</span>}
    </span>
  );
};

export { QtyDisplay };
