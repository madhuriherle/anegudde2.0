const isValidDate = (value) => {
  if (value === null || value === undefined || value === '') return false;
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
};

/**
 * Safer wrapper for toLocaleTimeString with Kolkata timezone fallback
 */
export const safeFormatTime = (date, options = {}) => {
  if (!isValidDate(date)) return '-';
  const d = new Date(date);
  try {
    return d.toLocaleTimeString('en-IN', { ...options, timeZone: 'Asia/Kolkata' });
  } catch (err) {
    console.warn('Kolkata timezone not supported or insecure, falling back to local time');
    return d.toLocaleTimeString('en-IN', options);
  }
};

/**
 * Safer wrapper for toLocaleDateString with Kolkata timezone fallback
 */
export const safeFormatDate = (date, options = {}) => {
  if (!isValidDate(date)) return '-';
  const d = new Date(date);
  try {
    return d.toLocaleDateString('en-IN', { ...options, timeZone: 'Asia/Kolkata' });
  } catch (err) {
    console.warn('Kolkata timezone not supported or insecure, falling back to local date');
    return d.toLocaleDateString('en-IN', options);
  }
};

export const formatDate = (value) => {
  if (!isValidDate(value)) return '-';
  const d = new Date(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
};

export const getTodayDateInput = () => {
  const d = new Date();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(d);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  } catch (err) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
};

export const formatDateTime = (value) => {
  if (!isValidDate(value)) return '-';
  const d = new Date(value);
  const date = formatDate(d);
  const time = safeFormatTime(d, { hour: '2-digit', minute: '2-digit' });
  return `${date} ${time}`;
};

export const convertToAMPM = (time24h) => {
  if (!time24h) return '';
  const [hours, minutes] = time24h.split(':');
  let hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour || 12; // the hour '0' should be '12'
  return `${hour}:${minutes} ${ampm}`;
};

export const convertTo24H = (timeAMPM) => {
  if (!timeAMPM) return '';
  const match = timeAMPM.match(/^(\d+):(\d+)\s*(AM|PM)$/i);
  if (!match) return '';
  let [_, hours, minutes, ampm] = match;
  let hour = parseInt(hours, 10);
  ampm = ampm.toUpperCase();
  if (ampm === 'PM' && hour < 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${minutes}`;
};
