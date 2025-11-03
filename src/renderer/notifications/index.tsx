import { createRoot } from 'react-dom/client';
import { NotificationContainer } from './NotificationContainer';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(<NotificationContainer />);
