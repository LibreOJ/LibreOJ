import { ApiProperty } from "@nestjs/swagger";

import { IsString, Length, ValidateNested, ArrayNotEmpty } from "class-validator";
import { Type } from "class-transformer";

import { ProblemTagLocalizedNameDto } from "./problem-tag-localized-name.dto";

import { If } from "../../common/validators";

export class CreateProblemTagRequestDto {
  @ApiProperty({ type: [ProblemTagLocalizedNameDto] })
  @If<ProblemTagLocalizedNameDto[]>(
    localizedNames => new Set(localizedNames.map(({ locale }) => locale)).size === localizedNames.length
  )
  @ValidateNested({ each: true })
  @ArrayNotEmpty()
  @Type(() => ProblemTagLocalizedNameDto)
  localizedNames: ProblemTagLocalizedNameDto[];

  @IsString()
  @Length(1, 20)
  color: string;
}
