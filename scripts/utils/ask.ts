import readline from 'readline';

export const ask = (query: string) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise<string>((resolve) =>
    rl.question(`${query}\n`, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
};
