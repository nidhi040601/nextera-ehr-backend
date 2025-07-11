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

    // Use existing data only - no modifications
    const clinic = await prisma.clinic.findFirst();
    const physician = await prisma.physician.findFirst();
    const patient = await prisma.patient.findFirst();

    if (clinic && physician && patient) {
      clinicId = clinic.id;
      physicianId = physician.id;
      patientId = patient.id;
      console.log('Using existing data IDs:', {
        clinicId,
        physicianId,
        patientId,
      });
    } else {
      throw new Error(
        'Required test data not found. Please run: npx prisma db seed',
      );
    }
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
