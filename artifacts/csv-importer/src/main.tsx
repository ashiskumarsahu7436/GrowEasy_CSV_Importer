import { createRoot } from 'react-dom/client';
import { setBaseUrl } from '@workspace/api-client-react';

import App from './App';

import './index.css';

// On Replit, the frontend and backend share an origin (path-based proxy), so
// relative "/api/..." requests just work. On Render they're two separate
// services — set VITE_API_URL (e.g. https://your-api.onrender.com) at build
// time on the frontend service to point requests at the deployed backend.
const apiUrl = import.meta.env.VITE_API_URL;
if (apiUrl) {
  setBaseUrl(apiUrl);
}

createRoot(document.getElementById('root')!).render(<App />);
