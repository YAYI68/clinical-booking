import { useEffect, useState } from 'react';
import { api, type Slot } from './api';

export function useSlotIndex() {
  const [index, setIndex] = useState<Record<string, Slot>>({});
  useEffect(() => {
    api
      .listSlots()
      .then((slots) => setIndex(Object.fromEntries(slots.map((s) => [s.id, s]))))
      .catch(() => {});
  }, []);
  return index;
}
