import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@Controller('api/patients')
export class PatientsController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all patients',
    description:
      'Retrieve a list of all registered patients in the system. Used for fetching patient IDs for appointment scheduling.',
  })
  @ApiResponse({
    status: 200,
    description: 'List of patients retrieved successfully',
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
          firstName: { type: 'string', example: 'Alice' },
          lastName: { type: 'string', example: 'Smith' },
          dob: { type: 'string', format: 'date', example: '1995-03-10' },
          healthCardNumber: { type: 'string', example: 'OHIP123456' },
          email: { type: 'string', example: 'alice@example.com' },
          phone: { type: 'string', example: '4165556789' },
        },
      },
    },
  })
  async getAllPatients() {
    return this.database.patient.findMany();
  }
}
