import { ApiProperty } from '@nestjs/swagger';

export class NewBookingDto {
  @ApiProperty({ example: 's1' }) slot_id: string;
  @ApiProperty({ example: 'Ada Obi' }) name: string;
  @ApiProperty({ example: 'ada@example.com' }) email: string;
}

export class BookingDto {
  @ApiProperty({ description: 'Unique booking id', example: 'b_3f1c2a9e-6f0b-4c1e-9d8a-2b7e5c4d1a00' }) id: string;
  @ApiProperty({ example: 's1' }) slot_id: string;
  @ApiProperty({ example: 'Ada Obi' }) name: string;
  @ApiProperty({ example: 'ada@example.com' }) email: string;
  @ApiProperty({ enum: ['confirmed', 'cancelled'], example: 'confirmed' }) status: 'confirmed' | 'cancelled';
  @ApiProperty({ format: 'date-time', example: '2026-12-01T12:00:00.000Z' }) created_at: string;
}

export class BookingPageDto {
  @ApiProperty({ type: [BookingDto] }) bookings: BookingDto[];
  @ApiProperty({ type: String, nullable: true, description: 'Pass back as `cursor` for the next page; null on the last page' })
  next_cursor: string | null;
}
