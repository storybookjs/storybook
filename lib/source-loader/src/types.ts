export interface SourceLoc {
  line: number;
  col: number;
}

export interface SourceBlock {
  startBody: SourceLoc;
  endBody: SourceLoc;
  startLoc: SourceLoc;
  endLoc: SourceLoc;
}

export interface LocationsMap {
  [key: string]: SourceBlock;
}
