import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('physicians')
@Controller('api/physicians')
export class PhysiciansController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all physicians',
    description:
      'Retrieve a list of all available physicians in the system. Used for fetching physician IDs for appointment scheduling.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of physicians retrieved successfully',
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
          firstName: { type: 'string', example: 'John' },
          lastName: { type: 'string', example: 'Doe' },
          specialty: { type: 'string', example: 'Family Medicine' },
          email: { type: 'string', example: 'johndoe@example.com' },
          phone: { type: 'string', example: '4165551234' },
          clinicId: {
            type: 'string',
            format: 'uuid',
            example: '123e4567-e89b-12d3-a456-426614174000',
          },
        },
      },
    },
  })
  async getAllPhysicians() {
    return this.database.physician.findMany();
  }
}
