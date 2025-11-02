import { render, screen } from '@testing-library/react';
import App from '../src/renderer/App';

describe('App Component', () => {
  it('renders placeholder content', () => {
    render(<App />);
    expect(screen.getByText('Wellness Reminder App')).toBeInTheDocument();
    expect(screen.getByText('Placeholder UI - Coming Soon')).toBeInTheDocument();
  });
});
