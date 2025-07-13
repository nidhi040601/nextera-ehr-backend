import { Injectable } from '@nestjs/common';
import {
  RecommendAppointmentDto,
  RecommendedSlotResponse,
} from './dto/recommend-appointment.dto';
import { DatabaseService } from '../database/database.service';
import { DateTime, Interval } from 'luxon';
import { Logger } from '@nestjs/common';
import { RecommendationStatus } from './enums/RecommendationStatus.enum';

interface Slot {
  start: DateTime;
  end: DateTime;
  score: number;
}

@Injectable()
export class AppointmentsService {
  private readonly logger = new Logger(AppointmentsService.name);

  constructor(private readonly database: DatabaseService) {}

  async getRecommendedSlots(
    dto: RecommendAppointmentDto,
  ): Promise<RecommendedSlotResponse> {
    this.logger.log('Generating slots...');
    const { clinicId, physicianId, patientId, preferredDate, durationMinutes } =
      dto;

    // Validate clinicId, physician, and patient exist
    this.logger.log(
      `Validating existence of clinicId=${clinicId}, physicianId=${physicianId}, patientId=${patientId}`,
    );
    const [clinic, physician, patient] = await Promise.all([
      this.database.clinic.findUnique({ where: { id: clinicId } }),
      this.database.physician.findUnique({ where: { id: physicianId } }),
      this.database.patient.findUnique({ where: { id: patientId } }),
    ]);
    if (!clinic || !physician || !patient) {
      this.logger.error(`Invalid clinic, physician, or patient ID.`);
      throw new Error('Invalid clinic, physician, or patient ID.');
    }

    // Parse "preferredDate" and get day of week in clinic's timezone
    this.logger.log(
      `Parsing preferredDate=${preferredDate} in timezone=${clinic.timezone}`,
    );
    const localDayStart = DateTime.fromISO(preferredDate, {
      zone: clinic.timezone,
    }).startOf('day');
    const localDayEnd = localDayStart.endOf('day');
    const dayStartUTC = localDayStart.toUTC().toJSDate();
    const dayEndUTC = localDayEnd.toUTC().toJSDate();
    const dayOfWeek = localDayStart.weekday % 7;

    // Fetch availability blocks, existing appointments, and billing rules
    this.logger.log(
      'Fetching availability blocks, existing appointments, and billing rules...',
    );
    const [availabilityBlocks, existingAppointments, billingRules] =
      await Promise.all([
        this.getPhysicianAvailability(
          physicianId,
          clinicId,
          dayStartUTC,
          dayEndUTC,
          dayOfWeek,
        ),
        this.getExistingAppointments(
          physicianId,
          clinicId,
          dayStartUTC,
          dayEndUTC,
        ),
        this.getBillingRules(),
      ]);
    this.logger.log(
      `Fetched: availabilityBlocks=${availabilityBlocks.length}, existingAppointments=${existingAppointments.length}, billingRules=${billingRules.length}`,
    );

    if (!availabilityBlocks.length) {
      this.logger.warn(
        `No availability blocks found for clinicId=${clinicId}, physicianId=${physicianId} and preferredDate=${preferredDate}`,
      );
      return {
        status: RecommendationStatus.NO_AVAILABILITY,
        message:
          'No appointment slots are available for the selected criteria. (No availability configured for this clinic/physician on this date.)',
        recommendedSlots: [],
      };
    }
    if (!billingRules.length) {
      this.logger.error(
        `No billing rules found for clinicId=${clinicId}, physicianId=${physicianId}`,
      );
      return {
        status: RecommendationStatus.NO_SLOTS_AVAILABLE,
        message:
          'No appointment slots are available for the selected criteria. (No billing rules configured for this clinic/physician.)',
        recommendedSlots: [],
      };
    }

    // Convert availability blocks to time windows (in clinic's timezone)
    const windows: Interval[] = availabilityBlocks
      .map((block) => {
        // For recurring availability, use the requested date and the placeholder times
        if (block.isRecurring) {
          const requestedDate = DateTime.fromISO(preferredDate, {
            zone: clinic.timezone,
          });

          // Skip this recurring block if day doesn't match
          if (dayOfWeek !== block.dayOfWeek) {
            return null;
          }

          const placeholderStart = DateTime.fromJSDate(block.startTime, {
            zone: clinic.timezone,
          });
          const placeholderEnd = DateTime.fromJSDate(block.endTime, {
            zone: clinic.timezone,
          });

          const start = requestedDate.set({
            hour: placeholderStart.hour,
            minute: placeholderStart.minute,
            second: 0,
            millisecond: 0,
          });
          const end = requestedDate.set({
            hour: placeholderEnd.hour,
            minute: placeholderEnd.minute,
            second: 0,
            millisecond: 0,
          });

          return Interval.fromDateTimes(start, end);
        } else {
          // For non-recurring availability, use the specific date and times
          const start = DateTime.fromJSDate(block.startTime, {
            zone: clinic.timezone,
          });
          const end = DateTime.fromJSDate(block.endTime, {
            zone: clinic.timezone,
          });
          return Interval.fromDateTimes(start, end);
        }
      })
      .filter((window) => window !== null);
    this.logger.log(`Generated ${windows.length} availability windows.`);

    // Slice each window into slots of durationMinutes
    let slots: Slot[] = [];
    for (const window of windows) {
      let slotStart = window.start;
      while (slotStart.plus({ minutes: durationMinutes }) <= window.end) {
        const slotEnd = slotStart.plus({ minutes: durationMinutes });
        slots.push({ start: slotStart, end: slotEnd, score: 100 });
        slotStart = slotStart.plus({ minutes: 15 });
      }
    }
    this.logger.log(`Generated ${slots.length} raw slots.`);

    // Filter out slots that overlap with existing appointments
    const appointmentIntervals = existingAppointments.map((appt) =>
      Interval.fromDateTimes(
        DateTime.fromJSDate(appt.startTime, { zone: clinic.timezone }),
        DateTime.fromJSDate(appt.endTime, { zone: clinic.timezone }),
      ),
    );
    slots = slots.filter(
      (slot) =>
        !appointmentIntervals.some(
          (appt) => slot.start < appt.end && slot.end > appt.start,
        ),
    );
    this.logger.log(
      `Filtered to ${slots.length} slots after removing conflicts with existing appointments.`,
    );

    // Ontario billing gap rules
    const relevantBookingRule = billingRules
      .filter((rule) => rule.minDurationMinutes <= durationMinutes)
      .sort((a, b) => b.minDurationMinutes - a.minDurationMinutes)[0];

    const minGap = relevantBookingRule ? relevantBookingRule.minGapAfter : 0;
    this.logger.log(`Using minGap=${minGap} from billing rule.`);

    slots = slots.map((slot) => {
      // Find previous and next appointments to calculate gap and score
      const prevAppointment = appointmentIntervals
        .filter((appt) => appt.end <= slot.start)
        .sort((a, b) => b.end.toMillis() - a.end.toMillis())[0];
      const nextAppointment = appointmentIntervals
        .filter((appt) => appt.start >= slot.end)
        .sort((a, b) => a.start.toMillis() - b.start.toMillis())[0];

      let score = 100;

      if (prevAppointment) {
        const gapBefore = slot.start.diff(
          prevAppointment.end,
          'minutes',
        ).minutes;
        if (gapBefore < minGap) score -= (minGap - gapBefore) * 10;
      }
      if (nextAppointment) {
        const gapAfter = nextAppointment.start.diff(
          slot.end,
          'minutes',
        ).minutes;
        if (gapAfter < minGap) score -= (minGap - gapAfter) * 10;
      }

      // Add bonus points for required gaps
      if (
        (!prevAppointment ||
          slot.start.diff(prevAppointment.end, 'minutes').minutes >= minGap) &&
        (!nextAppointment ||
          nextAppointment.start.diff(slot.end, 'minutes').minutes >= minGap)
      ) {
        score += 20;
      }

      // Add bonus points for morning slots
      if (slot.start.hour >= 9 && slot.start.hour < 12) score += 15;

      // Deduct points for nearby appointments
      const nearby = appointmentIntervals.filter(
        (appt) =>
          Math.abs(appt.start.diff(slot.start, 'minutes').minutes) <= 60 ||
          Math.abs(appt.end.diff(slot.start, 'minutes').minutes) <= 60,
      ).length;
      if (nearby === 0) {
        score += 25;
      } else if (nearby > 2) {
        score -= 15;
      }
      return { ...slot, score: Math.max(0, score) };
    });
    this.logger.log(`Scored all slots.`);

    // Sort by score (desc) and time (asc) and return top 10 slots in UTC
    const recommendedSlots = slots
      .filter((slot) => slot.score > 0)
      .sort(
        (a, b) => b.score - a.score || a.start.toMillis() - b.start.toMillis(),
      )
      .slice(0, 10)
      .map((slot) => slot.start.toUTC().toISO({ suppressMilliseconds: true }));
    this.logger.log(`Returning ${recommendedSlots.length} recommended slots.`);

    if (!recommendedSlots.length) {
      this.logger.warn(
        `No slots available after filtering and scoring for clinicId=${clinicId}, physicianId=${physicianId} and preferredDate=${preferredDate}`,
      );
      return {
        status: RecommendationStatus.NO_SLOTS_AVAILABLE,
        message:
          'No appointment slots are available for the selected criteria. Please try a different date or contact support.',
        recommendedSlots: [],
      };
    }

    return {
      status: RecommendationStatus.SUCCESS,
      recommendedSlots,
    };
  }

  private async getPhysicianAvailability(
    physicianId: string,
    clinicId: string,
    dayStartUTC: Date,
    dayEndUTC: Date,
    dayOfWeek: number,
  ) {
    return await this.database.availabilityBlock.findMany({
      where: {
        physicianId,
        clinicId,
        isAvailable: true,
        OR: [
          {
            isRecurring: true,
            dayOfWeek,
          },
          {
            isRecurring: false,
            specificDate: {
              gte: dayStartUTC,
              lt: dayEndUTC,
            },
          },
        ],
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  private async getExistingAppointments(
    physicianId: string,
    clinicId: string,
    dayStartUTC: Date,
    dayEndUTC: Date,
  ) {
    return await this.database.appointment.findMany({
      where: {
        physicianId,
        clinicId,
        startTime: {
          gte: dayStartUTC,
          lte: dayEndUTC,
        },
        status: {
          not: 'cancelled',
        },
      },
      orderBy: {
        startTime: 'asc',
      },
    });
  }

  private async getBillingRules() {
    return await this.database.billingRule.findMany({
      orderBy: {
        minDurationMinutes: 'asc',
      },
    });
  }
}
