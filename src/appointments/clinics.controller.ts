import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('clinics')
@Controller('api/clinics')
export class ClinicsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all clinics',
    description:
      'Retrieve a list of all available clinics in the system. Used for fetching clinic IDs for appointment scheduling.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of clinics retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
          name: { type: 'string', example: 'Downtown Health Clinic' },
          street: { type: 'string', example: '123 King St' },
          city: { type: 'string', example: 'Toronto' },
          province: { type: 'string', example: 'ON' },
          postalCode: { type: 'string', example: 'M5H 2N2' },
          country: { type: 'string', example: 'Canada' },
          timezone: { type: 'string', example: 'America/Toronto' },
        },
      },
    },
  })
  async getAllClinics() {
    return this.database.clinic.findMany();
  }
}
