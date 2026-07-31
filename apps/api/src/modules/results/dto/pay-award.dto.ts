import { IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class PayAwardDto {
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
