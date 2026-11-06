import { useEffect, useState } from 'react';

type Order = {
  id: string;
  placedAt: string;
  total: number;
};

type State = { status: 'loading' } | { status: 'error' } | { status: 'loaded'; orders: Order[] };

export default function OrderHistory() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    fetch('/api/orders')
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        return response.json() as Promise<Order[]>;
      })
      .then((orders) => setState({ status: 'loaded', orders }))
      .catch(() => setState({ status: 'error' }));
  }, []);

  if (state.status === 'loading') return <p role="status">Loading orders…</p>;

  if (state.status === 'error') return <p role="alert">Could not load your orders.</p>;

  if (state.orders.length === 0) return <p>You have not placed any orders yet.</p>;

  return (
    <ul>
      {state.orders.map((order) => (
        <li key={order.id}>
          Order {order.id} · {new Date(order.placedAt).toLocaleDateString('en-US')} · $
          {order.total.toFixed(2)}
        </li>
      ))}
    </ul>
  );
}
