import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateBlockedNumberDto } from './dto/create-blocked-number.dto';

@Injectable()
export class BlockedNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.blockedNumber.findMany({ include: { lottery: true }, orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateBlockedNumberDto, createdById: string) {
    const existing = await this.prisma.blockedNumber.findUnique({
      where: { lotteryId_number: { lotteryId: dto.lotteryId, number: dto.number } },
    });
    if (existing) throw new ConflictException('Ese número ya está bloqueado para esta lotería');

    return this.prisma.blockedNumber.create({ data: { ...dto, createdById } });
  }

  async remove(id: string) {
    const existing = await this.prisma.blockedNumber.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Número bloqueado no encontrado');
    return this.prisma.blockedNumber.delete({ where: { id } });
  }
}
