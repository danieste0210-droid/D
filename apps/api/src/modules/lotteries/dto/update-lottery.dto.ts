import { PartialType } from '@nestjs/swagger';
import { CreateLotteryDto } from './create-lottery.dto';

export class UpdateLotteryDto extends PartialType(CreateLotteryDto) {}
