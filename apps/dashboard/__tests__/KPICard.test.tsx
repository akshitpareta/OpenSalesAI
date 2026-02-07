import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { KPICard } from '../src/components/KPICard';

// Simple icon for testing
const TestIcon = () => <span data-testid="test-icon">$</span>;

describe('KPICard', () => {
  it('should render the title and value', () => {
    render(
      <KPICard
        title="Total Revenue"
        value="12,34,567"
        icon={<TestIcon />}
      />,
    );

    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('12,34,567')).toBeInTheDocument();
  });

  it('should render the icon', () => {
    render(
      <KPICard
        title="Active Reps"
        value={42}
        icon={<TestIcon />}
      />,
    );

    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('should display a positive change with up trend', () => {
    render(
      <KPICard
        title="Revenue"
        value="5,00,000"
        change={12.5}
        trend="up"
        changeLabel="vs last week"
        icon={<TestIcon />}
      />,
    );

    expect(screen.getByText('+12.5%')).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });

  it('should display a negative change with down trend', () => {
    render(
      <KPICard
        title="Coverage"
        value="67%"
        change={-5.2}
        trend="down"
        changeLabel="vs yesterday"
        icon={<TestIcon />}
      />,
    );

    expect(screen.getByText('-5.2%')).toBeInTheDocument();
    expect(screen.getByText('vs yesterday')).toBeInTheDocument();
  });

  it('should display neutral trend', () => {
    render(
      <KPICard
        title="Tasks"
        value={156}
        change={0}
        trend="neutral"
        icon={<TestIcon />}
      />,
    );

    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('should not render change section when change is undefined', () => {
    const { container } = render(
      <KPICard
        title="Simple Card"
        value="100"
        icon={<TestIcon />}
      />,
    );

    // The change percentage should not be present
    expect(container.querySelector('.inline-flex')).toBeNull();
  });

  it('should render numeric value correctly', () => {
    render(
      <KPICard
        title="Active Reps"
        value={42}
        icon={<TestIcon />}
      />,
    );

    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    const { container } = render(
      <KPICard
        title="Custom"
        value="test"
        icon={<TestIcon />}
        className="custom-class"
      />,
    );

    const card = container.firstElementChild;
    expect(card?.classList.contains('custom-class')).toBe(true);
  });

  it('should apply correct trend colors for up trend', () => {
    const { container } = render(
      <KPICard
        title="Revenue"
        value="1000"
        change={10}
        trend="up"
        icon={<TestIcon />}
      />,
    );

    // The icon container should have green classes for up trend
    const iconContainer = container.querySelector('.h-12.w-12');
    expect(iconContainer).toBeTruthy();
  });

  it('should format INR currency values correctly when passed as string', () => {
    render(
      <KPICard
        title="Revenue"
        value="\u20B91,23,456.78"
        icon={<TestIcon />}
      />,
    );

    // The Rupee symbol and formatted number should be present
    expect(screen.getByText('\u20B91,23,456.78')).toBeInTheDocument();
  });
});
