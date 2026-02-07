import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { TaskCard, type TaskCardTask } from '../src/components/TaskCard';

// Mock the @opensalesai/ui Badge component
vi.mock('@opensalesai/ui', () => ({
  Badge: ({
    children,
    variant,
    size,
    dot,
  }: {
    children: React.ReactNode;
    variant?: string;
    size?: string;
    dot?: boolean;
  }) => (
    <span data-testid={`badge-${variant}`} data-size={size}>
      {dot && <span data-testid="badge-dot" />}
      {children}
    </span>
  ),
}));

// Mock shared types
vi.mock('@opensalesai/shared', () => ({
  TaskType: {
    VISIT: 'VISIT',
    ORDER: 'ORDER',
    COLLECTION: 'COLLECTION',
    MERCHANDISING: 'MERCHANDISING',
    SURVEY: 'SURVEY',
    PROMOTION: 'PROMOTION',
    NEW_OUTLET: 'NEW_OUTLET',
    COACHING: 'COACHING',
    STOCK_CHECK: 'STOCK_CHECK',
    RELATIONSHIP: 'RELATIONSHIP',
  },
  TaskStatus: {
    PENDING: 'PENDING',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    SKIPPED: 'SKIPPED',
    CANCELLED: 'CANCELLED',
    EXPIRED: 'EXPIRED',
  },
  TaskPriority: {
    CRITICAL: 'CRITICAL',
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW',
  },
  TaskSource: {
    AI_GENERATED: 'AI_GENERATED',
    MANAGER_ASSIGNED: 'MANAGER_ASSIGNED',
    SYSTEM_RULE: 'SYSTEM_RULE',
    SELF_CREATED: 'SELF_CREATED',
  },
}));

function createTask(overrides: Partial<TaskCardTask> = {}): TaskCardTask {
  return {
    id: 'task-001',
    type: 'VISIT' as any,
    status: 'PENDING' as any,
    priority: 'HIGH' as any,
    source: 'AI_GENERATED' as any,
    title: 'Visit Sharma General Store and push Maggi Noodles',
    ai_reasoning:
      'Store has not ordered in 18 days. Maggi is a top seller in the area.',
    priority_score: 85,
    points_reward: 15,
    scheduled_date: '2026-02-07',
    ...overrides,
  };
}

describe('TaskCard', () => {
  it('should render the task title', () => {
    render(<TaskCard task={createTask()} />);
    expect(
      screen.getByText('Visit Sharma General Store and push Maggi Noodles'),
    ).toBeInTheDocument();
  });

  it('should render the AI reasoning', () => {
    render(<TaskCard task={createTask()} />);
    expect(
      screen.getByText(
        'Store has not ordered in 18 days. Maggi is a top seller in the area.',
      ),
    ).toBeInTheDocument();
  });

  it('should not render reasoning when it is null', () => {
    render(<TaskCard task={createTask({ ai_reasoning: null })} />);
    expect(
      screen.queryByText(/Store has not ordered/),
    ).not.toBeInTheDocument();
  });

  it('should render the store name when provided', () => {
    render(
      <TaskCard
        task={createTask()}
        storeName="Sharma General Store"
      />,
    );
    expect(screen.getByText('Sharma General Store')).toBeInTheDocument();
  });

  it('should render the rep name when provided', () => {
    render(
      <TaskCard
        task={createTask()}
        repName="Rajesh Kumar"
      />,
    );
    expect(screen.getByText('Rajesh Kumar')).toBeInTheDocument();
  });

  it('should render the scheduled date', () => {
    render(<TaskCard task={createTask()} />);
    expect(screen.getByText('2026-02-07')).toBeInTheDocument();
  });

  it('should render the priority score', () => {
    render(<TaskCard task={createTask()} />);
    expect(screen.getByText('Score: 85')).toBeInTheDocument();
  });

  it('should render the points reward badge', () => {
    render(<TaskCard task={createTask()} />);
    expect(screen.getByText('+15 pts')).toBeInTheDocument();
  });

  it('should show Complete button for PENDING tasks', () => {
    const onComplete = vi.fn();
    render(
      <TaskCard task={createTask({ status: 'PENDING' as any })} onComplete={onComplete} />,
    );
    const button = screen.getByText('Complete');
    expect(button).toBeInTheDocument();
  });

  it('should show Complete button for IN_PROGRESS tasks', () => {
    const onComplete = vi.fn();
    render(
      <TaskCard
        task={createTask({ status: 'IN_PROGRESS' as any })}
        onComplete={onComplete}
      />,
    );
    expect(screen.getByText('Complete')).toBeInTheDocument();
  });

  it('should NOT show Complete button for COMPLETED tasks', () => {
    const onComplete = vi.fn();
    render(
      <TaskCard
        task={createTask({ status: 'COMPLETED' as any })}
        onComplete={onComplete}
      />,
    );
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('should NOT show Complete button for CANCELLED tasks', () => {
    const onComplete = vi.fn();
    render(
      <TaskCard
        task={createTask({ status: 'CANCELLED' as any })}
        onComplete={onComplete}
      />,
    );
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('should call onComplete with task ID when Complete is clicked', () => {
    const onComplete = vi.fn();
    render(
      <TaskCard task={createTask()} onComplete={onComplete} />,
    );

    fireEvent.click(screen.getByText('Complete'));
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith('task-001');
  });

  it('should NOT show Complete button when onComplete is not provided', () => {
    render(<TaskCard task={createTask()} />);
    expect(screen.queryByText('Complete')).not.toBeInTheDocument();
  });

  it('should render AI badge for AI-generated tasks', () => {
    render(<TaskCard task={createTask({ source: 'AI_GENERATED' as any })} />);
    expect(screen.getByText('AI')).toBeInTheDocument();
  });

  it('should not render AI badge for manager-assigned tasks', () => {
    render(
      <TaskCard task={createTask({ source: 'MANAGER_ASSIGNED' as any })} />,
    );
    expect(screen.queryByText('AI')).not.toBeInTheDocument();
  });
});
