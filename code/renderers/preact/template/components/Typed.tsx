import type { FunctionalComponent } from 'preact';

const formatMoney = (amount: number): string =>
  amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });

interface Props {
  name: string;
  email?: string;
  credits?: number;
}

export const Typed: FunctionalComponent<Props> = ({
  name,
  email = 'john@doe.com',
  credits = 0,
}) => (
  <table>
    <tr>
      <th>Name</th>
      <td>{name}</td>
    </tr>
    <tr>
      <th>Email</th>
      <td>
        <a href={`mailto:${email}`}>{email}</a>
      </td>
    </tr>
    <tr>
      <th>Credits</th>
      <td>{formatMoney(credits)}</td>
    </tr>
  </table>
);
