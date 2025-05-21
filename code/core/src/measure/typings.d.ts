interface Margin {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Border {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Dimensions {
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

interface Extremities {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface FloatingAlignment {
  x: 'left' | 'right';
  y: 'top' | 'bottom';
}

interface ElementMeasurements extends Dimensions {
  extremities: Extremities;
  floatingAlignment: FloatingAlignment;
}
