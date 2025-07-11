import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.availabilityBlock.deleteMany();
  await prisma.billingRule.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.physician.deleteMany();
  await prisma.clinic.deleteMany();

  // Clinics
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

  // Billing Rule
  const billingRule = await prisma.billingRule.create({
    data: {
      code: 'A001',
      description: 'General Visit - 15 min',
      minDurationMinutes: 15,
      minGapAfter: 10,
      maxApptsPerDay: 10,
    },
  });

  // Physicians
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

  // Patients
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

  const patient2 = await prisma.patient.create({
    data: {
      firstName: 'Bob',
      lastName: 'Brown',
      dob: new Date('1988-07-25'),
      healthCardNumber: 'OHIP654321',
      email: 'bob@example.com',
    },
  });

  // Availability Blocks (recurring + specific date)
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
      {
        physicianId: physician.id,
        clinicId: clinic.id,
        isRecurring: false,
        specificDate: new Date('2025-07-01'),
        startTime: new Date('2025-07-01T18:00:00'),
        endTime: new Date('2025-07-01T20:00:00'),
        isAvailable: true,
      },
    ],
  });

  // Existing Appointments
  await prisma.appointment.createMany({
    data: [
      {
        physicianId: physician.id,
        patientId: patient.id,
        clinicId: clinic.id,
        billingCode: billingRule.code,
        startTime: new Date('2025-07-01T09:30:00'),
        endTime: new Date('2025-07-01T09:45:00'),
        status: 'confirmed',
      },
      {
        physicianId: physician.id,
        patientId: patient2.id,
        clinicId: clinic.id,
        billingCode: billingRule.code,
        startTime: new Date('2025-07-01T13:15:00'),
        endTime: new Date('2025-07-01T13:30:00'),
        status: 'confirmed',
      },
    ],
  });
}

main()
  .then(() => {
    console.log('Seeding complete.');
    return prisma.$disconnect();
  })
  .catch((e) => {
    console.error(e);
    return prisma.$disconnect().then(() => process.exit(1));
  });
