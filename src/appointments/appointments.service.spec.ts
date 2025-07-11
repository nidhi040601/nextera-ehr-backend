import { Test, TestingModule } from '@nestjs/testing';
import { AppointmentsService } from './appointments.service';
import { DatabaseService } from '../database/database.service';
import {
  RecommendAppointmentDto,
  RecommendedSlotResponse,
} from './dto/recommend-appointment.dto';
import { RecommendationStatus } from './enums/RecommendationStatus.enum';
import { DateTime } from 'luxon';

describe('AppointmentsService', () => {
  let service: AppointmentsService;
  let db: jest.Mocked<DatabaseService>;

  const mockClinic = {
    id: 'clinic-1',
    timezone: 'America/Toronto',
  };
  const mockPhysician = { id: 'physician-1' };
  const mockPatient = { id: 'patient-1' };
  const mockBillingRule = {
    code: 'A001',
    minDurationMinutes: 15,
    minGapAfter: 10,
    maxApptsPerDay: 10,
  };
  const baseDto: RecommendAppointmentDto = {
    clinicId: mockClinic.id,
    physicianId: mockPhysician.id,
    patientId: mockPatient.id,
    preferredDate: '2025-07-01',
    durationMinutes: 15,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        {
          provide: DatabaseService,
          useValue: {
            clinic: { findUnique: jest.fn() },
            physician: { findUnique: jest.fn() },
            patient: { findUnique: jest.fn() },
            availabilityBlock: { findMany: jest.fn() },
            appointment: { findMany: jest.fn() },
            billingRule: { findMany: jest.fn() },
          },
        },
      ],
    }).compile();
    service = module.get<AppointmentsService>(AppointmentsService);
    db = module.get(DatabaseService);
    // Cast all nested methods to jest.Mock for type safety
    db.clinic.findUnique = db.clinic.findUnique as jest.Mock;
    db.physician.findUnique = db.physician.findUnique as jest.Mock;
    db.patient.findUnique = db.patient.findUnique as jest.Mock;
    db.availabilityBlock.findMany = db.availabilityBlock.findMany as jest.Mock;
    db.appointment.findMany = db.appointment.findMany as jest.Mock;
    db.billingRule.findMany = db.billingRule.findMany as jest.Mock;
  });

  it('should return recommended slots on success', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T12:00:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([mockBillingRule]);

    const result = await service.getRecommendedSlots(baseDto);
    expect(result.status).toBe(RecommendationStatus.SUCCESS);
    expect(result.recommendedSlots.length).toBeGreaterThan(0);
  });

  it('should throw error if clinic/physician/patient not found', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(null);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);

    await expect(service.getRecommendedSlots(baseDto)).rejects.toThrow(
      'Invalid clinic, physician, or patient ID.',
    );
  });

  it('should return NO_AVAILABILITY if no availability blocks', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([mockBillingRule]);

    const result = await service.getRecommendedSlots(baseDto);
    expect(result.status).toBe(RecommendationStatus.NO_AVAILABILITY);
    expect(result.recommendedSlots).toHaveLength(0);
  });

  it('should return NO_SLOTS_AVAILABLE if no billing rules', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T12:00:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getRecommendedSlots(baseDto);
    expect(result.status).toBe(RecommendationStatus.NO_SLOTS_AVAILABLE);
    expect(result.recommendedSlots).toHaveLength(0);
  });

  it('should return NO_SLOTS_AVAILABLE if all slots are blocked by appointments', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T09:30:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T09:30:00-04:00'),
        status: 'confirmed',
      },
    ]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([mockBillingRule]);

    const result = await service.getRecommendedSlots(baseDto);
    expect(result.status).toBe(RecommendationStatus.NO_SLOTS_AVAILABLE);
    expect(result.recommendedSlots).toHaveLength(0);
  });

  it('should apply minGapAfter from billing rule', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T10:00:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T09:15:00-04:00'),
        status: 'confirmed',
      },
    ]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([mockBillingRule]);

    const result = await service.getRecommendedSlots(baseDto);

    expect(result.status).toBe(RecommendationStatus.SUCCESS);
    expect(result.recommendedSlots.length).toBeGreaterThan(0);

    const topSlot = DateTime.fromISO(result.recommendedSlots[0], {
      zone: mockClinic.timezone,
    });
    const appointmentEnd = DateTime.fromISO('2025-07-01T09:15:00', {
      zone: mockClinic.timezone,
    });

    const diffInMinutes = topSlot.diff(appointmentEnd, 'minutes').minutes;

    expect(diffInMinutes).toBeGreaterThanOrEqual(mockBillingRule.minGapAfter);
  });

  it('should score and sort slots correctly', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T11:00:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:30:00-04:00'),
        endTime: new Date('2025-07-01T09:45:00-04:00'),
        status: 'confirmed',
      },
    ]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([mockBillingRule]);

    const result = await service.getRecommendedSlots(baseDto);
    expect(result.status).toBe(RecommendationStatus.SUCCESS);
    const slots = result.recommendedSlots;
    expect(new Set(slots).size).toBe(slots.length); // all unique
    slots.forEach((s) => {
      expect(typeof s).toBe('string');
      expect(() => DateTime.fromISO(s)).not.toThrow();
    });
    // The first slot should not be after the last slot
    expect(DateTime.fromISO(slots[0]).toMillis()).toBeLessThanOrEqual(
      DateTime.fromISO(slots[slots.length - 1]).toMillis(),
    );
  });

  it('should select the correct billing rule based on durationMinutes', async () => {
    const billingRules = [
      { code: 'Short', minDurationMinutes: 10, minGapAfter: 5 },
      { code: 'ExactMatch', minDurationMinutes: 15, minGapAfter: 20 }, // Should be selected
      { code: 'Longer', minDurationMinutes: 30, minGapAfter: 30 },
    ];

    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T11:00:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue(billingRules);

    const result = await service.getRecommendedSlots(baseDto);

    expect(result.status).toBe(RecommendationStatus.SUCCESS);
    expect(result.recommendedSlots.length).toBeGreaterThan(0);
  });

  it('should return NO_SLOTS_AVAILABLE if all slots are scored <= 0', async () => {
    (db.clinic.findUnique as jest.Mock).mockResolvedValue(mockClinic);
    (db.physician.findUnique as jest.Mock).mockResolvedValue(mockPhysician);
    (db.patient.findUnique as jest.Mock).mockResolvedValue(mockPatient);
    (db.availabilityBlock.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T09:30:00-04:00'),
        isAvailable: true,
        isRecurring: true,
        dayOfWeek: 2,
      },
    ]);
    (db.appointment.findMany as jest.Mock).mockResolvedValue([
      {
        startTime: new Date('2025-07-01T09:00:00-04:00'),
        endTime: new Date('2025-07-01T09:29:00-04:00'),
        status: 'confirmed',
      },
    ]);
    (db.billingRule.findMany as jest.Mock).mockResolvedValue([
      { ...mockBillingRule, minGapAfter: 15 },
    ]);

    const result = await service.getRecommendedSlots(baseDto);
    expect(result.status).toBe(RecommendationStatus.NO_SLOTS_AVAILABLE);
    expect(result.recommendedSlots).toHaveLength(0);
  });
});
