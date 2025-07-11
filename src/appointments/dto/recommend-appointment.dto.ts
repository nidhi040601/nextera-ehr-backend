import { IsUUID, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RecommendationStatus } from '../enums/RecommendationStatus.enum';

export class RecommendAppointmentDto {
  @ApiProperty({
    example: 'a3f1c2e4-5b6d-7e8f-9a0b-1c2d3e4f5a6b',
    description: 'Clinic ID (UUID)',
  })
  @IsUUID('4', { message: 'clinicId must be a valid UUID.' })
  clinicId: string;

  @ApiProperty({
    example: 'b2e4d6f8-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    description: 'Physician ID (UUID)',
  })
  @IsUUID('4', { message: 'physicianId must be a valid UUID.' })
  physicianId: string;

  @ApiProperty({
    example: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
    description: 'Patient ID (UUID)',
  })
  @IsUUID('4', { message: 'patientId must be a valid UUID.' })
  patientId: string;

  @ApiProperty({
    example: '2025-07-01',
    description: 'Preferred appointment date (YYYY-MM-DD)',
  })
  @IsDateString(
    {},
    {
      message:
        'preferredDate is required and must be a valid ISO date string (YYYY-MM-DD).',
    },
  )
  preferredDate: string;

  @ApiProperty({ example: 15, description: 'Appointment duration in minutes' })
  @IsInt({ message: 'durationMinutes is required and must be an integer.' })
  @Min(5, { message: 'durationMinutes must be at least 5.' })
  @Max(480, { message: 'durationMinutes must be at most 480.' })
  durationMinutes: number;
}

export class RecommendedSlotResponse {
  @ApiProperty({
    enum: RecommendationStatus,
    description: 'Status of the recommendation',
    example: RecommendationStatus.SUCCESS,
  })
  status: RecommendationStatus;

  @ApiProperty({
    example: ['2025-07-01T09:00:00Z', '2025-07-01T09:15:00Z'],
    description: 'List of recommended slot start times (ISO strings, UTC)',
  })
  recommendedSlots: string[];

  @ApiProperty({ example: 'No slots available', required: false })
  message?: string;
}
