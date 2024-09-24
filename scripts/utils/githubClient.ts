const GITHUB_API = 'https://api.github.com/graphql';

export const githubClient = (apiKey: string) => {
  return async (query: string, variables?: { [key: string]: any }) => {
    const res = await fetch(GITHUB_API, {
      method: 'POST',
      headers: {
        authorization: `token ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    const result = await res.json();
    const { data, errors } = result;
    if (errors) {
      throw new Error(JSON.stringify(errors[0]));
    }
    return data;
  };
};
