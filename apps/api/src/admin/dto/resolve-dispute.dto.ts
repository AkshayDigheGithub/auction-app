import { IsIn, IsString, MinLength } from 'class-validator';

export class ResolveDisputeDto {
  @IsIn(['upheld', 'dismissed'])
  outcome!: 'upheld' | 'dismissed';

  /**
   * Required in both directions, unlike a reversal approval. An upheld dispute
   * is what a later suspension gets justified by and a dismissal is what the
   * complainant is told — neither is worth much without the reasoning.
   */
  @IsString()
  @MinLength(5)
  note!: string;
}
