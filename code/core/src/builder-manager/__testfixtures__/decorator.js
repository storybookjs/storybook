function decorated() {
  return function () {
    return 'decorated';
  };
}

class Panel {
  @decorated
  title() {
    return 'plain';
  }
}

globalThis.result = new Panel().title();
