import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { closeTimeToMinutes, toLocalTimeParts } from '../../common/time/local-time';
import { CreateClosureDto } from './dto/create-closure.dto';
import { UpdateClosureDto } from './dto/update-closure.dto';

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

    const { dayOfWeek, minutesSinceMidnight } = toLocalTimeParts(at, this.timezone);
    const closure = await this.prisma.closure.findUnique({
      where: { lotteryId_dayOfWeek: { lotteryId, dayOfWeek } },
    });
    if (!closure) return false; // sin cierre configurado para ese día -> no se vende

    return minutesSinceMidnight < closeTimeToMinutes(closure.closeTime);
  }

  private async getOrThrow(id: string) {
    const closure = await this.prisma.closure.findUnique({ where: { id } });
    if (!closure) throw new NotFoundException('Cierre no encontrado');
    return closure;
  }
}
