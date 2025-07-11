import { Module } from '@nestjs/common';
import { AppointmentsModule } from './appointments/appointments.module';
import { ClinicsController } from './appointments/clinics.controller';
import { PhysiciansController } from './appointments/physicians.controller';
import { PatientsController } from './appointments/patients.controller';

@Module({
  imports: [AppointmentsModule],
  controllers: [ClinicsController, PhysiciansController, PatientsController],
  providers: [],
})
export class AppModule {}
