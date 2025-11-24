/**
 * Header Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import Header from '../Header';

// Mock the SynercoreLogo component
jest.mock('../SynercoreLogo', () => {
  return function MockLogo() {
    return <div data-testid="synercore-logo">Logo</div>;
  };
});

describe('Header', () => {
  it('should render the header element', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');

    expect(header).toBeInTheDocument();
  });

  it('should render the Synercore logo', () => {
    render(<Header />);

    expect(screen.getByTestId('synercore-logo')).toBeInTheDocument();
  });

  it('should display "Dashboard" title', () => {
    render(<Header />);

    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toHaveTextContent('Dashboard');
  });

  it('should have correct styling structure', () => {
    const { container } = render(<Header />);
    const header = container.querySelector('header');

    // Check that header has flex display
    expect(header).toHaveStyle('display: flex');
    expect(header).toHaveStyle('align-items: center');
    expect(header).toHaveStyle('justify-content: flex-start');
  });

  it('should have h1 with correct styling', () => {
    const { container } = render(<Header />);
    const h1 = container.querySelector('h1');

    expect(h1).toHaveStyle('margin: 0');
    expect(h1).toHaveStyle('font-size: 18px');
  });

  it('should have right-aligned section for actions', () => {
    const { container } = render(<Header />);
    const actionDiv = container.querySelector('div[style*="margin-left"]');

    expect(actionDiv).toHaveStyle('margin-left: auto');
    expect(actionDiv).toHaveStyle('display: flex');
  });
});
