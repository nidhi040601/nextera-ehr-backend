import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import {
  RecommendAppointmentDto,
  RecommendedSlotResponse,
} from './dto/recommend-appointment.dto';
import { RecommendationStatus } from './enums/RecommendationStatus.enum';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('AppointmentsController', () => {
  let controller: AppointmentsController;
  let service: AppointmentsService;

  const mockService = {
    getRecommendedSlots: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppointmentsController],
      providers: [{ provide: AppointmentsService, useValue: mockService }],
    }).compile();

    controller = module.get<AppointmentsController>(AppointmentsController);
    service = module.get<AppointmentsService>(AppointmentsService);
    jest.clearAllMocks();
  });

  const dto: RecommendAppointmentDto = {
    clinicId: 'a3f1c2e4-5b6d-7e8f-9a0b-1c2d3e4f5a6b',
    physicianId: 'b2e4d6f8-1a2b-3c4d-5e6f-7a8b9c0d1e2f',
    patientId: 'c3d4e5f6-7a8b-9c0d-1e2f-3a4b5c6d7e8f',
    preferredDate: '2025-07-01',
    durationMinutes: 15,
  };

  it('should return recommended slots on success', async () => {
    const mockResponse: RecommendedSlotResponse = {
      status: RecommendationStatus.SUCCESS,
      recommendedSlots: ['2025-07-01T09:00:00Z', '2025-07-01T10:00:00Z'],
    };
    mockService.getRecommendedSlots.mockResolvedValueOnce(mockResponse);
    await expect(controller.recommendAppointments(dto)).resolves.toEqual(
      mockResponse,
    );
    expect(mockService.getRecommendedSlots).toHaveBeenCalledWith(dto);
  });

  it('should throw 400 if invalid clinic/physician/patient', async () => {
    const error = new Error('Invalid clinic, physician, or patient ID.');
    mockService.getRecommendedSlots.mockRejectedValueOnce(error);
    await expect(controller.recommendAppointments(dto)).rejects.toThrow(
      HttpException,
    );
    try {
      await controller.recommendAppointments(dto);
    } catch (e) {
      expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(e.getResponse()).toMatchObject({
        status: 'error',
        message: error.message,
        recommendedSlots: [],
      });
    }
  });

  it('should throw 500 for other errors', async () => {
    const error = new Error('Something went wrong');
    mockService.getRecommendedSlots.mockRejectedValueOnce(error);
    await expect(controller.recommendAppointments(dto)).rejects.toThrow(
      HttpException,
    );
    try {
      await controller.recommendAppointments(dto);
    } catch (e) {
      expect(e.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(e.getResponse()).toMatchObject({
        status: 'error',
        message: error.message,
        recommendedSlots: [],
      });
    }
  });

  it('should return empty recommendedSlots if service returns none', async () => {
    const mockResponse: RecommendedSlotResponse = {
      status: RecommendationStatus.SUCCESS,
      recommendedSlots: [],
    };

    mockService.getRecommendedSlots.mockResolvedValueOnce(mockResponse);

    const result = await controller.recommendAppointments(dto);

    expect(result.status).toBe(RecommendationStatus.SUCCESS);
    expect(result.recommendedSlots).toHaveLength(0);
  });
});
