export const size: number[] = [];

// Generate sizes 2-6
for (let i = 2; i <= 16; i += 2) {
  size.push(i);
}

// Generate sizes in multiples of 4
for (let i = 20; i <= 76; i += 4) {
  size.push(i);
}

// Generate sizes in multiples of 16
for (let i = 80; i <= 128; i += 16) {
  size.push(i);
}

// This should pass
//const passingTest = primitive.color.blue.l44;

// This should fail
//const failingTest = primitive.color.neutral.white;
