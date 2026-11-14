import { ApiProperty } from '@nestjs/swagger';

export class ErrorDto {
  @ApiProperty({ example: 'slot not found' }) error: string;
}
