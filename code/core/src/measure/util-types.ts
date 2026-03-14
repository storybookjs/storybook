export interface Margin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Border {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface Dimensions {
  margin: Margin;
  padding: Padding;
  border: Border;
  width: number;
  height: number;
  top: number;
  left: number;
  bottom: number;
  right: number;
}

export interface Extremities {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface FloatingAlignment {
  x: 'left' | 'right';
  y: 'top' | 'bottom';
}

export interface ElementMeasurements extends Dimensions {
  extremities: Extremities;
  floatingAlignment: FloatingAlignment;
}
