import { useEffect, useState } from 'react';
import { formatRelative } from '../utils/dateUtils';

export default function AutoRefreshingRelativeDate({ date }: { date: Date | number }) {
  const [, setTime] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setTime(Date.now()), 30000);
    return () => clearInterval(interval);
  }, []);
  return formatRelative(typeof date === 'number' ? new Date(date) : date);
}
