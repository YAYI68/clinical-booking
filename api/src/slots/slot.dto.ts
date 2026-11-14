import { ApiProperty } from '@nestjs/swagger';

export class SlotDto {
  @ApiProperty({ example: 's1' }) id: string;
  @ApiProperty({ example: 'Dr Ade' }) provider: string;
  @ApiProperty({ format: 'date-time', example: '2026-12-10T09:00:00Z' }) start: string;
  @ApiProperty({ format: 'date-time', example: '2026-12-10T09:30:00Z' }) end: string;
}

export class SlotWithAvailabilityDto extends SlotDto {
  @ApiProperty({ description: 'false while the slot has a confirmed booking', example: true }) available: boolean;
}

export class SlotListDto {
  @ApiProperty({ type: [SlotWithAvailabilityDto] }) slots: SlotWithAvailabilityDto[];
}

export class ResetDto {
  @ApiProperty({ type: [SlotDto] }) slots: SlotDto[];
}
