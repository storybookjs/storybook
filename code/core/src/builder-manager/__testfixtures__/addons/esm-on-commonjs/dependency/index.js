if (process.env.NODE_ENV === 'production') {
  module.exports = { mode: 'production', hello: () => 'hello' };
} else {
  module.exports = { mode: 'development', hello: () => 'hello' };
}
