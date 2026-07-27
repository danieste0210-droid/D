import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

// TODO(users): paginación, filtros por rol/supervisor, 2FA enrollment.
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateUserDto) {
    const exists = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (exists) throw new ConflictException('El usuario ya existe');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: {
        name: dto.name,
        username: dto.username,
        passwordHash,
        role: dto.role,
        supervisorId: dto.supervisorId,
      },
    });
  }

  findAllActive() {
    return this.prisma.user.findMany({ where: { deletedAt: null } });
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.getOrThrow(id);
    return this.prisma.user.update({ where: { id }, data: dto });
  }

  // Soft-delete: nunca se borra físicamente para preservar auditoría.
  async deactivate(id: string) {
    await this.getOrThrow(id);
    return this.prisma.user.update({
      where: { id },
      data: { active: false, deletedAt: new Date() },
    });
  }

  private async getOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}
