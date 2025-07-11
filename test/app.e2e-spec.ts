import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaClient } from '@prisma/client';

describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let clinicId: string;
  let physicianId: string;
  let patientId: string;

  beforeAll(async () => {
    // Use the same DATABASE_URL as the service
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });

    // Clear existing data
    await prisma.appointment.deleteMany();
    await prisma.availabilityBlock.deleteMany();
    await prisma.billingRule.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.physician.deleteMany();
    await prisma.clinic.deleteMany();

    // Create test data directly
    const clinic = await prisma.clinic.create({
      data: {
        name: 'Downtown Health Clinic',
        street: '123 King St',
        city: 'Toronto',
        province: 'ON',
        postalCode: 'M5H 2N2',
        country: 'Canada',
        timezone: 'America/Toronto',
      },
    });

    const billingRule = await prisma.billingRule.create({
      data: {
        code: 'A001',
        description: 'General Visit - 15 min',
        minDurationMinutes: 15,
        minGapAfter: 10,
        maxApptsPerDay: 10,
      },
    });

    const physician = await prisma.physician.create({
      data: {
        firstName: 'John',
        lastName: 'Doe',
        specialty: 'Family Medicine',
        email: 'johndoe@example.com',
        phone: '4165551234',
        clinicId: clinic.id,
      },
    });

    const patient = await prisma.patient.create({
      data: {
        firstName: 'Alice',
        lastName: 'Smith',
        dob: new Date('1995-03-10'),
        healthCardNumber: 'OHIP123456',
        email: 'alice@example.com',
        phone: '4165556789',
      },
    });

    // Create availability blocks
    await prisma.availabilityBlock.createMany({
      data: [
        {
          physicianId: physician.id,
          clinicId: clinic.id,
          isRecurring: true,
          dayOfWeek: 2, // Tuesday
          startTime: new Date('2025-07-01T09:00:00'),
          endTime: new Date('2025-07-01T12:00:00'),
          isAvailable: true,
        },
        {
          physicianId: physician.id,
          clinicId: clinic.id,
          isRecurring: true,
          dayOfWeek: 2,
          startTime: new Date('2025-07-01T13:00:00'),
          endTime: new Date('2025-07-01T17:00:00'),
          isAvailable: true,
        },
      ],
    });

    clinicId = clinic.id;
    physicianId = physician.id;
    patientId = patient.id;

    console.log('Test data IDs:', { clinicId, physicianId, patientId });
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /api/appointments/recommend - success', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments/recommend')
      .send({
        clinicId,
        physicianId,
        patientId,
        preferredDate: '2025-07-01',
        durationMinutes: 15,
      })
      .expect(200);
    expect(res.body.status).toBe('success');
    expect(Array.isArray(res.body.recommendedSlots)).toBe(true);
    expect(res.body.recommendedSlots.length).toBeGreaterThan(0);
  });

  it('POST /api/appointments/recommend - validation error (bad UUID)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments/recommend')
      .send({
        clinicId: 'not-a-uuid',
        physicianId,
        patientId,
        preferredDate: '2025-07-01',
        durationMinutes: 15,
      })
      .expect(400);
    expect(res.body.message).toContain(
      'Invalid clinic, physician, or patient ID',
    );
  });

  it('POST /api/appointments/recommend - business error (nonexistent clinic)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments/recommend')
      .send({
        clinicId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        physicianId,
        patientId,
        preferredDate: '2025-07-01',
        durationMinutes: 15,
      })
      .expect(400);
    expect(res.body.status).toBe('error');
    expect(res.body.message).toMatch(
      /Invalid clinic, physician, or patient ID/,
    );
  });

  it('POST /api/appointments/recommend - no slots available', async () => {
    // Use a date with no availability in seed
    const res = await request(app.getHttpServer())
      .post('/api/appointments/recommend')
      .send({
        clinicId,
        physicianId,
        patientId,
        preferredDate: '2025-07-02',
        durationMinutes: 15,
      })
      .expect(200);
    expect(res.body.status).toMatch(/no_availability|no_slots_available/);
    expect(res.body.recommendedSlots).toHaveLength(0);
  });

  it('POST /api/appointments/recommend - returns at most 10 slots', async () => {
    // Add more availability to ensure >10 slots possible
    await prisma.availabilityBlock.createMany({
      data: [
        {
          physicianId,
          clinicId,
          isRecurring: false,
          specificDate: new Date('2025-07-01'),
          startTime: new Date('2025-07-01T18:00:00'),
          endTime: new Date('2025-07-01T23:00:00'),
          isAvailable: true,
        },
      ],
    });
    const res = await request(app.getHttpServer())
      .post('/api/appointments/recommend')
      .send({
        clinicId,
        physicianId,
        patientId,
        preferredDate: '2025-07-01',
        durationMinutes: 15,
      })
      .expect(200);
    expect(res.body.status).toBe('success');
    expect(res.body.recommendedSlots.length).toBeLessThanOrEqual(10);
  });

  it('POST /api/appointments/recommend - all slots are valid ISO date strings', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/appointments/recommend')
      .send({
        clinicId,
        physicianId,
        patientId,
        preferredDate: '2025-07-01',
        durationMinutes: 15,
      })
      .expect(200);
    expect(res.body.status).toBe('success');
    res.body.recommendedSlots.forEach((slot: string) => {
      expect(typeof slot).toBe('string');
      expect(() => new Date(slot)).not.toThrow();
      expect(slot).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/);
    });
  });
});
