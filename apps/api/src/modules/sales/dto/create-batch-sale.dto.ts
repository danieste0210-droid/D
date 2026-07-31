import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, IsOptional, IsPositive, IsString, IsUUID, Matches, ValidateNested } from 'class-validator';

// Una fila del carrito de "Números y Valores": un mismo número puede jugarse recto, combinado
// y/o palet a la vez -- cada monto presente genera su propia venta independiente.
export class BatchSaleItemDto {
  @Matches(/^\d{2,4}$/, { message: 'numberPlayed debe ser numérico, de 2 a 4 cifras' })
  numberPlayed: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  rectoAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  combinadoAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  paletAmount?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  chance3Amount?: number;
}

// Venta en lote: los mismos números del carrito se juegan en TODAS las loterías seleccionadas
// (una venta por lotería x tipo-con-monto). Todo o nada -- si un solo ítem falla su validación
// (cierre, número bloqueado, monto máximo), no se crea ninguna venta del lote.
export class CreateBatchSaleDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  lotteryIds: string[];

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BatchSaleItemDto)
  items: BatchSaleItemDto[];
}
