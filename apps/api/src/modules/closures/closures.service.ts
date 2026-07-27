import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateClosureDto } from './dto/create-closure.dto';
import { UpdateClosureDto } from './dto/update-closure.dto';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

@Injectable()
export class ClosuresService {
  private readonly timezone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.timezone = config.get<string>('timezone') ?? 'America/Panama';
  }

  create(dto: CreateClosureDto, changedById: string) {
    return this.prisma.$transaction(async (tx) => {
      const closure = await tx.closure.create({ data: dto });
      await tx.lotteryScheduleChange.create({
        data: { lotteryId: dto.lotteryId, changedById, before: undefined, after: closure },
      });
      return closure;
    });
  }

  findAll() {
    return this.prisma.closure.findMany({ include: { lottery: true } });
  }

  async update(id: string, dto: UpdateClosureDto, changedById: string) {
    const before = await this.getOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      const after = await tx.closure.update({ where: { id }, data: dto });
      await tx.lotteryScheduleChange.create({
        data: { lotteryId: before.lotteryId, changedById, before, after },
      });
      return after;
    });
  }

  async remove(id: string, changedById: string) {
    const before = await this.getOrThrow(id);
    return this.prisma.$transaction(async (tx) => {
      const removed = await tx.closure.delete({ where: { id } });
      await tx.lotteryScheduleChange.create({
        data: { lotteryId: before.lotteryId, changedById, before, after: undefined },
      });
      return removed;
    });
  }

  // Determina si una lotería está abierta a la venta en un instante dado, siempre en
  // America/Panama (o el TIMEZONE configurado), sin depender de la hora local del dispositivo.
  async isLotteryOpen(lotteryId: string, at: Date = new Date()): Promise<boolean> {
    const lottery = await this.prisma.lottery.findUnique({ where: { id: lotteryId } });
    if (!lottery || !lottery.active || lottery.blocked) return false;

    const { dayOfWeek, minutesSinceMidnight } = this.toLocalParts(at);
    const closure = await this.prisma.closure.findUnique({
      where: { lotteryId_dayOfWeek: { lotteryId, dayOfWeek } },
    });
    if (!closure) return false; // sin cierre configurado para ese día -> no se vende

    const [closeHour, closeMinute] = closure.closeTime.split(':').map(Number);
    return minutesSinceMidnight < closeHour * 60 + closeMinute;
  }

  private toLocalParts(date: Date): { dayOfWeek: number; minutesSinceMidnight: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun';
    let hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
    if (hour === 24) hour = 0; // Intl puede devolver "24" para medianoche con hour12:false

    return { dayOfWeek: WEEKDAYS.indexOf(weekday), minutesSinceMidnight: hour * 60 + minute };
  }

  private async getOrThrow(id: string) {
    const closure = await this.prisma.closure.findUnique({ where: { id } });
    if (!closure) throw new NotFoundException('Cierre no encontrado');
    return closure;
  }
}
