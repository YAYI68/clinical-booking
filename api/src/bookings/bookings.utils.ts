import { BookingRow } from '../database/database.service';
import { BookingDto } from './booking.dto';

export const toDto = ({ seq: _seq, ...booking }: BookingRow): BookingDto => booking;

export const encodeCursor = (seq: number) => Buffer.from(JSON.stringify({ after: seq })).toString('base64url');

export function decodeCursor(cursor: string): number | null {
  try {
    const { after } = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    return Number.isSafeInteger(after) && after >= 0 ? after : null;
  } catch {
    return null;
  }
}
