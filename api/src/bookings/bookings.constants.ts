export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MAX_NAME = 200;
export const MAX_EMAIL = 254;
export const MAX_IDEMPOTENCY_KEY = 255;
export const DEFAULT_PAGE_SIZE = 10;
export const MAX_PAGE_SIZE = 50;
export const REQUIRED_FIELDS = ['slot_id', 'name', 'email'] as const;
