import React from 'react';
import { render, screen } from '@testing-library/react';
import { Progress } from '../progress';

describe('Progress Component', () => {
  it('should render without crashing', () => {
    render(<Progress />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute('data-slot', 'progress');
  });

  it('should render with specified value', () => {
    render(<Progress value={45} />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    
    // Check that the indicator is positioned correctly
    const indicator = progressBar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toBeInTheDocument();
    expect(indicator).toHaveStyle('transform: translateX(-55%)'); // 100 - 45 = 55%
  });

  it('should handle edge values', () => {
    const { rerender } = render(<Progress value={0} />);
    let progressBar = screen.getByRole('progressbar');
    let indicator = progressBar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toHaveStyle('transform: translateX(-100%)'); // 100 - 0 = 100%

    rerender(<Progress value={100} />);
    progressBar = screen.getByRole('progressbar');
    indicator = progressBar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toHaveStyle('transform: translateX(-0%)'); // 100 - 100 = 0%
  });

  it('should handle undefined value as 0', () => {
    render(<Progress value={undefined} />);
    
    const progressBar = screen.getByRole('progressbar');
    const indicator = progressBar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toHaveStyle('transform: translateX(-100%)'); // Treated as 0%
  });

  it('should apply custom className', () => {
    render(<Progress value={50} className="custom-progress" />);
    
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveClass('custom-progress');
  });

  it('should update when value changes', () => {
    const { rerender } = render(<Progress value={25} />);
    
    let progressBar = screen.getByRole('progressbar');
    let indicator = progressBar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toHaveStyle('transform: translateX(-75%)'); // 100 - 25 = 75%

    rerender(<Progress value={75} />);
    progressBar = screen.getByRole('progressbar');
    indicator = progressBar.querySelector('[data-slot="progress-indicator"]');
    expect(indicator).toHaveStyle('transform: translateX(-25%)'); // 100 - 75 = 25%
  });
});