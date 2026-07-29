import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { isWithinSchedule, toLocalTimeParts } from '../../common/time/local-time';
import { CreateClosureDto } from './dto/create-closure.dto';
import { UpdateClosureDto } from './dto/update-closure.dto';
import { UpsertClosureDefaultDto } from './dto/upsert-closure-default.dto';

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
  // Prioridad: Closure específico de la lotería para ese día; si no existe, se usa el horario
  // general (ClosureDefault) de ese día como respaldo.
  async isLotteryOpen(lotteryId: string, at: Date = new Date()): Promise<boolean> {
    const lottery = await this.prisma.lottery.findUnique({ where: { id: lotteryId } });
    if (!lottery || !lottery.active || lottery.blocked) return false;

    const { dayOfWeek, minutesSinceMidnight } = toLocalTimeParts(at, this.timezone);
    const closure = await this.prisma.closure.findUnique({
      where: { lotteryId_dayOfWeek: { lotteryId, dayOfWeek } },
    });
    const schedule = closure ?? (await this.prisma.closureDefault.findUnique({ where: { dayOfWeek } }));
    if (!schedule) return false; // ni override ni horario general para ese día -> no se vende

    return isWithinSchedule(minutesSinceMidnight, schedule.openTime, schedule.closeTime);
  }

  findAllDefaults() {
    return this.prisma.closureDefault.findMany({ orderBy: { dayOfWeek: 'asc' } });
  }

  upsertDefault(dto: UpsertClosureDefaultDto) {
    return this.prisma.closureDefault.upsert({
      where: { dayOfWeek: dto.dayOfWeek },
      update: { openTime: dto.openTime, closeTime: dto.closeTime },
      create: dto,
    });
  }

  private async getOrThrow(id: string) {
    const closure = await this.prisma.closure.findUnique({ where: { id } });
    if (!closure) throw new NotFoundException('Cierre no encontrado');
    return closure;
  }
}
