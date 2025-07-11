import {
  Controller,
  Post,
  Body,
  HttpException,
  HttpStatus,
  Logger,
  HttpCode,
} from '@nestjs/common';
import {
  RecommendAppointmentDto,
  RecommendedSlotResponse,
} from './dto/recommend-appointment.dto';
import { AppointmentsService } from './appointments.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';

@ApiTags('appointments')
@Controller('api/appointments')
export class AppointmentsController {
  private readonly logger = new Logger(AppointmentsController.name);
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post('recommend')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Get top 10 recommended appointment slots for the patient',
  })
  @ApiBody({
    description: 'Input data to get recommended appointment slots',
    type: RecommendAppointmentDto,
  })
  @ApiResponse({
    status: 200,
    description: 'Recommended slots returned successfully.',
    type: RecommendedSlotResponse,
  })
  @ApiResponse({
    status: 400,
    description: 'Validation or business logic error.',
  })
  @ApiResponse({ status: 500, description: 'Internal server error.' })
  async recommendAppointments(
    @Body() dto: RecommendAppointmentDto,
  ): Promise<RecommendedSlotResponse> {
    this.logger.log('POST /api/appointments/recommend called', dto);
    try {
      const result = await this.appointmentsService.getRecommendedSlots(dto);
      return result;
    } catch (error) {
      this.logger.error('Error in recommendAppointments', error);
      if (
        error instanceof Error &&
        error.message === 'Invalid clinic, physician, or patient ID.'
      ) {
        throw new HttpException(
          {
            status: 'error',
            message: error.message,
            recommendedSlots: [],
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Internal server error',
          recommendedSlots: [],
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
