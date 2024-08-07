module.exports = {
  compact: false,
  presets: [
    '@babel/preset-typescript',
    '@babel/preset-react',
    [
      '@babel/preset-env',
      {
        shippedProposals: true,
        useBuiltIns: 'usage',
        corejs: '3',
        targets: { node: '20' },
      },
    ],
  ],
};
