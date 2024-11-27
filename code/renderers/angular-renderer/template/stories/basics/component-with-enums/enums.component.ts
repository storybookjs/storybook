import { Component, Input } from '@angular/core';

/** This component is used for testing the various forms of enum types */
@Component({
  standalone: false,
  selector: 'app-enums',
  templateUrl: './enums.component.html',
})
export class EnumsComponent {
  /** Union Type of string literals */
  @Input() unionType?: 'Union A' | 'Union B' | 'Union C';

  /** Union Type assigned as a Type Alias */
  @Input() aliasedUnionType?: TypeAlias;

  /** Base Enum Type with no assigned values */
  @Input() enumNumeric?: EnumNumeric;

  /** Enum with initial numeric value and auto-incrementing subsequent values */
  @Input() enumNumericInitial?: EnumNumericInitial;

  /** Enum with string values */
  @Input() enumStrings?: EnumStringValues;

  /** Type Aliased Enum Type */
  @Input() enumAlias?: EnumAlias;
}

/** Button Priority */
export enum EnumNumeric {
  FIRST,
  SECOND,
  THIRD,
}

export enum EnumNumericInitial {
  UNO = 1,
  DOS,
  TRES,
}

export enum EnumStringValues {
  PRIMARY = 'PRIMARY',
  SECONDARY = 'SECONDARY',
  TERTIARY = 'TERTIARY',
}

export type EnumAlias = EnumNumeric;

type TypeAlias = 'Type Alias 1' | 'Type Alias 2' | 'Type Alias 3';
