import { useParams } from '@tanstack/react-router';

export const PhotoModal = (): JSX.Element => {
  const { photoId } = useParams({ from: '/photos/$photoId' });

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
      }}
    >
      <h2>Photo Detail</h2>
      <p>Viewing photo ID: {photoId}</p>
      <p style={{ fontSize: '0.875rem', color: '#666' }}>
        Note: This modal is shown while the URL remains at the gallery page (route masking).
      </p>
    </div>
  );
};

export const GalleryPage = (): JSX.Element => (
  <div style={{ padding: '2rem' }}>
    <h1>Gallery</h1>
    <p>A simple gallery page. Click on a photo to view details (which opens a masked modal).</p>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
      {[1, 2, 3, 4, 5, 6].map((id) => (
        <div
          key={id}
          style={{
            width: '100%',
            paddingBottom: '100%',
            position: 'relative',
            backgroundColor: '#e5e7eb',
            borderRadius: '8px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Photo {id}
          </div>
        </div>
      ))}
    </div>
  </div>
);
