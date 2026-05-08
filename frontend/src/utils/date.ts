const isValidDate = (value: unknown): value is string | number | Date => {
  if (value === null || value === undefined || value === '') return false;
  const d = new Date(value as any);
  return !Number.isNaN(d.getTime());
};

export const formatDate = (value: unknown): string => {
  if (!isValidDate(value)) return '-';
  const d = new Date(value as any);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const formatDateTime = (value: unknown): string => {
  if (!isValidDate(value)) return '-';
  const d = new Date(value as any);
  const date = formatDate(d);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};
