declare module 'vue' {
  interface ComponentCustomProperties {
    $greetingMessage: (key: string) => string;
  }
}

declare global {
  var Components: Record<string, any>;
}

export default {};
