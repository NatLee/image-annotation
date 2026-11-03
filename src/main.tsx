import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ImageAnnotationSystem from '@/components/ImageAnnotation';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ImageAnnotationSystem />
  </StrictMode>,
);
