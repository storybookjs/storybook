export type Status = 'active' | 'inactive' | 'pending' | null | undefined;
export const Default = {
  args: {
    status: 'active' as Status,
  },
};
