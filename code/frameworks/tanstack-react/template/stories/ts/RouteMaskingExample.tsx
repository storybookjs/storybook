import { useParams } from '@tanstack/react-router';

export const ProductModal = (): JSX.Element => {
  const { productId } = useParams({ from: '/products/$productId' });

  return (
    <div>
      <h2>Product Detail</h2>
      <p>Product ID: {productId}</p>
    </div>
  );
};

export const ProductListPage = (): JSX.Element => (
  <div>
    <h1>Products</h1>
    <p>Select a product to view details.</p>
  </div>
);
